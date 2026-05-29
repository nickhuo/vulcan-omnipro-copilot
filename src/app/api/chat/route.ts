import { runAgent } from "@/agent/runAgent";
import { encodeFrame } from "@/lib/sse";
import type { StreamFrame } from "@/lib/types";

// The Agent SDK spawns a bundled engine subprocess — needs the Node runtime,
// not the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let prompt = "";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    /* fall through to empty-prompt guard */
  }

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing 'prompt'." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (frame: StreamFrame) => {
        if (closed) return;
        controller.enqueue(encodeFrame(frame));
        if (frame.type === "done") {
          closed = true;
          controller.close();
        }
      };
      await runAgent(prompt, emit);
      // runAgent always emits a final `done`, which closes the controller above.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
