"use client";

import { useState } from "react";
import PageImage from "./PageImage";

export interface ProposalView {
  id: string;
  doc: string;
  page: number;
  type: string;
  caption: string;
  data_kind: string;
  bbox_px: [number, number, number, number];
  snapped: boolean;
  confidence?: number;
  crop: string;
  status: string;
}

type PageMeta = Record<string, { image: string; width: number; height: number }>;
const TYPES = ["figure", "table", "schematic", "selection_chart", "photo"];

export default function ReviewClient({
  tenantId,
  proposals,
  pageMeta,
}: {
  tenantId: string;
  proposals: ProposalView[];
  pageMeta: PageMeta;
}) {
  const [items, setItems] = useState(proposals);
  const [busy, setBusy] = useState<string | null>(null);

  function patch(id: string, fn: (p: ProposalView) => ProposalView) {
    setItems((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }

  async function act(p: ProposalView, action: "accept" | "reject" | "defer") {
    setBusy(p.id);
    try {
      const res = await fetch(`/api/review/${tenantId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: p.id, action, caption: p.caption, type: p.type }),
      });
      const data = await res.json();
      patch(p.id, (x) => ({ ...x, status: data.ok ? data.status : x.status }));
    } catch {
      /* leave status unchanged on network error */
    } finally {
      setBusy(null);
    }
  }

  const pending = items.filter((p) => p.status === "pending").length;
  const accepted = items.filter((p) => p.status === "accepted").length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Figure Review — {tenantId}</h1>
        <p style={{ fontSize: 13, color: "#8b95a3", margin: "4px 0 0" }}>
          {items.length} proposals · {accepted} accepted · {pending} pending. Accept writes the figure
          into the tenant manifest and promotes the crop.
        </p>
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        {items.map((p) => {
          const meta = pageMeta[`${p.doc}-${p.page}`];
          const done = p.status !== "pending";
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--steel-700)",
                borderRadius: 12,
                background: "var(--steel-900)",
                padding: 14,
                opacity: p.status === "rejected" ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 11, color: "#8b95a3" }}>{p.id}</span>
                <span className="mono" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "var(--steel-800)" }}>
                  p{p.page} · kind={p.data_kind} · {p.snapped ? "snapped" : "raw"} · conf={p.confidence ?? "?"}
                </span>
                <StatusPill status={p.status} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
                <figure style={{ margin: 0 }}>
                  <div className="mono" style={{ fontSize: 10, color: "#6b7682", marginBottom: 4 }}>PROPOSED CROP</div>
                  <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid var(--steel-700)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.crop} alt={p.caption} style={{ display: "block", width: "100%" }} />
                  </div>
                </figure>
                {meta && (
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "#6b7682", marginBottom: 4 }}>ON THE PAGE</div>
                    <PageImage image={meta.image} width={meta.width} height={meta.height} highlight={p.bbox_px} />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <label style={{ fontSize: 11, color: "#8b95a3" }}>
                  Caption
                  <input
                    value={p.caption}
                    disabled={done}
                    onChange={(e) => patch(p.id, (x) => ({ ...x, caption: e.target.value }))}
                    style={{ width: "100%", marginTop: 3, background: "var(--steel-800)", color: "#e7ecf3", border: "1px solid var(--steel-600)", borderRadius: 7, padding: "7px 9px", fontSize: 13 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, color: "#8b95a3", display: "flex", gap: 6, alignItems: "center" }}>
                    Type
                    <select
                      value={p.type}
                      disabled={done}
                      onChange={(e) => patch(p.id, (x) => ({ ...x, type: e.target.value }))}
                      style={{ background: "var(--steel-800)", color: "#e7ecf3", border: "1px solid var(--steel-600)", borderRadius: 7, padding: "5px 8px", fontSize: 13 }}
                    >
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => act(p, "accept")} disabled={busy === p.id || done} style={btn("var(--arc)", "#12161c", busy === p.id || done)}>Accept</button>
                    <button onClick={() => act(p, "defer")} disabled={busy === p.id || done} style={btn("transparent", "#aab3bf", busy === p.id || done)}>Defer</button>
                    <button onClick={() => act(p, "reject")} disabled={busy === p.id || done} style={btn("transparent", "var(--pos)", busy === p.id || done)}>Reject</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p style={{ color: "#8b95a3" }}>No proposals. Run <code className="mono">vision_propose.py {tenantId} &lt;pdf&gt; --pages …</code> first.</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "accepted" ? "var(--arc)" : status === "rejected" ? "var(--pos)" : status === "deferred" ? "#c9a227" : "#6b7682";
  return (
    <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, border: `1px solid ${color}`, color }}>
      {status}
    </span>
  );
}

function btn(bg: string, fg: string, disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--steel-700)" : bg,
    color: disabled ? "#6b7682" : fg,
    border: bg === "transparent" ? `1px solid ${fg}` : "none",
    borderRadius: 7,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
  };
}
