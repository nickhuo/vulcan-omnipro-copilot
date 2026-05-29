import { z } from "zod";

/**
 * Single source of truth for the structured knowledge base shape.
 * The offline extractor emits data/manifest.json; the runtime loads + validates
 * against this schema. Every figure/table carries page + citation + image + a
 * pixel-space bbox so answers can cite the exact page and show the source.
 */

export const BBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const TextBlock = z.object({
  text: z.string(),
  bbox: BBox,
});

export const PageSchema = z.object({
  doc: z.string(),
  page: z.number().int().positive(),
  image: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** pixels per PDF point — for mapping PDF-space data back onto the page image */
  pdfScale: z.number().positive(),
  text: z.string(),
  blocks: z.array(TextBlock).default([]),
  sectionTitle: z.string().optional(),
  figures: z.array(z.string()).default([]),
});

/** Structured transcription of manual data. Discriminated by `kind`. */
export const DutyCycleRow = z.object({
  inputVoltage: z.enum(["120V", "240V"]),
  amperage: z.number(),
  dutyCyclePct: z.number(),
  /** pixel-space region of this value on the source page image (for cross-highlight) */
  cellBbox: BBox,
});

export const DutyCycleData = z.object({
  kind: z.literal("duty_cycle_matrix"),
  process: z.enum(["MIG", "TIG", "Stick"]),
  /** full source page image used for the live cross-highlight */
  pageImage: z.string(),
  pageWidth: z.number().int().positive(),
  pageHeight: z.number().int().positive(),
  rows: z.array(DutyCycleRow),
});

export const PolarityData = z.object({
  kind: z.literal("polarity"),
  process: z.enum(["MIG", "FluxCore", "TIG", "Stick"]),
  /** electrode polarity: positive = DCEP, negative = DCEN */
  electrode: z.enum(["positive", "negative"]),
  current: z.enum(["DCEP", "DCEN"]),
  torchSocket: z.string(),
  groundSocket: z.string(),
  shieldingGas: z.string().optional(),
});

export const TroubleshootingData = z.object({
  kind: z.literal("troubleshooting"),
  symptom: z.string(),
  processScope: z.string(),
  causes: z.array(
    z.object({
      cause: z.string(),
      fix: z.string(),
      processNote: z.string().optional(),
    }),
  ),
});

export const SelectionChartData = z.object({
  kind: z.literal("selection_chart"),
  processes: z.array(
    z.object({
      process: z.string(),
      gas: z.enum(["required", "not required"]),
      materials: z.array(z.string()),
      thickness: z.string(),
      cleanliness: z.string(),
      applications: z.array(z.string()),
    }),
  ),
});

/** Device-generic structured data. A newly-ingested device that has no welder-style
 *  semantics uses this (or omits `data` entirely — `data` is optional, so a plain
 *  figure with image + caption + citation validates and renders as a FigureCard). */
export const GenericData = z.object({
  kind: z.literal("generic"),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export const FigureData = z.discriminatedUnion("kind", [
  DutyCycleData,
  PolarityData,
  TroubleshootingData,
  SelectionChartData,
  GenericData,
]);

export const FigureSchema = z.object({
  id: z.string(),
  type: z.enum(["figure", "table", "schematic", "selection_chart", "photo"]),
  doc: z.string(),
  page: z.number().int().positive(),
  image: z.string(),
  bbox: BBox,
  caption: z.string(),
  citation: z.string(),
  data: FigureData.optional(),
});

export const ManifestSchema = z.object({
  source: z.object({
    documents: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        pageCount: z.number().int().positive(),
      }),
    ),
  }),
  pages: z.array(PageSchema),
  figures: z.array(FigureSchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestPage = z.infer<typeof PageSchema>;
export type Figure = z.infer<typeof FigureSchema>;
