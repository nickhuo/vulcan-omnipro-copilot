"""Assemble data/manifest.json from extracted page text + curated figures.

All figure data is grounded in the manual text (extracted by extract.py) and in
the figure crops (verified visually). No vector store, no runtime PDF parsing:
the runtime just reads this JSON + the committed PNGs.

Run after extract.py:  uv run python build_manifest.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "extraction" / ".cache" / "pages.json"
OUT = ROOT / "data" / "manifest.json"

P7 = "/manual/pages/owner-manual-page-007.png"  # Specifications (duty cycle)
P7_W, P7_H = 1241, 1754


def duty_rows(cells: list[tuple[str, int, int, list[int]]]):
    return [
        {"inputVoltage": v, "amperage": a, "dutyCyclePct": pct, "cellBbox": bbox}
        for (v, a, pct, bbox) in cells
    ]


FIGURES = [
    # ---- Polarity (Owner's Manual pp.13-14, only MIG + Flux-Cored are specified) ----
    {
        "id": "fig-polarity-flux",
        "type": "figure",
        "doc": "owner-manual",
        "page": 13,
        "image": "/manual/figures/fig-polarity-flux.png",
        "bbox": [545.8, 1016.7, 1200.0, 1620.8],
        "caption": "DCEN Flux-Cored (Gasless) Polarity Setup: ground clamp in the positive (+) socket, wire-feed power cable in the negative (–) socket.",
        "citation": "Owner's Manual, p.13",
        "data": {
            "kind": "polarity",
            "process": "FluxCore",
            "electrode": "negative",
            "current": "DCEN",
            "torchSocket": "Negative (–) — Wire Feed Power Cable",
            "groundSocket": "Positive (+) — Ground Clamp Cable",
            "shieldingGas": "None (self-shielded / gasless)",
        },
    },
    {
        "id": "fig-polarity-mig",
        "type": "figure",
        "doc": "owner-manual",
        "page": 14,
        "image": "/manual/figures/fig-polarity-mig.png",
        "bbox": [595.8, 58.3, 1208.3, 625.0],
        "caption": "DCEP Solid-Core (Gas-Shielded / MIG) Polarity Setup: ground clamp in the negative (–) socket, wire-feed power cable in the positive (+) socket.",
        "citation": "Owner's Manual, p.14",
        "data": {
            "kind": "polarity",
            "process": "MIG",
            "electrode": "positive",
            "current": "DCEP",
            "torchSocket": "Positive (+) — Wire Feed Power Cable",
            "groundSocket": "Negative (–) — Ground Clamp Cable",
            "shieldingGas": "Required (e.g. C25 / C100 per wire)",
        },
    },
    # ---- Duty cycle matrices (Owner's Manual p.7 Specifications) ----
    {
        "id": "tbl-duty-mig",
        "type": "table",
        "doc": "owner-manual",
        "page": 7,
        "image": P7,
        "bbox": [520, 280, 1060, 360],
        "caption": "MIG rated duty cycles: 120V → 40% @ 100A, 100% @ 75A; 240V → 25% @ 200A, 100% @ 115A.",
        "citation": "Owner's Manual, p.7 (Specifications)",
        "data": {
            "kind": "duty_cycle_matrix",
            "process": "MIG",
            "pageImage": P7,
            "pageWidth": P7_W,
            "pageHeight": P7_H,
            "rows": duty_rows([
                ("120V", 100, 40, [544, 302, 669, 329]),
                ("120V", 75, 100, [544, 327, 669, 354]),
                ("240V", 200, 25, [896, 302, 1021, 329]),
                ("240V", 115, 100, [891, 327, 1026, 354]),
            ]),
        },
    },
    {
        "id": "tbl-duty-tig",
        "type": "table",
        "doc": "owner-manual",
        "page": 7,
        "image": P7,
        "bbox": [520, 744, 1060, 824],
        "caption": "TIG rated duty cycles: 120V → 40% @ 125A, 100% @ 90A; 240V → 30% @ 175A, 100% @ 105A.",
        "citation": "Owner's Manual, p.7 (Specifications)",
        "data": {
            "kind": "duty_cycle_matrix",
            "process": "TIG",
            "pageImage": P7,
            "pageWidth": P7_W,
            "pageHeight": P7_H,
            "rows": duty_rows([
                ("120V", 125, 40, [548, 766, 672, 794]),
                ("120V", 90, 100, [548, 791, 672, 819]),
                ("240V", 175, 30, [899, 766, 1024, 794]),
                ("240V", 105, 100, [893, 791, 1029, 819]),
            ]),
        },
    },
    {
        "id": "tbl-duty-stick",
        "type": "table",
        "doc": "owner-manual",
        "page": 7,
        "image": P7,
        "bbox": [540, 1060, 1060, 1145],
        "caption": "Stick rated duty cycles: 120V → 40% @ 80A, 100% @ 60A; 240V → 25% @ 175A, 100% @ 100A.",
        "citation": "Owner's Manual, p.7 (Specifications)",
        "data": {
            "kind": "duty_cycle_matrix",
            "process": "Stick",
            "pageImage": P7,
            "pageWidth": P7_W,
            "pageHeight": P7_H,
            "rows": duty_rows([
                ("120V", 80, 40, [561, 1083, 674, 1111]),
                ("120V", 60, 100, [555, 1108, 680, 1136]),
                ("240V", 175, 25, [904, 1083, 1029, 1111]),
                ("240V", 100, 100, [898, 1108, 1034, 1136]),
            ]),
        },
    },
    # ---- Selection chart (image-only "How To Choose A Welder") ----
    {
        "id": "fig-selection-chart",
        "type": "selection_chart",
        "doc": "selection-chart",
        "page": 1,
        "image": "/manual/figures/fig-selection-chart.png",
        "bbox": [16.7, 912.5, 2483.3, 1650.0],
        "caption": "How To Choose A Welder — process selection by skill, gas, material, thickness, cleanliness.",
        "citation": "Welding Selection Chart",
        "data": {
            "kind": "selection_chart",
            "processes": [
                {
                    "process": "Flux-Cored / FCAW",
                    "gas": "not required",
                    "materials": ["Steel", "Stainless Steel"],
                    "thickness": "18 Gauge to 5/16\"",
                    "cleanliness": "More spatter",
                    "applications": [
                        "Ideal outdoors or in windy conditions",
                        "Forgiving on rusty or dirty steel",
                        "Good out of position welding",
                        "High deposition rates",
                    ],
                },
                {
                    "process": "MIG / GMAW",
                    "gas": "required",
                    "materials": ["Steel", "Stainless Steel", "Aluminum (spool gun required)"],
                    "thickness": "22 Gauge to 3/8\"",
                    "cleanliness": "Clean / minimal spatter",
                    "applications": [
                        "Fast, high welding speeds",
                        "Easiest to learn",
                        "Clean weld with no slag",
                        "Softer / easier on thin materials",
                    ],
                },
                {
                    "process": "Stick / SMAW",
                    "gas": "not required",
                    "materials": ["Steel", "Stainless Steel", "Castings"],
                    "thickness": "10 Gauge to 1/2\"",
                    "cleanliness": "More spatter",
                    "applications": [
                        "Ideal outdoors or in windy conditions",
                        "Forgiving on rusty or dirty steel",
                        "Deep penetration",
                        "Good choice for thicker materials",
                    ],
                },
                {
                    "process": "TIG / GTAW",
                    "gas": "required",
                    "materials": ["Steel", "Stainless Steel", "Chrome-Moly", "Aluminum"],
                    "thickness": "24 Gauge to 3/16\"",
                    "cleanliness": "Extremely clean",
                    "applications": [
                        "Highest quality welds",
                        "Extremely aesthetic weld appearance",
                        "Works on a wide variety of materials",
                        "Precise control",
                    ],
                },
            ],
        },
    },
    # ---- Troubleshooting (Owner's Manual pp.37, 42) ----
    {
        "id": "fig-troubleshoot-porosity",
        "type": "figure",
        "doc": "owner-manual",
        "page": 37,
        "image": "/manual/pages/owner-manual-page-037.png",
        "bbox": [0, 0, 1241, 1754],
        "caption": "Wire Weld – Porosity: small cavities or holes in the bead, with possible causes and solutions.",
        "citation": "Owner's Manual, p.37 (Welding Tips)",
        "data": {
            "kind": "troubleshooting",
            "symptom": "Porosity (small cavities or holes in the weld bead)",
            "processScope": "MIG / Flux-Cored (wire welding)",
            "causes": [
                {"cause": "Incorrect polarity", "fix": "Check that polarity is set correctly for the welding type. Flux-cored = DCEN; MIG = DCEP."},
                {"cause": "Insufficient shielding gas", "fix": "Increase gas flow, clean the nozzle, and keep proper CTWD.", "processNote": "MIG only"},
                {"cause": "Incorrect shielding gas", "fix": "Use the shielding gas recommended by your wire supplier.", "processNote": "MIG only"},
                {"cause": "Dirty workpiece or welding wire", "fix": "Clean the workpiece to bare metal; ensure wire is free of oil, coatings, and residue."},
                {"cause": "Inconsistent travel speed", "fix": "Maintain a steady travel speed."},
                {"cause": "CTWD too long", "fix": "Reduce contact-tip-to-work distance."},
            ],
        },
    },
    {
        "id": "fig-troubleshoot-arc-unstable",
        "type": "figure",
        "doc": "owner-manual",
        "page": 42,
        "image": "/manual/pages/owner-manual-page-042.png",
        "bbox": [0, 0, 1241, 1754],
        "caption": "Troubleshooting – Welding arc not stable: possible causes and likely solutions.",
        "citation": "Owner's Manual, p.42 (Troubleshooting)",
        "data": {
            "kind": "troubleshooting",
            "symptom": "Welding arc is not stable",
            "processScope": "MIG / Flux-Cored",
            "causes": [
                {"cause": "Wire not feeding properly", "fix": "See the wire-feed troubleshooting section (feed pressure, roller size, liner)."},
                {"cause": "Incorrect contact tip or liner size / excessive wear", "fix": "Replace with the proper tip or liner size for the wire used."},
                {"cause": "Incorrect wire feed speed", "fix": "Adjust wire feed speed for the wire/material."},
                {"cause": "Loose MIG gun cable or ground cable", "fix": "Secure all cable connections."},
                {"cause": "Incorrect polarity for the process", "fix": "Set DCEP for MIG, DCEN for flux-cored."},
                {"cause": "Gas coverage insufficient or too high", "fix": "Set SCFH between 20–30.", "processNote": "MIG only"},
                {"cause": "Poor connection with workpiece", "fix": "Clean the workpiece and reseat the ground clamp on bare metal."},
            ],
        },
    },
]


def main() -> None:
    raw_pages = json.loads(CACHE.read_text())

    figs_by_page: dict[tuple[str, int], list[str]] = {}
    for f in FIGURES:
        figs_by_page.setdefault((f["doc"], f["page"]), []).append(f["id"])

    pages = []
    for p in raw_pages:
        pages.append(
            {
                "doc": p["doc"],
                "page": p["page"],
                "image": p["image"],
                "width": p["width"],
                "height": p["height"],
                "pdfScale": p["pdfScale"],
                "text": " ".join(p["text"].split()),  # collapse whitespace
                "blocks": [],
                "figures": figs_by_page.get((p["doc"], p["page"]), []),
            }
        )

    manifest = {
        "source": {
            "documents": [
                {"id": "owner-manual", "title": "Vulcan OmniPro 220 Owner's Manual", "pageCount": 48},
                {"id": "quick-start", "title": "Quick Start Guide", "pageCount": 2},
                {"id": "selection-chart", "title": "Welding Selection Chart", "pageCount": 1},
            ]
        },
        "pages": pages,
        "figures": FIGURES,
    }

    OUT.write_text(json.dumps(manifest, indent=2))
    print(f"wrote {OUT}: {len(pages)} pages, {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
