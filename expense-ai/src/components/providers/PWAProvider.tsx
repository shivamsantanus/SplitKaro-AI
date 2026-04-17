"use client"

import { useEffect } from "react"

export function PWAProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err))
    }
  }, [])

  return null
}
