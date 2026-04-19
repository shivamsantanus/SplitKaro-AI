"use client"

import { useState } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Check, PartyPopper } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { clearPendingPayment } from "@/hooks/usePaymentReturn"
import { fireConfetti } from "@/lib/confetti"
import type { PendingPayment } from "@/hooks/usePaymentReturn"
import type { ToastType } from "@/hooks/useToast"

interface PaymentConfirmModalProps {
  payment: PendingPayment | null
  onConfirmed: () => void   // called after successful API save (to refresh group data)
  onDismiss: () => void
  showToast: (message: string, type: ToastType) => void
}

export function PaymentConfirmModal({
  payment,
  onConfirmed,
  onDismiss,
  showToast,
}: PaymentConfirmModalProps) {
  const [isSaving, setIsSaving] = useState(false)

  if (!payment) return null

  const handleConfirm = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payment.amount,
          groupId: payment.groupId || null,
          payerId: payment.payerId,
          receiverId: payment.receiverId,
        }),
      })

      if (res.ok) {
        clearPendingPayment()
        onDismiss()
        onConfirmed()
        setTimeout(fireConfetti, 200)
      } else {
        const data = await res.json()
        showToast(data.message || "Failed to record payment. Please try again.", "error")
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    clearPendingPayment()
    onDismiss()
    showToast("Payment not recorded. You can try again anytime.", "info")
  }

  return (
    <Modal isOpen onClose={handleCancel} title="Confirm Settlement">
      <div className="space-y-5">
        {/* Icon */}
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Did you pay?</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Did you successfully pay{" "}
            <span className="font-bold text-slate-900">{formatCurrency(payment.amount)}</span>{" "}
            to <span className="font-bold text-slate-900">{payment.receiverName}</span>?
          </p>
        </div>

        {/* Amount pill */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 text-center">
          <p className="text-3xl font-black text-emerald-600">{formatCurrency(payment.amount)}</p>
          <p className="text-xs text-emerald-500 mt-1 font-medium">to {payment.receiverName}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/20"
          >
            <Check className="w-4 h-4 mr-2 stroke-[3]" />
            {isSaving ? "Recording…" : "Yes, I Paid"}
          </Button>
          <button
            onClick={handleCancel}
            className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            No, Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
