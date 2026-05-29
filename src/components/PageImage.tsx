import Citation from "./Citation";

/**
 * Shared primitive: renders a manual page (or any image with known intrinsic
 * pixel size) and optionally overlays a highlight rectangle given in pixel-space
 * bbox. Positioning is percentage-based so it stays correct at any rendered size.
 */
export default function PageImage({
  image,
  width,
  height,
  citation,
  highlight,
}: {
  image: string;
  width: number;
  height: number;
  citation?: string;
  highlight?: [number, number, number, number];
}) {
  const pct = highlight
    ? {
        left: `${(highlight[0] / width) * 100}%`,
        top: `${(highlight[1] / height) * 100}%`,
        width: `${((highlight[2] - highlight[0]) / width) * 100}%`,
        height: `${((highlight[3] - highlight[1]) / height) * 100}%`,
      }
    : null;

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid var(--steel-700)",
          background: "#fff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={citation ?? "manual page"} style={{ display: "block", width: "100%" }} />
        {pct && (
          <div
            style={{
              position: "absolute",
              ...pct,
              border: "2px solid var(--arc)",
              boxShadow: "0 0 0 9999px rgba(12,14,18,0.45)",
              borderRadius: 4,
              transition: "all 120ms ease",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {citation && (
        <figcaption style={{ marginTop: 8 }}>
          <Citation text={citation} />
        </figcaption>
      )}
    </figure>
  );
}
