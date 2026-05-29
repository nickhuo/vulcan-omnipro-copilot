import Citation from "./Citation";
import type { FigureOutput } from "@/lib/types";

export default function FigureCard({ output }: { output: FigureOutput }) {
  return (
    <figure
      style={{
        margin: 0,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--steel-700)",
        background: "var(--steel-900)",
      }}
    >
      <div style={{ background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={output.image} alt={output.caption} style={{ display: "block", width: "100%" }} />
      </div>
      <figcaption style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#c4ccd6", lineHeight: 1.4 }}>{output.caption}</span>
        <Citation text={output.citation} />
      </figcaption>
    </figure>
  );
}
