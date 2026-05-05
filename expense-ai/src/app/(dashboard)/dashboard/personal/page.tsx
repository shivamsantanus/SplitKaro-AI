"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { PersonalTransactionModal } from "@/components/ui/PersonalTransactionModal"
import { VoiceExpenseModal } from "@/components/ui/VoiceExpenseModal"
import { formatCurrency } from "@/lib/currency"
import { Loader2, Plus, Mic, ChevronLeft, ChevronRight, PieChart, Pencil, Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { usePersonalSummaryQuery } from "@/hooks/queries/usePersonalSummary"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function PersonalPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [showExpenseMenu, setShowExpenseMenu] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: summary, isLoading: loading } = usePersonalSummaryQuery(month, year)

  const invalidateSummary = () =>
    queryClient.invalidateQueries({ queryKey: ["personal", "summary"] })

  const stepMonth = (dir: 1 | -1) => {
    const date = new Date(year, month - 1 + dir, 1)
    setMonth(date.getMonth() + 1)
    setYear(date.getFullYear())
  }

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const handleDeleteTransaction = async () => {
    if (!deletingTransaction) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/personal/transactions/${deletingTransaction.id}?transactionDate=${encodeURIComponent(deletingTransaction.transactionDate)}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        setDeletingTransaction(null)
        invalidateSummary()
      }
    } catch (error) {
      console.error("Failed to delete personal transaction", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32 pt-20">
      <PersonalTransactionModal
        isOpen={showModal || !!editingTransaction}
        onClose={() => {
          setShowModal(false)
          setEditingTransaction(null)
        }}
        onSuccess={invalidateSummary}
        transaction={editingTransaction}
      />
      <VoiceExpenseModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={invalidateSummary}
      />

      <div className="px-6 pt-8 pb-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t("personal.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("personal.subtitle", { name: session?.user?.name?.split(" ")[0] || "Your" })}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm mb-6">
          <button
            onClick={() => stepMonth(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-sm font-black text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
            {isCurrentMonth && (
              <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {t("common.current")}
              </span>
            )}
          </p>
          <button
            onClick={() => stepMonth(1)}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 max-w-4xl mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("common.loading")}</p>
          </div>
        ) : !summary ? null : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t("personal.stats.thisMonth")}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {formatCurrency(summary.totals.monthlyAmount)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {t("personal.stats.entries", { count: summary.totals.monthlyCount })}
                </p>
              </Card>
              <Card className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t("personal.stats.lifetime")}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {formatCurrency(summary.totals.lifetimeAmount)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {t("personal.stats.lifetimeEntries", { count: summary.totals.lifetimeCount })}
                </p>
              </Card>
            </div>

            {summary.monthlySummary.length > 0 && (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">{t("personal.trend")}</h3>
                <div className="flex items-end gap-2 h-24">
                  {summary.monthlySummary.map((item: { month: string; amount: number }) => {
                    const max = Math.max(...summary.monthlySummary.map((entry: { amount: number }) => entry.amount), 1)
                    const pct = (item.amount / max) * 100
                    const [summaryYear, summaryMonth] = item.month.split("-")
                    const label = new Date(Number(summaryYear), Number(summaryMonth) - 1).toLocaleString("default", { month: "short" })
                    const isActive = item.month === `${year}-${String(month).padStart(2, "0")}`

                    return (
                      <div key={item.month} className="flex flex-col items-center gap-1 flex-1">
                        <div className="w-full flex items-end justify-center h-16">
                          <div
                            className={`w-full rounded-t-lg transition-all ${isActive ? "bg-primary" : "bg-slate-100"}`}
                            style={{ height: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-tight text-slate-400">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {summary.categoryBreakdown.length > 0 ? (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">{t("personal.byCategory")}</h3>
                <div className="space-y-3">
                  {summary.categoryBreakdown.map((item: any) => {
                    const pct =
                      summary.totals.monthlyAmount > 0
                        ? (item.amount / summary.totals.monthlyAmount) * 100
                        : 0

                    return (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <CategoryIcon category={item.category} className="h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{item.label}</p>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {t("personal.categoryEntries", { count: item.count })}
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-black text-slate-900">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            ) : (
              <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <PieChart className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-slate-900">{t("personal.empty.title")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("personal.empty.description")}</p>
              </div>
            )}

            {summary.recentTransactions.length > 0 && (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t("personal.recent")}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t("personal.latestCount")}</p>
                </div>
                <div className="space-y-2">
                  {summary.recentTransactions.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                          <CategoryIcon category={transaction.category} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{transaction.description}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {new Date(transaction.transactionDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="text-sm font-black text-slate-900">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <button
                          onClick={() => setEditingTransaction(transaction)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${transaction.description}`}
                          title="Edit expense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTransaction(transaction)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
                          aria-label={`Delete ${transaction.description}`}
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        <div
          className={`fixed inset-0 z-[-1] transition-opacity duration-200 ${
            showExpenseMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setShowExpenseMenu(false)}
        />

        <div className="flex flex-col items-end gap-2 mb-1">
          <button
            onClick={() => { setShowExpenseMenu(false); setShowVoiceModal(true) }}
            className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-2.5 shadow-lg border border-slate-100 transition-all duration-300 ease-out origin-bottom-right ${
              showExpenseMenu
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-4 scale-90 pointer-events-none"
            }`}
            style={{ transitionDelay: showExpenseMenu ? "80ms" : "0ms" }}
          >
            <span className="text-sm font-semibold text-slate-700">{t("personal.fab.voiceNote")}</span>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Mic className="w-5 h-5 text-white" />
            </div>
          </button>
          <button
            onClick={() => { setShowExpenseMenu(false); setShowModal(true) }}
            className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-2.5 shadow-lg border border-slate-100 transition-all duration-300 ease-out origin-bottom-right ${
              showExpenseMenu
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-4 scale-90 pointer-events-none"
            }`}
            style={{ transitionDelay: showExpenseMenu ? "30ms" : "0ms" }}
          >
            <span className="text-sm font-semibold text-slate-700">{t("personal.fab.addExpense")}</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" strokeWidth={2.5} />
            </div>
          </button>
        </div>

        <Button
          onClick={() => setShowExpenseMenu(!showExpenseMenu)}
          size="icon"
          className="w-16 h-16 rounded-3xl shadow-xl shadow-primary/30 hover:scale-105 transition-all duration-200 pointer-events-auto"
        >
          <Plus
            className={`w-8 h-8 transition-transform duration-300 ease-in-out ${
              showExpenseMenu ? "rotate-[135deg]" : "rotate-0"
            }`}
            strokeWidth={2.5}
          />
        </Button>
      </div>

      <BottomNav active="personal" />

      <Modal
        isOpen={!!deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        title={t("personal.deleteModal.title")}
      >
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-600 text-center">
            {t("personal.deleteModal.description", { description: deletingTransaction?.description ?? "" })}
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 dark:bg-rose-500 dark:hover:bg-rose-600 dark:shadow-rose-500/20"
              onClick={handleDeleteTransaction}
              disabled={isDeleting}
            >
              {isDeleting ? t("common.deleting") : t("groupDetail.deleteModal.confirmDeleteExpense")}
            </button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-2xl text-base font-black border-slate-200"
              onClick={() => setDeletingTransaction(null)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
