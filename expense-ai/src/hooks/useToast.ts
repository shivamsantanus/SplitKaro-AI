import { useState, useCallback } from "react"

export type ToastType = "success" | "error" | "info"

export interface ToastState {
  id: number
  message: string
  type: ToastType
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ id: Date.now(), message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}
