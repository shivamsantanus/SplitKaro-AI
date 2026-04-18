"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/Card"
import { BottomNav } from "@/components/shared/BottomNav"
import { CategoryIcon } from "@/components/shared/CategoryIcon"
import { SoloExpenseModal } from "@/components/ui/SoloExpenseModal"
import {
  Users,
  Activity,
  User,
  Loader2,
  UserPlus,
  PieChart,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

function GroupsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  const [activeTab, setActiveTab] = useState<"groups" | "activity" | "people">("groups")
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [groupAnalytics, setGroupAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showSoloModal, setShowSoloModal] = useState(false)
  const [showSpending, setShowSpending] = useState(false)

  const totalBalance = groups.reduce((acc, g) => acc + (g.yourBalance || 0), 0)
  const toCollect = groups.reduce((acc, g) => acc + (g.yourBalance > 0 ? g.yourBalance : 0), 0)
  const toPay = groups.reduce((acc, g) => acc + (g.yourBalance < 0 ? Math.abs(g.yourBalance) : 0), 0)

  const consolidatedDebts: Record<string, { userId: string; name: string; amount: number }> = {}
  groups.forEach((group) => {
    group.debts?.forEach((debt: any) => {
      if (!consolidatedDebts[debt.userId]) {
        consolidatedDebts[debt.userId] = { ...debt }
      } else {
        consolidatedDebts[debt.userId].amount += debt.amount
      }
    })
  })
  const peopleList = Object.values(consolidatedDebts).filter((p) => Math.abs(p.amount) > 0.01)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups${showArchived ? "?archived=true" : ""}`)
      if (res.ok) setGroups(await res.json())
    } catch {
      console.error("Failed to fetch groups")
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true)
    try {
      const res = await fetch("/api/activities")
      if (res.ok) setActivities(await res.json())
    } catch {
      console.error("Failed to fetch activities")
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  const fetchGroupAnalytics = useCallback(async () => {
    setLoadingAnalytics(true)
    try {
      const res = await fetch("/api/analytics/groups")
      if (res.ok) setGroupAnalytics(await res.json())
    } catch {
      console.error("Failed to fetch group analytics")
    } finally {
      setLoadingAnalytics(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "activity" || tab === "people") {
      setActiveTab(tab)
      return
    }
    setActiveTab("groups")
  }, [searchParams])

  useEffect(() => {
    if (activeTab === "activity") fetchActivities()
  }, [activeTab, fetchActivities])

  useEffect(() => {
    const eventSource = new EventSource("/api/events")
    const handleUpdate = () => {
      fetchGroups()
      if (activeTab === "activity") fetchActivities()
    }
    eventSource.addEventListener("update", handleUpdate)
    return () => {
      eventSource.removeEventListener("update", handleUpdate)
      eventSource.close()
    }
  }, [activeTab, fetchActivities, fetchGroups])

  const navigateToTab = (tab: "groups" | "activity" | "people") => {
    setActiveTab(tab)
    router.push(tab === "groups" ? "/dashboard/groups" : `/dashboard/groups?tab=${tab}`)
  }

  const handleSpendingToggle = () => {
    if (!showSpending && !groupAnalytics) fetchGroupAnalytics()
    setShowSpending((v) => !v)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 pt-20">
      <SoloExpenseModal
        isOpen={showSoloModal}
        onClose={() => setShowSoloModal(false)}
        onSuccess={fetchGroups}
      />

      {/* Header */}
      <div className="px-6 pt-8 pb-4 max-w-4xl mx-auto w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeTab === "groups" && "Your expense groups"}
            {activeTab === "activity" && "Recent group activities"}
            {activeTab === "people" && "People you owe or owe you"}
          </p>
        </div>

        {/* Compact Balance Card */}
        <Card className="px-4 py-3 rounded-2xl border border-slate-100 bg-white shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-lg font-black leading-tight ${totalBalance >= 0 ? "text-primary" : "text-rose-600"}`}>
                {totalBalance >= 0
                  ? `You are owed ₹${totalBalance.toLocaleString()}`
                  : `You owe ₹${Math.abs(totalBalance).toLocaleString()}`}
              </p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                {toCollect > 0 ? `₹${toCollect.toLocaleString()} to collect` : "Nothing to collect"}
                {" • "}
                {toPay > 0 ? `₹${toPay.toLocaleString()} to pay` : "Nothing to pay"}
              </p>
            </div>
            <span
              className={`shrink-0 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                totalBalance > 0
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : totalBalance < 0
                  ? "bg-rose-50 text-rose-500 border border-rose-100"
                  : "bg-slate-50 text-slate-400 border border-slate-100"
              }`}
            >
              {totalBalance > 0 ? "Owed" : totalBalance < 0 ? "You Owe" : "Settled"}
            </span>
          </div>
        </Card>

        {/* Primary Action Row */}
        {activeTab === "groups" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowSoloModal(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs font-black text-primary transition-all hover:bg-primary/20 active:scale-95"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              Add Individual
            </button>
            <button
              onClick={() => router.push("/create-group")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-black text-white shadow-md shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
            >
              <Users className="w-4 h-4 shrink-0" />
              Create Group
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="px-6 pb-6 max-w-4xl mx-auto w-full">

        {/* Groups Tab */}
        {activeTab === "groups" && (
          <>
            <div className="flex items-center justify-between mb-3 mt-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Groups</p>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`rounded-xl border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  showArchived
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm"
                }`}
              >
                {showArchived ? "Archived" : "Show Archived"}
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 opacity-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading groups...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-3xl border border-dashed border-slate-200 bg-white">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">No groups yet</h3>
                <p className="text-xs text-slate-400 max-w-[200px]">
                  Create a group to start splitting expenses with friends.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => {
                  const balance = group.yourBalance || 0
                  const isOwed = balance > 0.01
                  const owes = balance < -0.01

                  return (
                    <Card
                      key={group.id}
                      className="px-4 py-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 rounded-2xl bg-white"
                      onClick={() => router.push(`/groups/${group.id}`)}
                    >
                      {/* Top row: name + badge */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{group.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Total spent ₹{group.totalSpent.toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            isOwed
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : owes
                              ? "bg-orange-50 text-orange-500 border border-orange-100"
                              : "bg-slate-50 text-slate-400 border border-slate-100"
                          }`}
                        >
                          {isOwed
                            ? `+₹${balance.toLocaleString()}`
                            : owes
                            ? `-₹${Math.abs(balance).toLocaleString()}`
                            : "Settled"}
                        </span>
                      </div>

                      {/* Bottom row: avatars + status label */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center -space-x-1.5">
                          {group.members.slice(0, 4).map((initial: string, idx: number) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600 shadow-sm"
                            >
                              {initial}
                            </div>
                          ))}
                          {group.members.length > 4 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500 shadow-sm">
                              +{group.members.length - 4}
                            </div>
                          )}
                        </div>
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            isOwed ? "text-emerald-600" : owes ? "text-orange-500" : "text-slate-400"
                          }`}
                        >
                          {isOwed ? "You are owed" : owes ? "You owe" : "Settled up"}
                        </p>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Inline Spending Toggle */}
            {groups.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={handleSpendingToggle}
                  className="flex items-center gap-2 w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-black text-slate-600 shadow-sm hover:shadow-md transition-all"
                >
                  <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                  <span className="flex-1 text-left">Spending Overview</span>
                  {showSpending ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {showSpending && (
                  <div className="mt-2">
                    {loadingAnalytics ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary opacity-30" />
                      </div>
                    ) : !groupAnalytics || groupAnalytics.categoryBreakdown.length === 0 ? (
                      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-8 text-center">
                        <p className="text-xs text-slate-400">No spending data yet</p>
                      </div>
                    ) : (
                      <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By Category</p>
                          <p className="text-[10px] font-black text-slate-400">
                            ₹{groupAnalytics.totals.totalPaid.toLocaleString()} total
                          </p>
                        </div>
                        {groupAnalytics.categoryBreakdown.map((item: any) => {
                          const pct =
                            groupAnalytics.totals.totalPaid > 0
                              ? (item.amount / groupAnalytics.totals.totalPaid) * 100
                              : 0
                          return (
                            <div key={item.category} className="space-y-1">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <CategoryIcon category={item.category} className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  <p className="truncate text-xs font-bold text-slate-900">{item.label}</p>
                                </div>
                                <p className="shrink-0 text-xs font-black text-slate-900">
                                  ₹{item.amount.toLocaleString()}
                                </p>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Activity Feed</p>
            {loadingActivities ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl border border-dashed border-slate-200 bg-white">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                  <Activity className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No activity yet</h3>
                <p className="text-xs text-slate-400 mt-1">Group expenses and settlements will appear here.</p>
              </div>
            ) : (
              activities.map((activity) => (
                <Card
                  key={activity.id}
                  className="p-4 border-slate-100 rounded-2xl flex gap-3 items-start bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                      activity.type.includes("EXPENSE")
                        ? "bg-primary/10 text-primary"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 font-medium leading-tight">{activity.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest">
                        {activity.group?.name || "Individual Payment"}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                        • {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {activity.metadata?.amount && (
                    <p className="text-sm font-black text-slate-900 shrink-0">₹{activity.metadata.amount}</p>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* People Tab */}
        {activeTab === "people" && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">People Overview</p>
            {peopleList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-slate-200 bg-white px-8">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
                  <User className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">All settled up</h3>
                <p className="text-xs text-slate-400 mt-1 mb-6 max-w-[200px]">
                  No pending balances. Invite friends to split expenses together.
                </p>
                <button
                  onClick={() => setShowSoloModal(true)}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black text-white shadow-md shadow-primary/20 transition-transform active:scale-95 hover:opacity-90"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite a new friend
                </button>
              </div>
            ) : (
              peopleList.map((person) => (
                <Card
                  key={person.userId}
                  className="group flex flex-col gap-3 rounded-2xl border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {person.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{person.name}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Global Balance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="sm:text-right">
                      <p className={`text-base font-black ${person.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {person.amount > 0
                          ? `+₹${person.amount.toLocaleString()}`
                          : `-₹${Math.abs(person.amount).toLocaleString()}`}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                        {person.amount > 0 ? "owes you" : "you owe"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const sharedGroup = groups.find((g) =>
                          g.debts.some((d: any) => d.userId === person.userId)
                        )
                        if (sharedGroup) router.push(`/groups/${sharedGroup.id}`)
                      }}
                      className="rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                      Settle
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tab bar — 3 tabs */}
      <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto mx-4 flex gap-1 rounded-2xl border border-slate-100 bg-white/90 backdrop-blur px-2 py-1.5 shadow-lg">
          {(["groups", "activity", "people"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => navigateToTab(tab)}
              className={`rounded-xl px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <BottomNav active="groups" />
    </div>
  )
}

export default function GroupsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <GroupsContent />
    </Suspense>
  )
}
