import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { tenantExists, getManifest } from "@/agent/manifest";
import ReviewClient, { type ProposalView } from "@/components/ReviewClient";

// Local human-review tool for vision proposals: /review/<tenantId>.
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantExists(tenantId)) notFound();

  const proposalsPath = join(process.cwd(), "data", "tenants", tenantId, "proposals.json");
  const proposals: ProposalView[] = existsSync(proposalsPath)
    ? JSON.parse(readFileSync(proposalsPath, "utf8"))
    : [];

  // Page metadata so the client can overlay each bbox on its source page image.
  const pages = getManifest(tenantId).pages;
  const pageMeta: Record<string, { image: string; width: number; height: number }> = {};
  for (const pg of pages) {
    pageMeta[`${pg.doc}-${pg.page}`] = { image: pg.image, width: pg.width, height: pg.height };
  }

  return <ReviewClient tenantId={tenantId} proposals={proposals} pageMeta={pageMeta} />;
}
