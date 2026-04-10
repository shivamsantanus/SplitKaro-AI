"use client"

import { useState } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Input } from "./Input"
import { Check, Loader2 } from "lucide-react"
import { EXPENSE_CATEGORIES, inferExpenseCategory } from "@/lib/expense-categories"

interface PersonalTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PersonalTransactionModal({ isOpen, onClose, onSuccess }: PersonalTransactionModalProps) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("OTHER")
  const [date, setDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setAmount("")
    setDescription("")
    setCategory("OTHER")
    setDate("")
    setError("")
  }

  const handleSave = async () => {
    if (!amount || !description) {
      setError("Amount and description are required")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const res = await fetch("/api/personal/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          category,
          transactionDate: date || undefined,
        }),
      })

      if (res.ok) {
        reset()
        onSuccess()
        onClose()
      } else {
        const data = await res.json()
        setError(data.message || "Failed to save")
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Personal Expense">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                Amount
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-14 rounded-2xl pl-12 bg-slate-50 border-slate-100 text-lg font-black text-slate-900 focus:bg-white transition-all"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
              Description
            </label>
            <Input
              placeholder="E.g. Coffee, Groceries, Netflix"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description.trim() && category === "OTHER") {
                  setCategory(inferExpenseCategory(description))
                }
              }}
              className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all font-bold text-slate-700"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CATEGORIES.map((item) => {
                const isSelected = category === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`rounded-2xl border px-3 py-3 text-left text-xs font-black transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-primary/20 hover:text-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-rose-500 text-center bg-rose-50 py-2 rounded-xl border border-rose-100">
            {error}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-15 rounded-2xl text-base font-black py-7"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Check className="w-5 h-5 mr-4 stroke-[4]" />
          )}
          Save Expense
        </Button>
      </div>
    </Modal>
  )
}
