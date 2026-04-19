import { useEffect } from "react"

export type PendingPayment = {
  amount: number
  payerId: string
  receiverId: string
  receiverName: string
  groupId: string
  groupName: string
}

const KEY = "pending_payment"

export function savePendingPayment(p: PendingPayment) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearPendingPayment() {
  localStorage.removeItem(KEY)
}

export function usePaymentReturn(onReturn: (p: PendingPayment) => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      try {
        const payment = JSON.parse(raw) as PendingPayment
        // 1.5 s delay so the app fully re-renders before showing the modal
        setTimeout(() => onReturn(payment), 1500)
      } catch {
        localStorage.removeItem(KEY)
      }
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [onReturn])
}
