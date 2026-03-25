import type { ReactNode } from "react"

import { RequireAuth } from "@/src/components/auth/require-auth"
import { WorkspaceShell } from "@/src/components/layout/workspace-shell"

export default function WorkspaceLayout({
  children
}: {
  children: ReactNode
}) {
  return (
    <RequireAuth>
      <WorkspaceShell>{children}</WorkspaceShell>
    </RequireAuth>
  )
}
