import { runAgent } from "@/agent/runAgent";
import { encodeFrame } from "@/lib/sse";
import type { StreamFrame } from "@/lib/types";

// The Agent SDK spawns a bundled engine subprocess — needs the Node runtime,
// not the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 4000;

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

  // Cap prompt size: each request spends Anthropic tokens, so reject oversized input.
  if (prompt.length > MAX_PROMPT_CHARS) {
    return new Response(
      JSON.stringify({ error: `Question too long (max ${MAX_PROMPT_CHARS} characters).` }),
      { status: 413, headers: { "content-type": "application/json" } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Aborted when the client disconnects, so runAgent can stop the SDK turn
  // instead of burning tokens with no consumer.
  const ac = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (frame: StreamFrame) => {
        if (closed) return;
        try {
          controller.enqueue(encodeFrame(frame));
        } catch {
          // Controller already closed/errored (e.g. client gone) — stop emitting.
          closed = true;
          return;
        }
        if (frame.type === "done") {
          closed = true;
          controller.close();
        }
      };
      await runAgent(prompt, emit, ac.signal);
      // runAgent always emits a final `done`, which closes the controller above.
    },
    cancel() {
      ac.abort();
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
