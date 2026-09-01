import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file=.env --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate/generate/studio) uses the direct connection,
    // since Supabase's pooled connection isn't suited for DDL/migrations.
    url: env("DIRECT_URL"),
  },
});
