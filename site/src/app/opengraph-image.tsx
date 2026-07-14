import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aiden Lee — useful, fast software.";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d0d0e",
          width: "100%",
          height: "100%",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "#f0efec",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 22,
            color: "#8b8a86",
            letterSpacing: 2,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          aiden lee
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -1 }}>
            Compilers, distributed systems,
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -1, color: "#8b8a86" }}>
            and interactive tools.
          </div>
        </div>
        {/* Full 8-layer tower — font/gap tuned so LC → … → x86-64 stays on one line. */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 19,
            color: "#e8a25e",
            display: "flex",
            alignItems: "center",
            gap: 13,
          }}
        >
          <span>LC</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>LB</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>LA</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>IR</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>L3</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>L2</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>L1</span>
          <span style={{ opacity: 0.5 }}>→</span>
          <span>x86-64</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
