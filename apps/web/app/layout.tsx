import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppProviders } from "@/src/providers/app-providers"

import "./globals.css"

export const metadata: Metadata = {
  title: "生活管家",
  description: "生活管家一期工程底座"
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
