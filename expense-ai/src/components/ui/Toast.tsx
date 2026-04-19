"use client"

import { useEffect } from "react"
import { CheckCircle2, Info, AlertCircle, X } from "lucide-react"
import type { ToastState } from "@/hooks/useToast"

interface ToastProps {
  toast: ToastState
  onDismiss: () => void
  duration?: number
}

export function Toast({ toast, onDismiss, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [toast.id, duration, onDismiss])

  const styles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error:   "bg-rose-50   border-rose-200   text-rose-800",
    info:    "bg-white     border-slate-200   text-slate-800",
  }[toast.type]

  const Icon =
    toast.type === "success" ? CheckCircle2 :
    toast.type === "error"   ? AlertCircle  : Info

  const iconColor =
    toast.type === "success" ? "text-emerald-500" :
    toast.type === "error"   ? "text-rose-500"    : "text-slate-400"

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-in px-4 w-full max-w-sm">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold ${styles}`}>
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <span className="flex-1">{toast.message}</span>
        <button onClick={onDismiss} className="opacity-40 hover:opacity-80 transition-opacity shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
