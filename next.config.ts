import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from adding its own block to CLAUDE.md. Our CLAUDE.md
  // already says to read node_modules/next/dist/docs before writing Next.js code.
  agentRules: false,
};

export default nextConfig;
