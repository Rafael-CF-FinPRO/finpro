import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for OFX/PDF/spreadsheet statement
      // uploads (src/app/actions/import.ts).
      bodySizeLimit: "5mb",
    },
  },
  // pdfjs-dist (used by pdf-parse) resolves its worker script at
  // runtime in a way the bundler can't statically follow — external to
  // native Node `require` instead of bundling it.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
