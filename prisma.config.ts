import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * The database URL must come from the environment. There is deliberately NO
 * fallback value here: a previous version of this file contained a real
 * Neon connection string with credentials committed to the repo. That
 * credential MUST be rotated in Neon — see the PR description — and the new
 * URL set as DATABASE_URL in Vercel / the deployment environment.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Set it in your environment (see .env.example). " +
      "Do not commit a real database URL to the repo."
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  earlyAccess: true,
  datasource: {
    url: databaseUrl,
  },
} as any);
