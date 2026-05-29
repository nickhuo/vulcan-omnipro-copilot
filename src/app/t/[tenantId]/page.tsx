import { notFound } from "next/navigation";
import Chat from "@/components/Chat";
import { tenantExists } from "@/agent/manifest";

// Per-tenant copilot: /t/<tenantId>. Unknown or malformed ids 404 (the same
// validation that guards the chat route also guards the page).
export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantExists(tenantId)) notFound();
  return <Chat tenantId={tenantId} />;
}
