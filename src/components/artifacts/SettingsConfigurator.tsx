"use client";

import { useMemo, useState } from "react";
import Citation from "../Citation";
import type { SettingsConfiguratorOutput } from "@/lib/types";

/** Interactive process selector from the welding selection chart. Pick material +
 *  gas availability; matching processes light up. Grounded entirely in the chart. */
export default function SettingsConfigurator({ output }: { output: SettingsConfiguratorOutput }) {
  const materials = useMemo(() => {
    const set = new Set<string>();
    output.processes.forEach((p) =>
      p.materials.forEach((m) => set.add(m.replace(/\s*\(.*\)/, "").trim())),
    );
    return ["Any", ...Array.from(set)];
  }, [output.processes]);

  const [material, setMaterial] = useState("Any");
  const [gas, setGas] = useState<"any" | "have" | "none">("any");

  function matches(p: SettingsConfiguratorOutput["processes"][number]) {
    const matChip =
      material === "Any" || p.materials.some((m) => m.toLowerCase().includes(material.toLowerCase()));
    const gasChip =
      gas === "any" ||
      (gas === "have" && p.gas === "required") ||
      (gas === "none" && p.gas === "not required");
    return matChip && gasChip;
  }

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--steel-700)", background: "var(--steel-900)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--steel-700)" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Which Process Should I Use?</span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid var(--steel-800)" }}>
        <label style={{ fontSize: 12, color: "#8b95a3", display: "grid", gap: 4 }}>
          MATERIAL
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            style={{ background: "var(--steel-800)", color: "#e7ecf3", border: "1px solid var(--steel-600)", borderRadius: 7, padding: "6px 8px", fontSize: 13 }}
          >
            {materials.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <div style={{ fontSize: 12, color: "#8b95a3", display: "grid", gap: 4 }}>
          SHIELDING GAS
          <div style={{ display: "flex", gap: 4 }}>
            {([["any", "Either"], ["have", "Have gas"], ["none", "No gas"]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setGas(v)}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--steel-600)", background: gas === v ? "var(--arc)" : "transparent", color: gas === v ? "#12161c" : "#aab3bf" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 16 }}>
        {output.processes.map((p) => {
          const on = matches(p);
          return (
            <div
              key={p.process}
              style={{
                borderRadius: 10,
                padding: 12,
                border: `1.5px solid ${on ? "var(--arc)" : "var(--steel-700)"}`,
                background: on ? "rgba(255,122,24,0.08)" : "var(--steel-800)",
                opacity: on ? 1 : 0.4,
                transition: "all 140ms",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.process}</div>
              <div className="mono" style={{ fontSize: 10.5, color: on ? "var(--arc-glow)" : "#6b7682" }}>
                {p.gas === "required" ? "GAS REQUIRED" : "NO GAS"} · {p.thickness}
              </div>
              <div style={{ fontSize: 11.5, color: "#aab3bf" }}>{p.materials.join(", ")}</div>
              <div style={{ fontSize: 11, color: "#8b95a3", fontStyle: "italic" }}>{p.cleanliness}</div>
              <ul style={{ margin: "2px 0 0", paddingLeft: 16, fontSize: 11.5, color: "#c4ccd6" }}>
                {p.applications.slice(0, 2).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "0 16px 14px" }}>
        <Citation text={output.citation} />
      </div>
    </div>
  );
}
