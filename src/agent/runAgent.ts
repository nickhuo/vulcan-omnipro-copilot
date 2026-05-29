import { query, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { buildSystemPrompt } from "./systemPrompt";
import { retrievalTools } from "./tools/retrieval";
import { artifactTools } from "./tools/artifacts";
import type { StreamFrame } from "../lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

const TOOL_NAMES = [
  "search_manual",
  "get_figure",
  "get_page_image",
  "render_polarity_diagram",
  "render_duty_cycle_calculator",
  "render_troubleshooting_tree",
  "render_settings_configurator",
];

/**
 * Runs one user turn through the Claude Agent SDK. Streams text + tool events to
 * `emit`. Tool handlers (built with the same `emit`) push structured component
 * frames as they fire. Resolves when the agent finishes the turn.
 */
export async function runAgent(
  prompt: string,
  emit: (f: StreamFrame) => void,
  tenantId: string,
  signal?: AbortSignal,
): Promise<void> {
  const manualServer = createSdkMcpServer({
    name: "manual",
    version: "1.0.0",
    tools: [...retrievalTools(tenantId, emit), ...artifactTools(tenantId, emit)],
  });

  let streamedText = false;
  let resultText = "";

  try {
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        systemPrompt: buildSystemPrompt(tenantId),
        mcpServers: { manual: manualServer },
        allowedTools: TOOL_NAMES.map((n) => `mcp__manual__${n}`),
        // No project scanning, no CLAUDE.md, no built-in file tools.
        settingSources: [],
        includePartialMessages: true,
        maxTurns: 12,
      },
    })) {
      // Client disconnected: break the loop so the SDK tears down its subprocess
      // instead of running the full turn and burning tokens with no consumer.
      if (signal?.aborted) break;
      if (message.type === "stream_event") {
        const event = message.event;
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          emit({ type: "tool_call", name: stripPrefix(event.content_block.name) });
        } else if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          streamedText = true;
          emit({ type: "text_delta", text: event.delta.text });
        }
      } else if (message.type === "result") {
        if (message.subtype === "success") {
          resultText = typeof message.result === "string" ? message.result : "";
        } else {
          emit({ type: "error", message: `Agent ended: ${message.subtype}` });
        }
      }
    }
    // The model sometimes calls tools and stops without streaming a summary.
    // Fall back to the final result text so the answer is never an empty bubble.
    if (!streamedText && resultText) {
      emit({ type: "text_delta", text: resultText });
    }
  } catch (err) {
    // Log the real error server-side; never leak internal paths/config to the client.
    console.error("[runAgent] error:", err);
    if (!signal?.aborted) {
      emit({ type: "error", message: "Something went wrong answering that. Please try again." });
    }
  } finally {
    emit({ type: "done" });
  }
}

function stripPrefix(toolName: string): string {
  return toolName.replace(/^mcp__manual__/, "");
}
