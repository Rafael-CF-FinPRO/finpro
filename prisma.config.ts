import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // No global DB seed anymore: categories are per-user now, seeded at
    // registration time from src/lib/default-categories.ts instead.
  },
  datasource: {
    // The CLI (migrate/generate/studio) uses the direct connection,
    // since Supabase's pooled connection isn't suited for DDL/migrations.
    url: env("DIRECT_URL"),
  },
});
