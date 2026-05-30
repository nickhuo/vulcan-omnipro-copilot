"""vision_propose <tenantId> <pdf-path> --pages 7,13,14 [--model M] [--doc ID]

Stage 2b (the API-costing half of figure extraction). For each requested page,
ask Claude vision which figures/tables/diagrams are worth surfacing, with a
caption, type, structured-data kind, and a COARSE normalized region. We never
trust vision's coordinates: table regions are snapped to exact PyMuPDF word
boxes via bbox_snap; all regions are cropped to candidate PNGs. Output is a
proposals file the human-review app (`/review/<tenantId>`) accepts/edits/rejects
into the tenant manifest — vision never writes the manifest directly.

Needs ANTHROPIC_API_KEY. Run:
  uv run python vision_propose.py <tenantId> ../files/owner-manual.pdf --pages 7,13,14,23,37
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF
import anthropic

from bbox_snap import snap_rect_to_words, SCALE

ROOT = Path(__file__).resolve().parent.parent
TENANT_RE = re.compile(r"^[a-z0-9-]+$")
DEFAULT_MODEL = os.environ.get("CLAUDE_VISION_MODEL", "claude-sonnet-4-6")

PROMPT = """You are extracting the reusable figures from one page of an equipment manual.
Identify every figure, diagram, table, schematic, or labeled photo on this page that a
support copilot would want to SHOW a user (not body paragraphs).

Return STRICT JSON: a list of objects, each:
{
  "suggested_id": "kebab-case-short-id",
  "type": "figure" | "table" | "schematic" | "selection_chart" | "photo",
  "caption": "one sentence describing what it shows",
  "data_kind": "duty_cycle_matrix" | "polarity" | "troubleshooting" | "selection_chart" | "generic" | "none",
  "region_norm": [x0, y0, x1, y1],   // bounding box as fractions of page width/height, 0..1
  "confidence": 0.0-1.0
}
Return [] if the page has no surface-worthy figures. Output ONLY the JSON array, no prose.

Page text (for grounding):
---
{page_text}
---"""


def page_image_b64(page: "fitz.Page") -> str:
    pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), alpha=False)
    return base64.standard_b64encode(pix.tobytes("png")).decode()


def propose_for_page(client, model: str, page: "fitz.Page") -> list[dict]:
    img_b64 = page_image_b64(page)
    msg = client.messages.create(
        model=model,
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                    {"type": "text", "text": PROMPT.replace("{page_text}", page.get_text("text")[:3000])},
                ],
            }
        ],
    )
    text = "".join(b.text for b in msg.content if b.type == "text").strip()
    # tolerate ```json fences / stray prose around the array
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return []


def main(argv: list[str]) -> int:
    pos = [a for a in argv if not a.startswith("--")]
    pages_arg = next((a.split("=", 1)[1] for a in argv if a.startswith("--pages=")), None)
    if pages_arg is None:
        # also accept `--pages 7,13`
        for i, a in enumerate(argv):
            if a == "--pages" and i + 1 < len(argv):
                pages_arg = argv[i + 1]
                pos = [p for p in pos if p != pages_arg]
    model = next((a.split("=", 1)[1] for a in argv if a.startswith("--model=")), DEFAULT_MODEL)
    doc_override = next((a.split("=", 1)[1] for a in argv if a.startswith("--doc=")), None)

    if len(pos) != 2 or not pages_arg:
        print(__doc__)
        return 2
    tenant_id, pdf_path_arg = pos
    if not TENANT_RE.match(tenant_id):
        print(f"ERROR: invalid tenant id {tenant_id}", file=sys.stderr)
        return 4
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 5
    pdf_path = Path(pdf_path_arg)
    if not pdf_path.is_file():
        print(f"ERROR: no PDF at {pdf_path}", file=sys.stderr)
        return 3
    try:
        page_nums = sorted({int(p) for p in pages_arg.split(",") if p.strip()})
    except ValueError:
        print("ERROR: --pages must be comma-separated integers", file=sys.stderr)
        return 2

    doc_id = doc_override or re.sub(r"[^a-z0-9-]+", "-", pdf_path.stem.lower()).strip("-")
    crops_dir = ROOT / "public" / "tenants" / tenant_id / "proposals"
    crops_dir.mkdir(parents=True, exist_ok=True)

    client = anthropic.Anthropic()
    doc = fitz.open(pdf_path)
    proposals: list[dict] = []
    seen = 0
    for pnum in page_nums:
        if pnum < 1 or pnum > len(doc):
            print(f"  page {pnum}: out of range (1-{len(doc)}), skipped", file=sys.stderr)
            continue
        page = doc[pnum - 1]
        W, H = page.rect.width, page.rect.height
        try:
            raw = propose_for_page(client, model, page)
        except Exception as e:  # one bad page shouldn't kill the run
            print(f"  page {pnum}: vision error ({e}), skipped", file=sys.stderr)
            continue
        for j, p in enumerate(raw):
            rn = p.get("region_norm")
            if not (isinstance(rn, list) and len(rn) == 4):
                continue
            # Clamp model fractions to [0,1] and sort, so out-of-range or inverted
            # coords can't produce empty/garbage crops.
            try:
                xs = sorted((max(0.0, min(1.0, float(rn[0]))), max(0.0, min(1.0, float(rn[2])))))
                ys = sorted((max(0.0, min(1.0, float(rn[1]))), max(0.0, min(1.0, float(rn[3])))))
            except (TypeError, ValueError):
                continue
            if xs[1] - xs[0] < 0.01 or ys[1] - ys[0] < 0.01:
                continue  # degenerate region
            rect_pts = (xs[0] * W, ys[0] * H, xs[1] * W, ys[1] * H)
            is_table = p.get("type") == "table" or p.get("data_kind") == "duty_cycle_matrix"
            snapped = snap_rect_to_words(page, rect_pts) if is_table else None
            if snapped:
                bbox_px = snapped
                clip_pts = (snapped[0] / SCALE, snapped[1] / SCALE, snapped[2] / SCALE, snapped[3] / SCALE)
            else:
                bbox_px = [round(c * SCALE, 1) for c in rect_pts]
                clip_pts = rect_pts
            pid = f"{doc_id}-p{pnum}-{p.get('suggested_id', f'fig{j}')}"[:80]
            crop_name = f"{pid}.png"
            page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=fitz.Rect(*clip_pts), alpha=False).save(
                crops_dir / crop_name
            )
            proposals.append(
                {
                    "id": pid,
                    "doc": doc_id,
                    "page": pnum,
                    "type": p.get("type", "figure"),
                    "caption": p.get("caption", ""),
                    "data_kind": p.get("data_kind", "none"),
                    "bbox_px": bbox_px,
                    "snapped": bool(snapped),
                    "confidence": p.get("confidence"),
                    "crop": f"/tenants/{tenant_id}/proposals/{crop_name}",
                    "status": "pending",
                }
            )
            seen += 1
        print(f"  page {pnum}: {len([x for x in proposals if x['page']==pnum])} proposal(s)")
    doc.close()

    out = ROOT / "data" / "tenants" / tenant_id / "proposals.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(proposals, indent=2))
    print(f"\nWrote {len(proposals)} proposals -> {out}\nReview at /review/{tenant_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
