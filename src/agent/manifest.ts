import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ManifestSchema,
  type Manifest,
  type Figure,
  type ManifestPage,
} from "../../data/manifest.schema";

/** The seed tenant — the original welder, served at `/` and `/t/vulcan-omnipro-220`. */
export const DEFAULT_TENANT = "vulcan-omnipro-220";

const TENANTS_DIR = join(process.cwd(), "data", "tenants");

// Per-tenant manifest cache. A process-wide singleton would serve tenant A's
// manifest to tenant B — this Map keeps them isolated.
const cache = new Map<string, Manifest>();

/** Drop a tenant's cached manifest so the next read reflects an on-disk edit
 *  (used by the review app after it accepts a figure into the manifest). */
export function invalidateManifest(tenantId: string): void {
  cache.delete(tenantId);
}

/** Tenant ids must be filesystem-safe: lowercase alphanumeric + hyphen only.
 *  This is the path-traversal guard — a `tenantId` like `../secrets` is rejected. */
export function isValidTenantId(tenantId: string): boolean {
  return /^[a-z0-9-]+$/.test(tenantId);
}

/** A tenant exists iff its id is valid AND its manifest file is on disk. */
export function tenantExists(tenantId: string): boolean {
  if (!isValidTenantId(tenantId)) return false;
  return existsSync(join(TENANTS_DIR, tenantId, "manifest.json"));
}

/** Allowlist: every tenant directory that has a manifest. */
export function listTenants(): string[] {
  if (!existsSync(TENANTS_DIR)) return [];
  return readdirSync(TENANTS_DIR)
    .filter((name) => {
      const p = join(TENANTS_DIR, name);
      return (
        isValidTenantId(name) &&
        statSync(p).isDirectory() &&
        existsSync(join(p, "manifest.json"))
      );
    })
    .sort();
}

/** Load + validate a tenant's manifest once per process. Throws on unknown/invalid
 *  tenant — callers (the route) translate that into a 404. */
export function getManifest(tenantId: string): Manifest {
  const cached = cache.get(tenantId);
  if (cached) return cached;
  if (!isValidTenantId(tenantId)) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }
  const path = join(TENANTS_DIR, tenantId, "manifest.json");
  if (!existsSync(path)) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const manifest = ManifestSchema.parse(raw);
  cache.set(tenantId, manifest);
  return manifest;
}

export function getFigure(tenantId: string, id: string): Figure | undefined {
  return getManifest(tenantId).figures.find((f) => f.id === id);
}

export function getPage(tenantId: string, doc: string, page: number): ManifestPage | undefined {
  return getManifest(tenantId).pages.find((p) => p.doc === doc && p.page === page);
}

/** Compact catalog injected into the system prompt so the model picks IDs deterministically. */
export function figureCatalog(tenantId: string): string {
  return getManifest(tenantId)
    .figures.map((f) => `- ${f.id} (${f.type}, ${f.citation}): ${f.caption}`)
    .join("\n");
}

/** Lexical search over page text + figure captions. No embeddings — corpus is tiny and fixed. */
export function searchManual(
  tenantId: string,
  query: string,
  topK = 5,
): Array<{ doc: string; page: number; snippet: string; figureIds: string[]; citation: string }> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = getManifest(tenantId).pages.map((p) => {
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
      citation: `${docTitle(tenantId, p.doc)}, p.${p.page}`,
    }));
}

export function docTitle(tenantId: string, docId: string): string {
  return getManifest(tenantId).source.documents.find((d) => d.id === docId)?.title ?? docId;
}
