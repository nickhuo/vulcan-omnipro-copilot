"use client";

import { useState } from "react";
import Citation from "../Citation";
import type { TroubleshootingOutput } from "@/lib/types";

/** Walk-through of likely causes → fixes for a weld defect, ordered as the manual
 *  lists them. Each step expands to its fix. Source page available on demand. */
export default function TroubleshootingTree({ output }: { output: TroubleshootingOutput }) {
  const [open, setOpen] = useState<number>(0);
  const [showPage, setShowPage] = useState(false);

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--steel-700)", background: "var(--steel-900)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--steel-700)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🔧 {output.symptom}</span>
        <span className="mono" style={{ fontSize: 11, color: "#8b95a3" }}>{output.processScope}</span>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#8b95a3", padding: "0 4px" }}>
          Check these in order — most common cause first:
        </div>
        {output.causes.map((c, i) => {
          const isOpen = open === i;
          return (
            <div key={i} style={{ borderRadius: 10, border: `1px solid ${isOpen ? "var(--arc)" : "var(--steel-700)"}`, background: "var(--steel-800)", overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{ width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: "transparent", border: "none", color: "#e7ecf3", cursor: "pointer", fontSize: 13.5 }}
              >
                <span className="mono" style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--steel-950)", border: "1px solid var(--steel-600)", display: "grid", placeItems: "center", fontSize: 11, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: 600, flex: 1 }}>{c.cause}</span>
                {c.processNote && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(31,111,235,0.18)", color: "#79b8ff", border: "1px solid rgba(31,111,235,0.4)" }}>
                    {c.processNote}
                  </span>
                )}
                <span style={{ color: "#6b7682", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }}>▸</span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 12px 12px 44px", fontSize: 13, color: "#c4ccd6", lineHeight: 1.5 }}>
                  {c.fix}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <Citation text={output.citation} />
          <button onClick={() => setShowPage((s) => !s)} className="mono" style={{ fontSize: 11, background: "transparent", border: "1px solid var(--steel-600)", color: "#aab3bf", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
            {showPage ? "hide" : "view"} manual page
          </button>
        </div>
        {showPage && (
          <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid var(--steel-700)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={output.sourceImage} alt={output.symptom} style={{ display: "block", width: "100%" }} />
          </div>
        )}
      </div>
    </div>
  );
}
