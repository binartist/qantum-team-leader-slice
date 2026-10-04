import type { NextConfig } from "next";

function distDirectory(): string {
  const value = process.env.NEXT_DIST_DIR ?? "";
  if (/^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..")) return value;
  return ".next";
}

const nextConfig: NextConfig = {
  distDir: distDirectory(),
  poweredByHeader: false,
  // The catalogue CSV is read at runtime, so the serverless trace must include it for pages and API routes alike.
  outputFileTracingIncludes: {
    "/**/*": ["./data/solutions-excerpt.csv"],
  },
};

export default nextConfig;
