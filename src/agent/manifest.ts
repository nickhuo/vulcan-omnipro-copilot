import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ManifestSchema,
  type Manifest,
  type Figure,
  type ManifestPage,
} from "../../data/manifest.schema";

let cached: Manifest | null = null;

/** Load + validate data/manifest.json once per process. */
export function getManifest(): Manifest {
  if (cached) return cached;
  const path = join(process.cwd(), "data", "manifest.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  cached = ManifestSchema.parse(raw);
  return cached;
}

export function getFigure(id: string): Figure | undefined {
  return getManifest().figures.find((f) => f.id === id);
}

export function getPage(doc: string, page: number): ManifestPage | undefined {
  return getManifest().pages.find((p) => p.doc === doc && p.page === page);
}

/** Compact catalog injected into the system prompt so the model picks IDs deterministically. */
export function figureCatalog(): string {
  return getManifest()
    .figures.map((f) => `- ${f.id} (${f.type}, ${f.citation}): ${f.caption}`)
    .join("\n");
}

/** Lexical search over page text + figure captions. No embeddings — corpus is tiny and fixed. */
export function searchManual(
  query: string,
  topK = 5,
): Array<{ doc: string; page: number; snippet: string; figureIds: string[]; citation: string }> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = getManifest().pages.map((p) => {
    const hay = `${p.text} ${p.sectionTitle ?? ""}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { p, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ p }) => ({
      doc: p.doc,
      page: p.page,
      snippet: p.text.slice(0, 280),
      figureIds: p.figures,
      citation: `${docTitle(p.doc)}, p.${p.page}`,
    }));
}

export function docTitle(docId: string): string {
  return getManifest().source.documents.find((d) => d.id === docId)?.title ?? docId;
}
