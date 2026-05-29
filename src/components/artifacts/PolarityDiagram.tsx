import Citation from "../Citation";
import type { PolarityDiagramOutput } from "@/lib/types";

const PROCESS_LABEL: Record<PolarityDiagramOutput["process"], string> = {
  MIG: "MIG (Solid Wire)",
  FluxCore: "Flux-Cored (Gasless)",
  TIG: "TIG",
  Stick: "Stick (SMAW)",
};

/** Which physical cable lands in each socket, derived from electrode polarity. */
function socketContents(o: PolarityDiagramOutput) {
  // electrode positive (DCEP) -> wire/torch in (+) ; electrode negative (DCEN) -> wire/torch in (-)
  const torchInPositive = o.electrode === "positive";
  return {
    positive: torchInPositive ? "Wire Feed / Torch Power" : "Ground Clamp",
    negative: torchInPositive ? "Ground Clamp" : "Wire Feed / Torch Power",
  };
}

function Socket({
  sign,
  label,
  active,
  color,
}: {
  sign: "+" | "–";
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 10,
        padding: "14px 12px",
        background: active ? `${color}1f` : "var(--steel-800)",
        border: `1.5px solid ${active ? color : "var(--steel-600)"}`,
        display: "grid",
        gap: 8,
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--steel-950)",
          border: `2px solid ${color}`,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          fontWeight: 700,
          color,
        }}
      >
        {sign}
      </div>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 0.5, color: "#8b95a3" }}>
        {sign === "+" ? "POSITIVE" : "NEGATIVE"} SOCKET
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e7ecf3", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

export default function PolarityDiagram({ output }: { output: PolarityDiagramOutput }) {
  const sockets = socketContents(output);
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--steel-700)",
        background: "var(--steel-900)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--steel-700)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>{PROCESS_LABEL[output.process]} — Polarity</span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            background: "var(--arc)",
            color: "#12161c",
          }}
        >
          {output.current}
        </span>
        {output.shieldingGas && (
          <span style={{ fontSize: 11, color: "#8b95a3" }}>Gas: {output.shieldingGas}</span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 16,
          padding: 16,
        }}
      >
        {/* rendered diagram */}
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Socket
              sign="+"
              label={sockets.positive}
              active={output.electrode === "positive"}
              color="var(--pos)"
            />
            <Socket
              sign="–"
              label={sockets.negative}
              active={output.electrode === "negative"}
              color="var(--neg)"
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#aab3bf",
              lineHeight: 1.5,
              background: "var(--steel-800)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <strong style={{ color: "#e7ecf3" }}>Hook-up:</strong>
            <br />• {output.groundSocket}
            <br />• {output.torchSocket}
            <br />
            <span style={{ color: "#8b95a3" }}>Twist cables clockwise to lock.</span>
          </div>
        </div>

        {/* real manual figure, as proof */}
        <figure style={{ margin: 0, display: "grid", gap: 8, alignContent: "start" }}>
          <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid var(--steel-700)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={output.sourceImage} alt={output.caption} style={{ display: "block", width: "100%" }} />
          </div>
          <Citation text={output.citation} />
        </figure>
      </div>
    </div>
  );
}
