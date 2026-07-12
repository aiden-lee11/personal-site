import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // ships only the node_modules actually traced — keeps the Railway image lean.
  output: "standalone",
};

export default nextConfig;
