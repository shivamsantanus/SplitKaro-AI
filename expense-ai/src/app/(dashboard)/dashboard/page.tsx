"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { Loader2, Users, ArrowRight, Wallet } from "lucide-react"

function OverviewContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/analytics/overview")
      if (res.ok) setOverview(await res.json())
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 pt-20">
      <div className="px-6 pt-8 pb-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Hello, {session?.user?.name?.split(" ")[0] || "User"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{monthLabel} overview</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary border-2 border-white shadow-sm flex items-center justify-center text-white font-bold">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "U"}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading overview...</p>
          </div>
        ) : !overview ? null : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/dashboard/personal")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personal</p>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  ₹{overview.personal.thisMonthAmount.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">
                  {overview.personal.thisMonthCount} entries this month
                </p>
              </Card>

              <Card
                className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/dashboard/groups")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Groups</p>
                </div>
                <p
                  className={`text-2xl font-black ${
                    overview.groups.netBalance >= 0 ? "text-primary" : "text-rose-600"
                  }`}
                >
                  {overview.groups.netBalance >= 0 ? "+" : "-"}₹
                  {Math.abs(overview.groups.netBalance).toLocaleString()}
                </p>
                <p className="text-xs font-medium text-slate-400 mt-1">
                  {overview.groups.netBalance >= 0 ? "net owed to you" : "net you owe"}
                </p>
              </Card>
            </div>

            {/* Top Groups */}
            {overview.groups.topGroups.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Top Groups</h2>
                  <button
                    onClick={() => router.push("/dashboard/groups")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {overview.groups.topGroups.map((g: any) => (
                    <Card
                      key={g.groupId}
                      className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">{g.groupName}</p>
                      </div>
                      <p className="text-sm font-black text-slate-900">₹{g.totalPaid.toLocaleString()}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Group Expenses */}
            {overview.groups.recentExpenses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                    Recent Group Expenses
                  </h2>
                  <button
                    onClick={() => router.push("/dashboard/groups")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {overview.groups.recentExpenses.map((exp: any) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 bg-primary/5 rounded-xl flex items-center justify-center">
                          <CategoryIcon category={exp.category} className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{exp.description}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {exp.group?.name}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-slate-900 shrink-0">
                        ₹{exp.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Personal Transactions */}
            {overview.personal.recentTransactions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                    Recent Personal
                  </h2>
                  <button
                    onClick={() => router.push("/dashboard/personal")}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {overview.personal.recentTransactions.map((txn: any) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center">
                          <CategoryIcon category={txn.category} className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{txn.description}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {new Date(txn.transactionDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-slate-900 shrink-0">
                        ₹{txn.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <OverviewContent />
    </Suspense>
  )
}
