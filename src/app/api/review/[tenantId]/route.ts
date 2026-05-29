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

/** Human-review actions on a vision proposal. Accept writes the figure into the
 *  tenant manifest and promotes the crop into figures/; reject/defer just record
 *  state. Vision never writes the manifest — only an explicit accept here does. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  if (!tenantExists(tenantId)) {
    return json({ error: "unknown tenant" }, 404);
  }

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

  const root = process.cwd();
  const proposalsPath = join(root, "data", "tenants", tenantId, "proposals.json");
  if (!existsSync(proposalsPath)) return json({ error: "no proposals for tenant" }, 404);

  const proposals: Proposal[] = JSON.parse(readFileSync(proposalsPath, "utf8"));
  const p = proposals.find((x) => x.id === proposalId);
  if (!p) return json({ error: "proposal not found" }, 404);

  if (action === "accept") {
    const manifestPath = join(root, "data", "tenants", tenantId, "manifest.json");
    const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));

    // Promote the crop: public/tenants/<id>/proposals/X.png -> figures/X.png
    const cropFile = basename(p.crop);
    const figuresDir = join(root, "public", "tenants", tenantId, "figures");
    mkdirSync(figuresDir, { recursive: true });
    const srcCrop = join(root, "public", "tenants", tenantId, "proposals", cropFile);
    if (existsSync(srcCrop)) renameSync(srcCrop, join(figuresDir, cropFile));
    const image = `/tenants/${tenantId}/figures/${cropFile}`;

    const type = FIGURE_TYPES.includes(body.type ?? "") ? body.type! : (FIGURE_TYPES.includes(p.type) ? p.type : "figure");
    const caption = (body.caption ?? p.caption).trim() || p.caption;
    const docTitle = manifest.source.documents.find((d) => d.id === p.doc)?.title ?? p.doc;
    const citation = `${docTitle}, p.${p.page}`;

    // Upsert the figure (idempotent on re-accept).
    manifest.figures = manifest.figures.filter((f) => f.id !== p.id);
    manifest.figures.push({
      id: p.id,
      type: type as "figure" | "table" | "schematic" | "selection_chart" | "photo",
      doc: p.doc,
      page: p.page,
      image,
      bbox: p.bbox_px,
      caption,
      citation,
    });
    const pg = manifest.pages.find((x) => x.doc === p.doc && x.page === p.page);
    if (pg && !pg.figures.includes(p.id)) pg.figures.push(p.id);

    // Validate before writing, then bust the runtime cache so the copilot sees it live.
    ManifestSchema.parse(manifest);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    invalidateManifest(tenantId);
    p.caption = caption;
    p.type = type;
  }

  p.status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "deferred";
  writeFileSync(proposalsPath, JSON.stringify(proposals, null, 2));

  const counts = proposals.reduce<Record<string, number>>((a, x) => {
    a[x.status] = (a[x.status] ?? 0) + 1;
    return a;
  }, {});
  return json({ ok: true, status: p.status, counts });
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
