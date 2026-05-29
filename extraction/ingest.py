"""ingest <tenantId> <pdf-dir> — onboard a new device's manuals as a tenant.

Deterministic backbone (this file): render every page to PNG, extract decoded text
+ block bboxes (PyMuPDF resolves CID fonts), and write a validated per-tenant
manifest with `pages`. Figures start empty; the vision auto-proposal + human-review
stage (separate, optional, costs API) fills `figures[]` using bbox_snap for precise
coordinates.

The result is immediately servable: text search and full-page surfacing work with
zero figures. Rich artifacts (duty-cycle calculator, polarity diagram) are additive.

Contract:
  uv run python ingest.py <tenantId> <pdf-dir> [--dry-run] [--dpi N]
  tenantId : ^[a-z0-9-]+$  (filesystem-safe; same guard as the runtime)
  pdf-dir  : a folder containing one or more .pdf files
Exit codes:
  0 success | 2 bad arguments | 3 no PDFs found | 4 tenant id invalid
Outputs (promoted from a staging dir on success, pages written before manifest):
  data/tenants/<id>/manifest.json
  public/tenants/<id>/pages/<doc>-page-NNN.png
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
PDF_BASE_DPI = 72.0
TENANT_RE = re.compile(r"^[a-z0-9-]+$")


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")
    return s or "doc"


def render_doc(doc_id: str, title: str, pdf_path: Path, pages_dir: Path, dpi: int) -> list[dict]:
    scale = dpi / PDF_BASE_DPI
    matrix = fitz.Matrix(scale, scale)
    doc = fitz.open(pdf_path)
    pages: list[dict] = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        png_name = f"{doc_id}-page-{i + 1:03d}.png"
        pix.save(pages_dir / png_name)

        blocks: list[dict] = []
        for b in page.get_text("dict").get("blocks", []):
            lines = b.get("lines")
            if not lines:
                continue
            text = "".join(
                sp.get("text", "") for ln in lines for sp in ln.get("spans", [])
            ).strip()
            if not text:
                continue
            x0, y0, x1, y1 = b["bbox"]
            blocks.append(
                {"text": text, "bbox": [round(c * scale, 1) for c in (x0, y0, x1, y1)]}
            )

        pages.append(
            {
                "doc": doc_id,
                "page": i + 1,
                "image": f"/tenants/{{TENANT}}/pages/{png_name}",
                "width": pix.width,
                "height": pix.height,
                "pdfScale": round(scale, 4),
                "text": " ".join(page.get_text("text").split()),
                "blocks": blocks,
                "figures": [],
            }
        )
    doc.close()
    return pages


def main(argv: list[str]) -> int:
    # Parse flags, accepting both `--dpi N` (space) and `--dpi=N` forms.
    args: list[str] = []
    dry_run = False
    dpi = 150
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--dry-run":
            dry_run = True
        elif a == "--dpi":
            i += 1
            if i >= len(argv):
                print("ERROR: --dpi requires a value", file=sys.stderr)
                return 2
            try:
                dpi = int(argv[i])
            except ValueError:
                print("ERROR: --dpi requires an integer", file=sys.stderr)
                return 2
        elif a.startswith("--dpi="):
            try:
                dpi = int(a.split("=", 1)[1])
            except ValueError:
                print("ERROR: --dpi= requires an integer", file=sys.stderr)
                return 2
        elif a.startswith("--"):
            print(f"ERROR: unknown flag {a}", file=sys.stderr)
            return 2
        else:
            args.append(a)
        i += 1

    if len(args) != 2:
        print(__doc__)
        return 2
    tenant_id, pdf_dir_arg = args
    if not TENANT_RE.match(tenant_id):
        print(f"ERROR: tenant id '{tenant_id}' must match ^[a-z0-9-]+$", file=sys.stderr)
        return 4
    pdf_dir = Path(pdf_dir_arg)
    pdfs = sorted(pdf_dir.glob("*.pdf")) if pdf_dir.is_dir() else []
    if not pdfs:
        print(f"ERROR: no .pdf files found in {pdf_dir}", file=sys.stderr)
        return 3

    # Stage in a temp dir, promote atomically only on full success.
    staging = ROOT / "extraction" / ".cache" / f"ingest-{tenant_id}"
    if staging.exists():
        shutil.rmtree(staging)
    pages_dir = staging / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    documents: list[dict] = []
    all_pages: list[dict] = []
    seen_ids: set[str] = set()
    for pdf in pdfs:
        doc_id = slugify(pdf.stem)
        if doc_id in seen_ids:  # two stems collide after slugify — suffix instead of clobbering
            base, n = doc_id, 2
            while f"{base}-{n}" in seen_ids:
                n += 1
            doc_id = f"{base}-{n}"
        seen_ids.add(doc_id)
        title = pdf.stem.replace("-", " ").replace("_", " ").title()
        pages = render_doc(doc_id, title, pdf, pages_dir, dpi)
        documents.append({"id": doc_id, "title": title, "pageCount": len(pages)})
        all_pages.extend(pages)
        print(f"  {pdf.name} -> doc '{doc_id}': {len(pages)} pages")

    # Bind the tenant into the committed image paths now that we know it.
    for p in all_pages:
        p["image"] = p["image"].replace("{TENANT}", tenant_id)

    manifest = {
        "source": {"documents": documents},
        "pages": all_pages,
        "figures": [],
    }
    (staging / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(
        f"\nIngested tenant '{tenant_id}': {len(documents)} document(s), "
        f"{len(all_pages)} pages, 0 figures (run the vision+review stage to add figures)."
    )

    if dry_run:
        print(f"--dry-run: staged at {staging}, not promoted.")
        return 0

    # Promote: data/tenants/<id>/manifest.json + public/tenants/<id>/pages/
    data_dest = ROOT / "data" / "tenants" / tenant_id
    pub_dest = ROOT / "public" / "tenants" / tenant_id
    data_dest.mkdir(parents=True, exist_ok=True)
    pub_dest.mkdir(parents=True, exist_ok=True)
    # Pages first, manifest last: a crash mid-promote never leaves a manifest
    # that references PNGs which aren't on disk yet.
    if (pub_dest / "pages").exists():
        shutil.rmtree(pub_dest / "pages")
    shutil.copytree(pages_dir, pub_dest / "pages")
    (data_dest / "manifest.json").write_text((staging / "manifest.json").read_text())
    shutil.rmtree(staging)
    print(f"Promoted -> {data_dest / 'manifest.json'} and {pub_dest / 'pages'}/")
    print(f"Serve at /t/{tenant_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
