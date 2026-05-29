export default function Citation({ text }: { text: string }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        background: "rgba(255,122,24,0.12)",
        border: "1px solid rgba(255,122,24,0.35)",
        color: "var(--arc-glow)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ opacity: 0.7 }}>◆</span>
      {text}
    </span>
  );
}
