import { Suspense } from "react"

import { LoginPage } from "@/src/components/auth/login-page"

export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
