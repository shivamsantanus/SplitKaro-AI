"use client"

import { useState, useEffect } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { ClipboardPaste, Check, X, RefreshCw } from "lucide-react"
import { RupeeSpinner } from "@/components/ui/RupeeSpinner"
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories"
import { INCOME_CATEGORIES } from "@/lib/income-categories"
import { useLanguage } from "@/contexts/LanguageContext"

type Stage = "idle" | "parsing" | "preview" | "saving"

type TxType = "INCOME" | "EXPENSE"

type ParsedExpense = {
  description: string
  amount: number
  category: string
  type: TxType
  transactionDate: string
}

const MAX_TEXT_LENGTH = 3000

interface MessageExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  // Pre-filled text (e.g. from a shared message) that auto-parses on open, skipping the paste step.
  initialText?: string
}

export function MessageExpenseModal({ isOpen, onClose, onSuccess, initialText }: MessageExpenseModalProps) {
  const { t } = useLanguage()
  const [stage, setStage] = useState<Stage>("idle")
  const [text, setText] = useState("")
  const [expenses, setExpenses] = useState<ParsedExpense[]>([])
  const [error, setError] = useState("")

  const reset = () => {
    setStage("idle")
    setText("")
    setExpenses([])
    setError("")
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const parseText = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setError(t("messageModal.errors.empty"))
      return
    }

    setStage("parsing")
    setError("")

    try {
      const res = await fetch("/api/personal/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || t("messageModal.errors.parseFailed"))
        setStage("idle")
        return
      }

      setExpenses(data.expenses)
      setStage("preview")
    } catch {
      setError(t("messageModal.errors.serverError"))
      setStage("idle")
    }
  }

  // Auto-parse once when opened with pre-filled text (share-target landing) — only re-runs
  // if the caller passes a new initialText, not on every internal stage change.
  useEffect(() => {
    if (isOpen && initialText && initialText.trim()) {
      setText(initialText)
      void parseText(initialText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialText])

  const updateExpense = (index: number, field: keyof ParsedExpense, value: string | number) => {
    setExpenses((prev) =>
      prev.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp))
    )
  }

  const setType = (index: number, next: TxType) => {
    setExpenses((prev) =>
      prev.map((exp, i) => {
        if (i !== index || exp.type === next) return exp
        const validCategories = next === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
        const category = validCategories.some((c) => c.value === exp.category)
          ? exp.category
          : next === "INCOME"
          ? "OTHER_INCOME"
          : "OTHER"
        return { ...exp, type: next, category }
      })
    )
  }

  const removeExpense = (index: number) => {
    setExpenses((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0) setStage("idle")
      return updated
    })
  }

  const saveAll = async () => {
    setStage("saving")
    setError("")
    try {
      const res = await fetch("/api/personal/transactions/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || t("messageModal.errors.saveFailed"))
        setStage("preview")
        return
      }

      reset()
      onSuccess()
      onClose()
    } catch {
      setError(t("messageModal.errors.saveFailed"))
      setStage("preview")
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("messageModal.title")}>

      {/* Idle — paste box */}
      {stage === "idle" && (
        <div className="flex flex-col gap-4 py-2 min-h-[260px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <ClipboardPaste className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-bold text-slate-900">{t("messageModal.idle.title")}</p>
            <p className="text-xs text-slate-400">{t("messageModal.idle.description")}</p>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder={t("messageModal.idle.placeholder")}
            rows={5}
            className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-700 outline-none focus:border-primary/40 transition-colors resize-none"
          />
          <p className="text-[10px] text-slate-300 font-medium text-right -mt-2">
            {text.length}/{MAX_TEXT_LENGTH}
          </p>

          {error && (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center w-full">
              {error}
            </p>
          )}

          <Button
            onClick={() => parseText(text)}
            disabled={!text.trim()}
            className="w-full rounded-2xl py-4 font-black text-sm"
          >
            {t("messageModal.idle.parseButton")}
          </Button>
        </div>
      )}

      {/* Parsing */}
      {stage === "parsing" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 min-h-[260px]">
          <RupeeSpinner className="w-8 h-8 text-primary opacity-60" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t("messageModal.parsing")}
          </p>
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && (
        <div className="-mx-6 -mb-12 flex flex-col">

          <div className="flex items-center justify-between px-6 pb-3">
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">
              {t("messageModal.preview.found", { count: expenses.length })}
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              {t("messageModal.preview.startOver")}
            </button>
          </div>

          <div className="px-6 space-y-1.5 overflow-y-auto overscroll-contain max-h-[50vh] pb-2">
            {expenses.map((exp, i) => {
              const uncertain =
                exp.category === "OTHER" || exp.category === "OTHER_INCOME" || exp.amount === 0
              const categories = exp.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
              return (
                <div
                  key={i}
                  className={`rounded-xl p-2 space-y-1.5 overflow-hidden ${
                    uncertain
                      ? "bg-amber-50/70 dark:bg-amber-900/20 ring-1 ring-amber-200/70 dark:ring-amber-700/40"
                      : "bg-slate-50/80 dark:bg-slate-700/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      value={exp.description}
                      onChange={(e) => updateExpense(i, "description", e.target.value)}
                      placeholder={t("messageModal.preview.descriptionPlaceholder")}
                      className="flex-1 min-w-0 h-8 rounded-lg bg-white/80 dark:bg-slate-600/80 px-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-300 focus:bg-white dark:focus:bg-slate-600 transition-colors"
                    />
                    <button
                      onClick={() => removeExpense(i)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setType(i, "EXPENSE")}
                      className={`flex-1 rounded-md py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                        exp.type === "EXPENSE"
                          ? "bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {t("personalModal.typeExpense")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType(i, "INCOME")}
                      className={`flex-1 rounded-md py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                        exp.type === "INCOME"
                          ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      {t("personalModal.typeIncome")}
                    </button>
                  </div>

                  <div className="flex gap-1.5 min-w-0">
                    <div className={`flex items-center gap-1 w-24 shrink-0 h-8 rounded-lg px-2 focus-within:bg-white dark:focus-within:bg-slate-700 transition-colors ${
                      exp.amount === 0 ? "bg-amber-100/60 dark:bg-amber-900/30" : "bg-white/80 dark:bg-slate-700/80"
                    }`}>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">₹</span>
                      <input
                        type="number"
                        value={exp.amount || ""}
                        onChange={(e) => updateExpense(i, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="flex-1 min-w-0 text-xs font-black text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-300"
                      />
                    </div>

                    <select
                      value={exp.category}
                      onChange={(e) => updateExpense(i, "category", e.target.value)}
                      className={`flex-1 min-w-0 h-8 rounded-lg px-2 text-[10px] font-black text-slate-700 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-700 transition-colors cursor-pointer ${
                        exp.category === "OTHER" || exp.category === "OTHER_INCOME" ? "bg-amber-100/60 dark:bg-amber-900/30" : "bg-white/80 dark:bg-slate-700/80"
                      }`}
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>

                    <div className="w-28 shrink-0 h-8 rounded-lg overflow-hidden bg-white/80 dark:bg-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-700 transition-colors">
                      <input
                        type="date"
                        value={exp.transactionDate}
                        onChange={(e) => updateExpense(i, "transactionDate", e.target.value)}
                        className="h-full w-full bg-transparent px-2 text-[10px] font-medium text-slate-600 dark:text-slate-300 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {error && (
            <div className="px-6 pt-2">
              <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center">
                {error}
              </p>
            </div>
          )}

          <div className="px-6 pt-3 pb-6 bg-white border-t border-slate-50 mt-2">
            <Button
              onClick={saveAll}
              className="w-full rounded-2xl py-4 font-black text-sm"
            >
              <Check className="w-4 h-4 mr-2 stroke-[3]" />
              {t("messageModal.preview.addButton", { count: expenses.length })}
            </Button>
            <button
              onClick={handleClose}
              className="w-full mt-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              {t("messageModal.preview.dismiss")}
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {stage === "saving" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 min-h-[260px]">
          <RupeeSpinner className="w-8 h-8 text-primary opacity-60" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {t("messageModal.saving", { count: expenses.length })}
          </p>
        </div>
      )}

    </Modal>
  )
}
