"use client"

import { useEffect } from "react"

export function PWAProvider() {
  useEffect(() => {
    // Service workers require a trusted HTTPS context.
    // Skip registration in development so local-network testing on phones
    // (which use the LAN IP, not localhost) isn't blocked by the self-signed cert.
    if (process.env.NODE_ENV !== "production") return

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err))
    }
  }, [])

  return null
}
