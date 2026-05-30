import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { ManifestSchema } from "../../../../../data/manifest.schema";
import { tenantExists, invalidateManifest } from "@/agent/manifest";

export const runtime = "nodejs";

interface Proposal {
  id: string;
  doc: string;
  page: number;
  type: string;
  caption: string;
  data_kind: string;
  bbox_px: [number, number, number, number];
  crop: string;
  status: string;
}

const FIGURE_TYPES = ["figure", "table", "schematic", "selection_chart", "photo"];

// Serialize mutating accepts per tenant so two concurrent POSTs can't interleave
// the read-modify-write of proposals.json / manifest.json and lose an edit.
const tenantChains = new Map<string, Promise<unknown>>();
function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tenantChains.get(key) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  tenantChains.set(key, result.catch(() => {}));
  return result;
}

function writeAtomic(path: string, contents: string) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path); // atomic on the same filesystem
}

/** Human-review actions on a vision proposal. Accept writes the figure into the
 *  tenant manifest and promotes the crop into figures/; reject/defer record state.
 *  Local dev tool only — disabled in production. Vision never writes the manifest;
 *  only an explicit accept here does. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return json({ error: "review tool is disabled in production" }, 403);
  }
  const { tenantId } = await params;
  if (!tenantExists(tenantId)) return json({ error: "unknown tenant" }, 404);

  let body: { proposalId?: string; action?: string; caption?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const { proposalId, action } = body;
  if (!proposalId || !["accept", "reject", "defer"].includes(action ?? "")) {
    return json({ error: "proposalId and action (accept|reject|defer) required" }, 400);
  }

  return runExclusive(tenantId, async () => {
    const root = process.cwd();
    const proposalsPath = join(root, "data", "tenants", tenantId, "proposals.json");
    if (!existsSync(proposalsPath)) return json({ error: "no proposals for tenant" }, 404);

    const proposals: Proposal[] = JSON.parse(readFileSync(proposalsPath, "utf8"));
    const p = proposals.find((x) => x.id === proposalId);
    if (!p) return json({ error: "proposal not found" }, 404);

    if (action === "accept") {
      // Guard malformed proposal shapes before they reach the manifest.
      if (typeof p.crop !== "string" || !Array.isArray(p.bbox_px) || p.bbox_px.length !== 4) {
        return json({ error: "malformed proposal" }, 400);
      }
      const cropFile = basename(p.crop); // strips any ../ — never escapes the tenant dir
      const figuresDir = join(root, "public", "tenants", tenantId, "figures");
      const srcCrop = join(root, "public", "tenants", tenantId, "proposals", cropFile);
      const destCrop = join(figuresDir, cropFile);
      if (!existsSync(srcCrop) && !existsSync(destCrop)) {
        return json({ error: "crop image missing — re-run vision_propose" }, 409);
      }
      mkdirSync(figuresDir, { recursive: true });
      if (existsSync(srcCrop)) renameSync(srcCrop, destCrop);
      const image = `/tenants/${tenantId}/figures/${cropFile}`;

      const manifestPath = join(root, "data", "tenants", tenantId, "manifest.json");
      const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
      const type = FIGURE_TYPES.includes(body.type ?? "")
        ? body.type!
        : FIGURE_TYPES.includes(p.type)
          ? p.type
          : "figure";
      const caption = (body.caption ?? p.caption).trim() || p.caption;
      const docTitle = manifest.source.documents.find((d) => d.id === p.doc)?.title ?? p.doc;

      manifest.figures = manifest.figures.filter((f) => f.id !== p.id); // idempotent re-accept
      manifest.figures.push({
        id: p.id,
        type: type as "figure" | "table" | "schematic" | "selection_chart" | "photo",
        doc: p.doc,
        page: p.page,
        image,
        bbox: p.bbox_px,
        caption,
        citation: `${docTitle}, p.${p.page}`,
      });
      const pg = manifest.pages.find((x) => x.doc === p.doc && x.page === p.page);
      if (pg && !pg.figures.includes(p.id)) pg.figures.push(p.id);

      ManifestSchema.parse(manifest); // validate before persisting
      writeAtomic(manifestPath, JSON.stringify(manifest, null, 2));
      invalidateManifest(tenantId); // copilot sees the new figure without a restart
      p.caption = caption;
      p.type = type;
    }

    p.status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "deferred";
    writeAtomic(proposalsPath, JSON.stringify(proposals, null, 2));

    const counts = proposals.reduce<Record<string, number>>((a, x) => {
      a[x.status] = (a[x.status] ?? 0) + 1;
      return a;
    }, {});
    return json({ ok: true, status: p.status, counts });
  });
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
