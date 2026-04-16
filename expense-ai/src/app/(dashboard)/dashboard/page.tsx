"use client"

export const dynamic = "force-dynamic"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { Card } from "@/components/ui/Card"
import { VoiceExpenseModal } from "@/components/ui/VoiceExpenseModal"
import { formatCurrency } from "@/lib/currency"
import { ArrowRight, HandCoins, Handshake, Loader2, Mic, Wallet } from "lucide-react"

type PersonalActivityItem = {
  id: string
  description: string
  amount: number
  category: string
  transactionDate: string
}

type GroupExpenseActivityItem = {
  id: string
  type: "EXPENSE"
  description: string
  amount: number
  category: string
  createdAt: string
  group?: { id: string; name: string } | null
  payer?: { id: string; name: string | null } | null
}

type GroupSettlementActivityItem = {
  id: string
  type: "SETTLEMENT"
  amount: number
  createdAt: string
  group?: { id: string; name: string } | null
  payer?: { id: string; name: string | null; email?: string | null } | null
  receiver?: { id: string; name: string | null; email?: string | null } | null
}

type OverviewResponse = {
  personal: {
    thisMonthAmount: number
    thisMonthCount: number
    lifetimeAmount: number
    lifetimeCount: number
    recentTransactions: PersonalActivityItem[]
  }
  groups: {
    totalPaid: number
    totalOwed: number
    netBalance: number
    expenseCount: number
    recentActivity: Array<GroupExpenseActivityItem | GroupSettlementActivityItem>
  }
}

function OverviewContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activityView, setActivityView] = useState<"personal" | "groups">("personal")
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/analytics/overview")
      if (res.ok) {
        setOverview(await res.json())
      }
    } catch {
      console.error("Failed to fetch overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" })
  const personalActivity = overview?.personal.recentTransactions ?? []
  const groupActivity = overview?.groups.recentActivity ?? []

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 pt-20">
      <VoiceExpenseModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={fetchOverview}
      />

      <div className="mx-auto max-w-4xl px-6 pb-6 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Hello, {session?.user?.name?.split(" ")[0] || "User"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{monthLabel} overview</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-primary font-bold text-white shadow-sm">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "U"}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 opacity-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Loading overview...
            </p>
          </div>
        ) : !overview ? null : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="cursor-pointer rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                onClick={() => router.push("/dashboard/personal")}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Personal Total
                  </p>
                </div>
                <p className="text-xl font-black text-slate-900 sm:text-2xl">
                  {formatCurrency(overview.personal.lifetimeAmount)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {overview.personal.lifetimeCount} personal entries
                </p>
              </Card>

              <Card
                className="cursor-pointer rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                onClick={() => router.push("/dashboard/groups")}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Handshake className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Group Total
                  </p>
                </div>
                <p className="text-xl font-black text-slate-900 sm:text-2xl">
                  {formatCurrency(overview.groups.totalPaid)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {overview.groups.expenseCount} group expenses
                </p>
              </Card>
            </div>

            <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                    Recent Activity
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Toggle between personal entries and group transactions.
                  </p>
                </div>
                <button
                  onClick={() =>
                    router.push(activityView === "personal" ? "/dashboard/personal" : "/dashboard/groups")
                  }
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="mb-4 inline-flex rounded-2xl border border-slate-100 bg-slate-50 p-1">
                {(["personal", "groups"] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setActivityView(view)}
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                      activityView === view
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              {activityView === "personal" ? (
                personalActivity.length > 0 ? (
                  <div className="space-y-2">
                    {personalActivity.map((txn) => (
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
                          {formatCurrency(txn.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-bold text-slate-900">No personal activity yet</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Your latest individual expenses will show here.
                    </p>
                  </div>
                )
              ) : groupActivity.length > 0 ? (
                <div className="space-y-2">
                  {groupActivity.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                            item.type === "EXPENSE"
                              ? "bg-white text-primary"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.type === "EXPENSE" ? (
                            <CategoryIcon category={item.category} className="h-4 w-4" />
                          ) : (
                            <HandCoins className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {item.type === "EXPENSE"
                              ? item.description
                              : `${item.payer?.name || item.payer?.email || "Someone"} paid ${
                                  item.receiver?.name || item.receiver?.email || "someone"
                                }`}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {item.group?.name || "Group"} • {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-black text-slate-900">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-bold text-slate-900">No group activity yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Group expenses and settlements will show here.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowVoiceModal(true)}
        className="fixed bottom-28 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Add personal expense with voice"
        title="Nightly voice entry"
      >
        <Mic className="h-7 w-7" />
      </button>

      <BottomNav active="overview" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OverviewContent />
    </Suspense>
  )
}
