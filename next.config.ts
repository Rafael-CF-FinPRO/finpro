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
  // Being external means Vercel's file tracer must find pdfjs-dist's
  // worker/cmap/font files itself — it resolves them dynamically
  // (computed paths), which static tracing can miss, so force them into
  // the deployed bundle for the one route that can invoke PDF parsing
  // (src/app/actions/import.ts's parsePdfImportAction).
  outputFileTracingIncludes: {
    "/lancamentos": ["node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
