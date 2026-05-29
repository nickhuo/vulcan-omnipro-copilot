import Chat from "@/components/Chat";
import { DEFAULT_TENANT } from "@/agent/manifest";

// Root serves the seed tenant (the welder) so the original demo keeps working.
export default function Home() {
  return <Chat tenantId={DEFAULT_TENANT} />;
}
