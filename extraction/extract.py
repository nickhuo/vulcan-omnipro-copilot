"""Stage A extraction: render every page to PNG and dump per-page text + blocks.

PyMuPDF resolves per-font CID/ToUnicode CMaps, so text comes out correctly
where a naive byte scrape would return glyph-index garbage. Outputs are written
to the repo's public/ and data/ trees so they can be committed (the runtime app
never opens a PDF).

Run: uv run python extract.py
"""

from __future__ import annotations

import json
from pathlib import Path

import fitz  # PyMuPDF

# --- paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
FILES = ROOT / "files"
PAGES_DIR = ROOT / "public" / "manual" / "pages"
DATA_DIR = ROOT / "extraction" / ".cache"  # intermediate, not committed

RENDER_DPI = 150
PDF_BASE_DPI = 72.0  # PDF points are 1/72 inch

DOCS = [
    ("owner-manual", "Vulcan OmniPro 220 Owner's Manual", "owner-manual.pdf"),
    ("quick-start", "Quick Start Guide", "quick-start-guide.pdf"),
    ("selection-chart", "Welding Selection Chart", "selection-chart.pdf"),
]


def slug_page(doc_id: str, page_index: int) -> str:
    return f"{doc_id}-page-{page_index + 1:03d}"


def extract_doc(doc_id: str, title: str, filename: str) -> list[dict]:
    pdf_path = FILES / filename
    doc = fitz.open(pdf_path)
    scale = RENDER_DPI / PDF_BASE_DPI
    matrix = fitz.Matrix(scale, scale)

    pages: list[dict] = []
    for i, page in enumerate(doc):
        # render page -> PNG
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out_png = PAGES_DIR / f"{slug_page(doc_id, i)}.png"
        out_png.parent.mkdir(parents=True, exist_ok=True)
        pix.save(out_png)

        # text blocks with bbox in PDF points; convert to pixel space
        text_dict = page.get_text("dict")
        blocks: list[dict] = []
        for block in text_dict.get("blocks", []):
            lines = block.get("lines")
            if not lines:
                continue  # image block, handled in stage B
            text = "".join(
                span.get("text", "")
                for line in lines
                for span in line.get("spans", [])
            ).strip()
            if not text:
                continue
            x0, y0, x1, y1 = block["bbox"]
            blocks.append(
                {
                    "text": text,
                    "bbox": [
                        round(x0 * scale, 1),
                        round(y0 * scale, 1),
                        round(x1 * scale, 1),
                        round(y1 * scale, 1),
                    ],
                }
            )

        full_text = page.get_text("text")
        pages.append(
            {
                "doc": doc_id,
                "page": i + 1,
                "image": f"/manual/pages/{slug_page(doc_id, i)}.png",
                "width": pix.width,
                "height": pix.height,
                "pdfScale": round(scale, 4),
                "text": full_text,
                "blocks": blocks,
            }
        )

    doc.close()
    return pages


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_pages: list[dict] = []
    for doc_id, title, filename in DOCS:
        pages = extract_doc(doc_id, title, filename)
        all_pages.extend(pages)
        print(f"{doc_id}: {len(pages)} pages rendered")

    out = DATA_DIR / "pages.json"
    out.write_text(json.dumps(all_pages, indent=2))
    print(f"wrote {out} ({len(all_pages)} pages total)")

    # --- spike verification: does CID decode actually work? ------------------
    haystack = "\n".join(p["text"].upper() for p in all_pages)
    for needle in ["DUTY CYCLE", "POLARITY", "FLUX", "AMPERAGE", "TIG"]:
        hits = [p["page"] for p in all_pages if needle in p["text"].upper()]
        status = "OK" if hits else "MISSING"
        print(f"  [{status}] '{needle}' -> pages {hits[:8]}")


if __name__ == "__main__":
    main()
