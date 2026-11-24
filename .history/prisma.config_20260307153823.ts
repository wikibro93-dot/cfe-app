import path from "node:path";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_E7Rpx1BdQZqU@ep-nameless-frost-aij09qo8-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  earlyAccess: true,
  datasource: {
    url: databaseUrl,
  },
} as any);
