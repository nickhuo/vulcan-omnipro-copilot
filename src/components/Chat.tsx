"use client";

import { useRef, useState } from "react";
import { parseFrames } from "@/lib/sse";
import type { ToolOutput } from "@/lib/types";
import ArtifactRenderer from "./artifacts/ArtifactRenderer";
import Markdown from "./Markdown";

interface Msg {
  role: "user" | "assistant";
  text: string;
  artifacts: ToolOutput[];
  activeTool?: string;
  error?: string;
}

const STARTERS = [
  "What polarity setup do I need for flux-cored welding? Which socket does the ground clamp go in?",
  "I'm getting porosity in my flux-cored welds. What should I check?",
  "What's the duty cycle for MIG welding at 200A on 240V?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function patchLast(fn: (m: Msg) => Msg) {
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }

  async function send(prompt: string) {
    if (!prompt.trim() || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: prompt, artifacts: [] },
      { role: "assistant", text: "", artifacts: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        patchLast((m) => ({ ...m, error: err.error || "Request failed" }));
        return;
      }
      for await (const frame of parseFrames(res.body)) {
        if (frame.type === "text_delta") {
          patchLast((m) => ({ ...m, text: m.text + frame.text, activeTool: undefined }));
        } else if (frame.type === "tool_call") {
          patchLast((m) => ({ ...m, activeTool: frame.name }));
        } else if (frame.type === "tool_result") {
          patchLast((m) => ({ ...m, artifacts: [...m.artifacts, frame.output], activeTool: undefined }));
        } else if (frame.type === "error") {
          patchLast((m) => ({ ...m, error: frame.message, activeTool: undefined }));
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (e) {
      patchLast((m) => ({ ...m, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 880, margin: "0 auto" }}>
      <header
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--steel-800)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "linear-gradient(135deg, var(--arc), #d65a00)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            boxShadow: "0 0 18px rgba(255,122,24,0.45)",
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Vulcan OmniPro 220 Copilot</div>
          <div style={{ fontSize: 12, color: "#8b95a3" }}>
            Grounded in the manual. Every answer cited and shown.
          </div>
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "grid", gap: 18 }}>
        {messages.length === 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            <p style={{ color: "#aab3bf", fontSize: 14, margin: 0 }}>
              Ask anything about setting up or troubleshooting your welder. Try:
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{
                  textAlign: "left",
                  background: "var(--steel-900)",
                  border: "1px solid var(--steel-700)",
                  color: "#d6dde6",
                  padding: "12px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13.5,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: m.role === "user" ? "80%" : "100%", display: "grid", gap: 12, width: m.role === "assistant" ? "100%" : undefined }}>
              {m.text && (
                <div
                  style={{
                    background: m.role === "user" ? "var(--arc)" : "var(--steel-900)",
                    color: m.role === "user" ? "#12161c" : "#e7ecf3",
                    border: m.role === "user" ? "none" : "1px solid var(--steel-800)",
                    padding: "11px 14px",
                    borderRadius: 12,
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: m.role === "user" ? "pre-wrap" : undefined,
                  }}
                >
                  {m.role === "assistant" ? <Markdown>{m.text}</Markdown> : m.text}
                </div>
              )}
              {m.activeTool && (
                <div className="mono" style={{ fontSize: 12, color: "var(--arc-glow)" }}>
                  ▸ {m.activeTool.replace(/_/g, " ")}…
                </div>
              )}
              {m.artifacts.map((a, j) => (
                <ArtifactRenderer key={j} output={a} />
              ))}
              {m.error && (
                <div style={{ fontSize: 13, color: "var(--pos)", border: "1px solid var(--pos)", borderRadius: 8, padding: "8px 12px" }}>
                  {m.error}
                </div>
              )}
              {m.role === "assistant" && !m.text && !m.activeTool && !m.error && busy && (
                <div className="mono" style={{ fontSize: 12, color: "#8b95a3" }}>thinking…</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{ padding: 16, borderTop: "1px solid var(--steel-800)", display: "flex", gap: 10 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about polarity, duty cycle, troubleshooting…"
          disabled={busy}
          style={{
            flex: 1,
            background: "var(--steel-900)",
            border: "1px solid var(--steel-700)",
            borderRadius: 10,
            padding: "12px 14px",
            color: "#e7ecf3",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            background: busy || !input.trim() ? "var(--steel-700)" : "var(--arc)",
            color: "#12161c",
            border: "none",
            borderRadius: 10,
            padding: "0 18px",
            fontWeight: 700,
            fontSize: 14,
            cursor: busy || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
