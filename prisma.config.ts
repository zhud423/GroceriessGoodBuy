import { defineConfig } from "prisma/config"

process.loadEnvFile?.(".env")

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "tsx packages/db/src/seed.ts"
  }
})
