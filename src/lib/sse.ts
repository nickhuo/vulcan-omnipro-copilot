import type { StreamFrame } from "./types";

const encoder = new TextEncoder();

/** One frame per line (NDJSON). */
export function encodeFrame(frame: StreamFrame): Uint8Array {
  return encoder.encode(JSON.stringify(frame) + "\n");
}

/** Client-side: turn a fetch Response body into an async stream of frames. */
export async function* parseFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as StreamFrame;
    }
  }
  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as StreamFrame;
}
