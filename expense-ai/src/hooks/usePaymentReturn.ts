import { useEffect, useRef } from "react"

export type PendingPayment = {
  amount: number
  payerId: string
  receiverId: string
  receiverName: string
  groupId: string
  groupName: string
  savedAt: number   // Date.now() when saved — used to discard stale entries
}

const KEY = "pending_payment"
const MAX_AGE_MS = 10 * 60 * 1000  // discard after 10 minutes

export function savePendingPayment(p: Omit<PendingPayment, "savedAt">) {
  localStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: Date.now() }))
}

export function clearPendingPayment() {
  localStorage.removeItem(KEY)
}

function readPending(): PendingPayment | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const payment = JSON.parse(raw) as PendingPayment
    if (Date.now() - (payment.savedAt ?? 0) > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return payment
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function usePaymentReturn(onReturn: (p: PendingPayment) => void) {
  // Keep callback in a ref so the effect never needs to re-run when it changes
  const cb = useRef(onReturn)
  useEffect(() => { cb.current = onReturn }, [onReturn])

  useEffect(() => {
    const fire = (delay: number) => {
      const payment = readPending()
      if (!payment) return
      setTimeout(() => cb.current(payment), delay)
    }

    // On-mount check — handles the case where the PWA fully reloaded after
    // returning from the UPI app (visibilitychange won't fire in that case).
    // Small delay lets the page finish rendering before showing the modal.
    const mountTimer = setTimeout(() => fire(0), 600)

    // Visibility-change check — handles the normal background → foreground case.
    const handler = () => {
      if (document.visibilityState !== "visible") return
      fire(800)
    }
    document.addEventListener("visibilitychange", handler)

    return () => {
      clearTimeout(mountTimer)
      document.removeEventListener("visibilitychange", handler)
    }
  }, []) // intentionally empty — cb ref keeps the callback fresh
}
