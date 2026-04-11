"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { PersonalTransactionModal } from "@/components/ui/PersonalTransactionModal"
import { VoiceExpenseModal } from "@/components/ui/VoiceExpenseModal"
import { Loader2, Plus, Mic, ChevronLeft, ChevronRight, PieChart } from "lucide-react"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function PersonalPage() {
  const { data: session } = useSession()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/personal/summary?month=${month}&year=${year}`)
      if (res.ok) setSummary(await res.json())
    } catch {
      console.error("Failed to fetch personal summary")
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const stepMonth = (dir: 1 | -1) => {
    const d = new Date(year, month - 1 + dir, 1)
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())
  }

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 pt-20">
      <PersonalTransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchSummary}
      />
      <VoiceExpenseModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={fetchSummary}
      />

      {/* Header */}
      <div className="px-6 pt-8 pb-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Personal Expenses</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session?.user?.name?.split(" ")[0] || "Your"}'s spending tracker
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary border-2 border-white shadow-sm flex items-center justify-center text-white font-bold">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "U"}
          </div>
        </div>

        {/* Month selector */}
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
                Current
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
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading...</p>
          </div>
        ) : !summary ? null : (
          <>
            {/* Monthly totals */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">This Month</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  ₹{summary.totals.monthlyAmount.toLocaleString()}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {summary.totals.monthlyCount} entries
                </p>
              </Card>
              <Card className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Lifetime</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  ₹{summary.totals.lifetimeAmount.toLocaleString()}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {summary.totals.lifetimeCount} total entries
                </p>
              </Card>
            </div>

            {/* 6-month trend */}
            {summary.monthlySummary.length > 0 && (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">6-Month Trend</h3>
                <div className="flex items-end gap-2 h-24">
                  {summary.monthlySummary.map((item: { month: string; amount: number }) => {
                    const max = Math.max(...summary.monthlySummary.map((m: { amount: number }) => m.amount), 1)
                    const pct = (item.amount / max) * 100
                    const [y, m] = item.month.split("-")
                    const label = new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "short" })
                    const isActive = item.month === `${year}-${String(month).padStart(2, "0")}`

                    return (
                      <div key={item.month} className="flex flex-col items-center gap-1 flex-1">
                        <div className="w-full flex items-end justify-center h-16">
                          <div
                            className={`w-full rounded-t-lg transition-all ${
                              isActive ? "bg-primary" : "bg-slate-100"
                            }`}
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

            {/* Category breakdown */}
            {summary.categoryBreakdown.length > 0 ? (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">By Category</h3>
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
                                {item.count} entries
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-black text-slate-900">
                            ₹{item.amount.toLocaleString()}
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
                <h3 className="font-bold text-slate-900">No expenses this month</h3>
                <p className="mt-1 text-sm text-slate-400">Tap + to add your first personal expense.</p>
              </div>
            )}

            {/* Recent transactions */}
            {summary.recentTransactions.length > 0 && (
              <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Recent</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Latest 8</p>
                </div>
                <div className="space-y-2">
                  {summary.recentTransactions.map((txn: any) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                          <CategoryIcon category={txn.category} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{txn.description}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {new Date(txn.transactionDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-black text-slate-900">
                        ₹{txn.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* FABs — voice (primary) + manual (secondary) */}
      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-center gap-3">
        <Button
          onClick={() => setShowModal(true)}
          size="icon"
          className="w-12 h-12 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform bg-white border border-slate-200 text-primary hover:bg-slate-50"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
        </Button>
        <Button
          onClick={() => setShowVoiceModal(true)}
          size="icon"
          className="w-16 h-16 rounded-3xl shadow-xl shadow-primary/30 hover:scale-105 transition-transform"
        >
          <Mic className="w-7 h-7" />
        </Button>
      </div>

      <BottomNav active="personal" />
    </div>
  )
}
