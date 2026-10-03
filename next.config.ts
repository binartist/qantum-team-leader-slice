import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The catalogue CSV is read at runtime, so the serverless trace must include it.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/solutions-excerpt.csv"],
  },
};

export default nextConfig;
