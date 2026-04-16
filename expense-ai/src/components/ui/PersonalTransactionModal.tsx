"use client"

import { useEffect, useState } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Check, Loader2 } from "lucide-react"
import { EXPENSE_CATEGORIES, inferExpenseCategory } from "@/lib/expense-categories"

interface PersonalTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transaction?: {
    id: string
    amount: number
    description: string
    category: string
    transactionDate: string
  } | null
}

// Shared field wrapper — enforces identical height and styling on all devices
function FieldWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center px-4 gap-2 overflow-hidden focus-within:bg-white focus-within:border-slate-200 transition-all">
      {children}
    </div>
  )
}

const baseInput = "flex-1 min-w-0 bg-transparent outline-none text-slate-900 placeholder:text-slate-400"

export function PersonalTransactionModal({ isOpen, onClose, onSuccess, transaction = null }: PersonalTransactionModalProps) {
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

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (transaction) {
      setAmount(transaction.amount.toString())
      setDescription(transaction.description)
      setCategory(transaction.category || "OTHER")
      setDate(transaction.transactionDate ? transaction.transactionDate.slice(0, 10) : "")
      setError("")
      return
    }

    reset()
  }, [isOpen, transaction])

  const handleSave = async () => {
    if (!amount || !description) {
      setError("Amount and description are required")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const endpoint = transaction
        ? `/api/personal/transactions/${transaction.id}`
        : "/api/personal/transactions"

      const res = await fetch(endpoint, {
        method: transaction ? "PUT" : "POST",
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
    <Modal isOpen={isOpen} onClose={onClose} title={transaction ? "Edit Personal Expense" : "Add Personal Expense"}>
      <div className="space-y-5">

        {/* Amount + Date — identical wrapper enforces same height on iOS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
              Amount
            </label>
            <FieldWrapper>
              <span className="text-sm font-bold text-slate-400 shrink-0">₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${baseInput} text-lg font-black`}
              />
            </FieldWrapper>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
              Date
            </label>
            <FieldWrapper>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${baseInput} text-sm font-bold w-full`}
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
            Description
          </label>
          <FieldWrapper>
            <input
              type="text"
              placeholder="E.g. Coffee, Groceries, Netflix"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description.trim() && category === "OTHER") {
                  setCategory(inferExpenseCategory(description))
                }
              }}
              className={`${baseInput} text-sm font-bold`}
            />
          </FieldWrapper>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
            Category
          </label>
          <div className="grid grid-cols-2 gap-2">
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

        {error && (
          <p className="text-xs font-bold text-rose-500 text-center bg-rose-50 py-2 rounded-xl border border-rose-100">
            {error}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-2xl text-base font-black py-7"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Check className="w-5 h-5 mr-4 stroke-[4]" />
          )}
          {transaction ? "Update Expense" : "Save Expense"}
        </Button>
      </div>
    </Modal>
  )
}
