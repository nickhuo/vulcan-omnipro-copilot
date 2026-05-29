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
      const frame = safeParse(line);
      if (frame) yield frame;
    }
  }
  const frame = safeParse(buffer.trim());
  if (frame) yield frame;
}

/** A truncated connection or a proxy error page can inject non-JSON into the
 *  body. Skip unparseable lines instead of crashing the whole client stream. */
function safeParse(line: string): StreamFrame | null {
  if (!line) return null;
  try {
    return JSON.parse(line) as StreamFrame;
  } catch {
    return null;
  }
}
