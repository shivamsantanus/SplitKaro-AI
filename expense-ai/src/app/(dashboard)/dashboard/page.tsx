"use client"

export const dynamic = "force-dynamic"

import { Suspense, useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { Card } from "@/components/ui/Card"
import { VoiceExpenseModal } from "@/components/ui/VoiceExpenseModal"
import { formatCurrency } from "@/lib/currency"
import { ArrowRight, HandCoins, Handshake, Wallet } from "lucide-react"
import { RupeeSpinner } from "@/components/ui/RupeeSpinner"
import { useLanguage } from "@/contexts/LanguageContext"
import { useOverviewQuery } from "@/hooks/queries/useAnalytics"
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation"

type PersonalActivityItem = {
  id: string
  description: string
  amount: number
  category: string
  type: "INCOME" | "EXPENSE"
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
    incomeMonthly: number
    netMonthly: number
    savingsRate: number
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
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/welcome")
  }, [status, router])
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: overview, isLoading: loading } = useOverviewQuery()
  const [activityView, setActivityView] = useState<"personal" | "groups">("personal")
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  useRealtimeInvalidation()

  const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" })
  const personalActivity = overview?.personal.recentTransactions ?? []
  const groupActivity = overview?.groups.recentActivity ?? []

  return (
    <div className="min-h-screen bg-background pb-32 pt-20">
      <VoiceExpenseModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["analytics"] })}
      />

      <div className="mx-auto max-w-4xl px-6 pb-6 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {t("dashboard.greeting", { name: session?.user?.name?.split(" ")[0] || "User" })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("dashboard.subtitle", { month: monthLabel })}</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 opacity-40">
            <RupeeSpinner className="h-8 w-8 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t("dashboard.loading")}
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
                    {t("personal.stats.net")}
                  </p>
                </div>
                <p
                  className={`text-xl font-black sm:text-2xl ${
                    overview.personal.netMonthly >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {overview.personal.netMonthly >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(overview.personal.netMonthly))}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {Math.round(overview.personal.savingsRate * 100)}% · {t("personal.stats.savingsRate")}
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
                    {t("dashboard.groupTotal")}
                  </p>
                </div>
                <p className="text-xl font-black text-slate-900 sm:text-2xl">
                  {formatCurrency(overview.groups.totalPaid)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {t("dashboard.groupExpenses", { count: overview.groups.expenseCount })}
                </p>
              </Card>
            </div>

            <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                    {t("dashboard.recentActivity")}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {t("dashboard.recentDescription")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    router.push(activityView === "personal" ? "/dashboard/personal" : "/dashboard/groups")
                  }
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary"
                >
                  {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
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
                    {t(`dashboard.tabs.${view}`)}
                  </button>
                ))}
              </div>

              {activityView === "personal" ? (
                personalActivity.length > 0 ? (
                  <div className="space-y-2">
                    {personalActivity.map((txn: PersonalActivityItem) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ${
                              txn.type === "INCOME" ? "text-emerald-500" : "text-primary"
                            }`}
                          >
                            <CategoryIcon type={txn.type} category={txn.category} className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{txn.description}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {new Date(txn.transactionDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-black ${
                            txn.type === "INCOME"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-900"
                          }`}
                        >
                          {formatCurrency(txn.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-bold text-slate-900">{t("dashboard.empty.personal")}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {t("dashboard.empty.personalDescription")}
                    </p>
                  </div>
                )
              ) : groupActivity.length > 0 ? (
                <div className="space-y-2">
                  {groupActivity.map((item: any) => (
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
                  <p className="text-sm font-bold text-slate-900">{t("dashboard.empty.groups")}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("dashboard.empty.groupsDescription")}
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <BottomNav active="overview" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <RupeeSpinner className="h-8 w-8 text-primary" />
        </div>
      }
    >
      <OverviewContent />
    </Suspense>
  )
}
