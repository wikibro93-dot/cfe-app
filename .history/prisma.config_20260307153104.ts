import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasourceUrl: process.env.DATABASE_URL,
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import("@prisma/adapter-neon");
      const { neonConfig } = await import("@neondatabase/serverless");

      // Required in Node.js environments (local dev + Vercel)
      if (typeof WebSocket === "undefined") {
        const ws = await import("ws");
        neonConfig.webSocketConstructor = ws.default;
      }

      return new PrismaNeon({
        connectionString: process.env.DATABASE_URL!,
      });
    },
  },
});
