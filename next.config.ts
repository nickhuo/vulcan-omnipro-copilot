import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Claude Agent SDK ships a bundled cli.js + native wasm/ripgrep that must
  // not be bundled by webpack/turbopack — keep it external on the server.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
