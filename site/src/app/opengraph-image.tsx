import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aiden Lee — useful, fast software.";

// Mirrors the site's current look (globals.css): --bg / --fg / --muted /
// --accent, the hero's eyebrow + "Hi, I'm Aiden." headline, and the compiler
// pipeline as the signature footer. Satori only embeds fonts it's handed
// (the bundled default is regular-weight only), so the real site fonts are
// vendored in ./og-fonts and loaded here.
const BG = "#0b0a0f";
const FG = "#ece9f2";
const MUTED = "#837e91";
const ACCENT = "#a684f5";

const font = (file: string) =>
  readFile(join(process.cwd(), "src/app/og-fonts", file));

export default async function OG() {
  const [inter, interBold, mono] = await Promise.all([
    font("Inter-Regular.ttf"),
    font("Inter-Bold.ttf"),
    font("JetBrainsMono-Regular.ttf"),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          background: BG,
          width: "100%",
          height: "100%",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: FG,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "monospace",
            fontSize: 22,
            color: MUTED,
          }}
        >
          <div style={{ letterSpacing: 3, textTransform: "uppercase", display: "flex" }}>
            Aiden Lee — Software engineer
          </div>
          <div style={{ display: "flex" }}>aidenlee.dev</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: -5,
              display: "flex",
            }}
          >
            <span>
              Hi, I&apos;m Aiden
              <span style={{ color: ACCENT }}>.</span>
            </span>
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.4,
              color: MUTED,
              maxWidth: 820,
              display: "flex",
            }}
          >
            I like making people&apos;s lives easier, and code that runs fast.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
        { name: "monospace", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
