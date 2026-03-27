import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { NextConfig } from "next"

const workspaceEnvPath = fileURLToPath(new URL("../../.env", import.meta.url))

if (existsSync(workspaceEnvPath)) {
  process.loadEnvFile?.(workspaceEnvPath)
}

const nextConfig: NextConfig = {
  transpilePackages: [
    "@life-assistant/contracts",
    "@life-assistant/db",
    "@life-assistant/domain",
    "@life-assistant/shared"
  ]
}

export default nextConfig
