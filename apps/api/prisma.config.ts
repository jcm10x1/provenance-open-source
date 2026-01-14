import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"), // Reads from .env
  },
  // If you use migrations:
  migrations: {
    path: "prisma/migrations",
  },
  
});