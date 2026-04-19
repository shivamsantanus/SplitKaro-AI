"use client"

import { UPI_APPS, UpiApp } from "@/lib/upi"

type Props = {
  open: boolean
  amount: number
  receiverName: string
  onSelect: (app: UpiApp) => void
  onClose: () => void
}

export function UpiPickerSheet({ open, amount, receiverName, onSelect, onClose }: Props) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[2rem] shadow-2xl px-5 pt-5 pb-safe">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />

        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 text-center mb-1">
          Pay via
        </p>
        <p className="text-base font-black text-slate-900 text-center mb-6">
          ₹{amount.toLocaleString("en-IN")} to {receiverName}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {UPI_APPS.map((app) => (
            <button
              key={app.name}
              onClick={() => onSelect(app)}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-slate-100 bg-slate-50 active:scale-95 transition-all hover:border-slate-200 hover:shadow-sm"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-sm"
                style={{ background: app.bg }}
              >
                {app.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[11px] font-bold text-slate-700 leading-tight text-center">
                {app.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm active:scale-95 transition-all mb-2"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
