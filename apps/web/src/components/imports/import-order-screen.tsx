"use client"

import { useEffect, useState } from "react"

import { ImportCreateScreen } from "@/src/components/imports/import-create-screen"
import { ImportSessionScreen } from "@/src/components/imports/import-session-screen"

type ImportOrderScreenProps = {
  initialImportSessionId?: string
}

export function ImportOrderScreen({ initialImportSessionId }: ImportOrderScreenProps) {
  const [importSessionId, setImportSessionId] = useState<string | null>(
    initialImportSessionId ?? null
  )
  const [localImagePreviewUrls, setLocalImagePreviewUrls] = useState<string[]>([])

  useEffect(() => {
    return () => {
      localImagePreviewUrls.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [localImagePreviewUrls])

  if (!importSessionId) {
    return (
      <ImportCreateScreen
        onUploaded={(createdSessionId, files) => {
          setLocalImagePreviewUrls((current) => {
            current.forEach((url) => {
              URL.revokeObjectURL(url)
            })

            return files.map((file) => URL.createObjectURL(file))
          })
          setImportSessionId(createdSessionId)
        }}
        redirectOnSuccess={false}
      />
    )
  }

  return (
    <ImportSessionScreen
      importSessionId={importSessionId}
      localImagePreviewUrls={localImagePreviewUrls}
    />
  )
}
