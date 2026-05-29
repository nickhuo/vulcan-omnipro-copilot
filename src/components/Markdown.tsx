import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders assistant markdown (GFM tables, bold, lists, blockquotes) on the dark theme. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md" style={{ fontSize: 14, lineHeight: 1.6 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 style={{ fontSize: 16, margin: "4px 0 8px", fontWeight: 700 }} {...p} />,
          h2: (p) => <h4 style={{ fontSize: 15, margin: "4px 0 6px", fontWeight: 700 }} {...p} />,
          h3: (p) => <h4 style={{ fontSize: 14, margin: "4px 0 6px", fontWeight: 700 }} {...p} />,
          p: (p) => <p style={{ margin: "6px 0" }} {...p} />,
          ul: (p) => <ul style={{ margin: "6px 0", paddingLeft: 20 }} {...p} />,
          ol: (p) => <ol style={{ margin: "6px 0", paddingLeft: 20 }} {...p} />,
          li: (p) => <li style={{ margin: "2px 0" }} {...p} />,
          strong: (p) => <strong style={{ color: "#fff", fontWeight: 700 }} {...p} />,
          a: (p) => <a style={{ color: "var(--arc-glow)" }} {...p} />,
          blockquote: (p) => (
            <blockquote
              style={{
                margin: "8px 0",
                padding: "6px 12px",
                borderLeft: "3px solid var(--arc)",
                background: "rgba(255,122,24,0.08)",
                borderRadius: 4,
                color: "#c4ccd6",
              }}
              {...p}
            />
          ),
          code: (p) => (
            <code
              className="mono"
              style={{ background: "var(--steel-800)", padding: "1px 5px", borderRadius: 4, fontSize: 12.5 }}
              {...p}
            />
          ),
          table: (p) => (
            <div style={{ overflowX: "auto", margin: "8px 0" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }} {...p} />
            </div>
          ),
          th: (p) => (
            <th
              style={{
                textAlign: "left",
                padding: "7px 10px",
                background: "var(--steel-800)",
                borderBottom: "1px solid var(--steel-600)",
                fontWeight: 700,
              }}
              {...p}
            />
          ),
          td: (p) => (
            <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--steel-800)" }} {...p} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
