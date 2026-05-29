"""Hybrid bbox snapping — the deterministic half of figure/table extraction.

Vision (a later, optional stage) proposes an APPROXIMATE region and the semantic
label ("this is the 240V duty-cycle cell"). Vision cannot return calibrated pixel
coordinates at the ~25px precision the cross-highlight needs. So we never trust its
coordinates: we snap the proposed region to the union of the real PyMuPDF text-word
boxes inside it, giving exact, deterministic pixel bboxes.

This module is the snapping primitive + a self-test that proves it reproduces a
hand-authored welder duty-cycle cell bbox from a loose input rect.

Run the self-test:  uv run python bbox_snap.py
"""

from __future__ import annotations

import fitz  # PyMuPDF

RENDER_DPI = 150
PDF_BASE_DPI = 72.0
SCALE = RENDER_DPI / PDF_BASE_DPI


def _rects_overlap(a: tuple[float, float, float, float], b: fitz.Rect) -> bool:
    ax0, ay0, ax1, ay1 = a
    return not (b.x1 < ax0 or b.x0 > ax1 or b.y1 < ay0 or b.y0 > ay1)


def snap_rect_to_words(
    page: "fitz.Page",
    approx_rect_pts: tuple[float, float, float, float],
    pad_px: float = 4.0,
) -> list[float] | None:
    """Snap an approximate PDF-point rect to the tight pixel bbox of the words it covers.

    Returns [x0, y0, x1, y1] in PIXEL space (at RENDER_DPI), or None if no words fall
    inside the proposed region (caller should flag for human review).
    """
    words = page.get_text("words")  # (x0, y0, x1, y1, "word", block, line, word_no)
    hits = [w for w in words if _rects_overlap(approx_rect_pts, fitz.Rect(w[:4]))]
    if not hits:
        return None
    x0 = min(w[0] for w in hits)
    y0 = min(w[1] for w in hits)
    x1 = max(w[2] for w in hits)
    y1 = max(w[3] for w in hits)
    return [
        round(x0 * SCALE - pad_px, 1),
        round(y0 * SCALE - pad_px, 1),
        round(x1 * SCALE + pad_px, 1),
        round(y1 * SCALE + pad_px, 1),
    ]


def _self_test() -> int:
    """Prove snapping reproduces a hand-authored welder cell bbox from a loose rect."""
    from pathlib import Path

    pdf = Path(__file__).resolve().parent.parent / "files" / "owner-manual.pdf"
    doc = fitz.open(pdf)
    page = doc[6]  # p.7 Specifications

    # A LOOSE but row-scoped region (what a vision model hands us) around the MIG
    # 240V "25% @ 200 A" duty-cycle cell. The rect is wider/taller than the cell but
    # stays within the single row — snapping tightens it to the exact word box.
    # (Lesson from the first failure: a region spanning two rows merges both cells,
    #  so the vision stage must propose per-row regions; snapping perfects them.)
    expected = [896, 302, 1021, 329]
    loose_rect_pts = (415, 146, 505, 156)

    snapped = snap_rect_to_words(page, loose_rect_pts, pad_px=0.0)
    doc.close()

    if snapped is None:
        print("FAIL: no words found in the proposed region")
        return 1

    # Each edge should land within a few px of the hand-authored cell.
    tol = 12
    deltas = [abs(snapped[i] - expected[i]) for i in range(4)]
    ok = all(d <= tol for d in deltas)
    print(f"loose input rect (pts): {loose_rect_pts}")
    print(f"snapped (px):   {snapped}")
    print(f"hand-authored:  {expected}")
    print(f"per-edge delta: {deltas}  (tolerance {tol}px)")
    print("PASS ✅" if ok else "FAIL ❌")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(_self_test())
