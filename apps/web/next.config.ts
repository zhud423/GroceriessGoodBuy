import { fileURLToPath } from "node:url"

import type { NextConfig } from "next"

process.loadEnvFile?.(fileURLToPath(new URL("../../.env", import.meta.url)))

const nextConfig: NextConfig = {
  transpilePackages: [
    "@life-assistant/contracts",
    "@life-assistant/db",
    "@life-assistant/domain",
    "@life-assistant/shared"
  ]
}

export default nextConfig
