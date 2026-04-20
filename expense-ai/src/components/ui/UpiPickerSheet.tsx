"use client"

import { useState } from "react"
import { Copy, Check, Smartphone } from "lucide-react"
import { isIOS, IOS_UPI_APPS, generateIosAppLink, generateUpiLink } from "@/lib/upi"

type Props = {
  open: boolean
  amount: number
  receiverName: string
  receiverUpiId: string
  groupName: string
  onPay: (url: string) => void
  onClose: () => void
}

export function UpiPickerSheet({ open, amount, receiverName, receiverUpiId, groupName, onPay, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const ios = isIOS()

  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiverUpiId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available — silently ignore
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[2rem] shadow-2xl px-5 pt-5 pb-8">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-6" />

        {/* Amount + receiver */}
        <div className="text-center mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Paying</p>
          <p className="text-4xl font-black text-slate-900">
            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm font-bold text-slate-500 mt-1">to {receiverName}</p>
        </div>

        {/* UPI ID pill */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mb-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">UPI ID</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{receiverUpiId}</p>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-500 hover:text-slate-700 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {ios ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-3">
              Choose your UPI app
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {IOS_UPI_APPS.map((app) => (
                <button
                  key={app.id}
                  onClick={() => onPay(generateIosAppLink(app, receiverUpiId, receiverName, amount, groupName))}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border border-slate-100 bg-slate-50 text-slate-700 font-black text-xs active:scale-95 transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <Smartphone className="w-5 h-5 text-primary" />
                  {app.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <button
            onClick={() => onPay(generateUpiLink(receiverUpiId, receiverName, amount, groupName))}
            className="w-full h-14 rounded-2xl bg-primary text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all mb-3"
          >
            <Smartphone className="w-5 h-5" />
            Open UPI App
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
