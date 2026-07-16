"use client";

import { useEffect, useState } from "react";

// The embedded page posts { type: "the-end-height", height } whenever its
// content height changes (see the script at the bottom of
// public/the-end/index.html). We size the iframe to match so the canvas and
// every control row stay visible with no inner scrollbar. The fallback height
// covers the canvas plus controls while the first message is in flight.
const FALLBACK_HEIGHT = 1100;

export default function TheEndFrame() {
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (
        data &&
        data.type === "the-end-height" &&
        typeof data.height === "number" &&
        Number.isFinite(data.height) &&
        data.height > 0
      ) {
        setHeight(Math.ceil(data.height));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--code-bg)]">
      <iframe
        src="/the-end/index.html"
        title="The End — an interactive WebGL scene"
        className="block w-full border-0"
        style={{ height }}
        scrolling="no"
      />
    </div>
  );
}
