"use client";

import { useMemo, useState } from "react";
import PageImage from "../PageImage";
import type { DutyCycleOutput, DutyCycleRowOut } from "@/lib/types";

/** Showpiece: drag amperage and the matching cell highlights live on the real
 *  manual specs page; the citation re-pins to the documented row. Never fabricates
 *  a number — interpolation snaps to the nearest documented row and says so. */
export default function DutyCycleCalculator({ output }: { output: DutyCycleOutput }) {
  const voltages = useMemo(
    () => Array.from(new Set(output.rows.map((r) => r.inputVoltage))).sort(),
    [output.rows],
  );
  const [voltage, setVoltage] = useState<"120V" | "240V">(voltages[voltages.length - 1] as "120V" | "240V");

  const rows = useMemo(
    () => output.rows.filter((r) => r.inputVoltage === voltage).sort((a, b) => a.amperage - b.amperage),
    [output.rows, voltage],
  );
  const min = rows[0]?.amperage ?? 0;
  const max = rows[rows.length - 1]?.amperage ?? 100;
  const [amps, setAmps] = useState<number>(max);

  // nearest documented row (we never invent duty-cycle numbers between rows)
  const nearest: DutyCycleRowOut = useMemo(() => {
    return rows.reduce((best, r) => (Math.abs(r.amperage - amps) < Math.abs(best.amperage - amps) ? r : best), rows[0]);
  }, [rows, amps]);
  const exact = nearest && nearest.amperage === amps;

  if (!rows.length) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
  const weldMin = fmt((nearest.dutyCyclePct / 100) * 10);
  const restMin = fmt(10 - (nearest.dutyCyclePct / 100) * 10);

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--steel-700)", background: "var(--steel-900)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--steel-700)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{output.process} Duty Cycle Calculator</span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {voltages.map((v) => (
            <button
              key={v}
              onClick={() => {
                setVoltage(v);
                const vr = output.rows.filter((r) => r.inputVoltage === v).sort((a, b) => a.amperage - b.amperage);
                setAmps(vr[vr.length - 1]?.amperage ?? amps);
              }}
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                border: "1px solid var(--steel-600)",
                background: voltage === v ? "var(--arc)" : "transparent",
                color: voltage === v ? "#12161c" : "#aab3bf",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, padding: 16 }}>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "#8b95a3", marginBottom: 6 }}>
              AMPERAGE: <span style={{ color: "#e7ecf3", fontSize: 13 }}>{amps} A</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={amps}
              onChange={(e) => setAmps(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--arc)" }}
            />
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7682" }}>
              <span>{min}A</span>
              <span>{max}A</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: "var(--arc)", lineHeight: 1 }}>
              {nearest.dutyCyclePct}
              <span style={{ fontSize: 20 }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: "#aab3bf", lineHeight: 1.4 }}>
              duty cycle at <strong style={{ color: "#e7ecf3" }}>{nearest.amperage} A</strong>
              <br />
              {nearest.dutyCyclePct < 100
                ? `weld ~${weldMin} min, rest ~${restMin} min per 10`
                : "continuous use OK"}
            </div>
          </div>

          {!exact && (
            <div style={{ fontSize: 12, color: "#c9a227", background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)", borderRadius: 8, padding: "8px 10px" }}>
              {amps} A is between documented values — showing the nearest rated point ({nearest.amperage} A). The manual only rates specific amperages.
            </div>
          )}
        </div>

        <PageImage
          image={output.pageImage}
          width={output.pageWidth}
          height={output.pageHeight}
          citation={output.citation}
          highlight={nearest.cellBbox}
        />
      </div>
    </div>
  );
}
