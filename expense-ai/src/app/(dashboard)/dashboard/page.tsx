"use client"

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Plus, Users, Activity, User, Home, Loader2, UserPlus, PieChart, UtensilsCrossed, Bus, ShoppingBasket, Clapperboard, Plane, House, ShoppingBag, Receipt, HeartPulse, Wallet } from "lucide-react"
import { SoloExpenseModal } from "@/components/ui/SoloExpenseModal"
import { getExpenseCategoryIconName } from "@/lib/expense-categories"

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const iconName = getExpenseCategoryIconName(category)

  switch (iconName) {
    case "food":
      return <UtensilsCrossed className={className} />
    case "transport":
      return <Bus className={className} />
    case "groceries":
      return <ShoppingBasket className={className} />
    case "entertainment":
      return <Clapperboard className={className} />
    case "travel":
      return <Plane className={className} />
    case "rent":
      return <House className={className} />
    case "shopping":
      return <ShoppingBag className={className} />
    case "bills":
      return <Receipt className={className} />
    case "health":
      return <HeartPulse className={className} />
    default:
      return <Wallet className={className} />
  }
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<"groups" | "activity" | "people" | "spending">("groups")
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [spendingSummary, setSpendingSummary] = useState<any>(null)
  const [loadingSpendingSummary, setLoadingSpendingSummary] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showSoloModal, setShowSoloModal] = useState(false)

  // Calculate total balance from all groups (including solo)
  const totalBalance = groups.reduce((acc, group) => acc + (group.yourBalance || 0), 0)

  // Calculate global pairwise debts (People Tab)
  const consolidatedDebts: Record<string, { userId: string, name: string, amount: number }> = {}
  groups.forEach(group => {
    group.debts?.forEach((debt: any) => {
      if (!consolidatedDebts[debt.userId]) {
        consolidatedDebts[debt.userId] = { ...debt }
      } else {
        consolidatedDebts[debt.userId].amount += debt.amount
      }
    })
  })
  const peopleList = Object.values(consolidatedDebts).filter(p => Math.abs(p.amount) > 0.01)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/groups${showArchived ? "?archived=true" : ""}`)
      if (response.ok) {
        const data = await response.json()
        setGroups(data)
      }
    } catch (err) {
      console.error("Failed to fetch groups")
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true)
    try {
      const response = await fetch("/api/activities")
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      }
    } catch (err) {
      console.error("Failed to fetch activities")
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  const fetchSpendingSummary = useCallback(async () => {
    setLoadingSpendingSummary(true)
    try {
      const response = await fetch("/api/spending-summary")
      if (response.ok) {
        const data = await response.json()
        setSpendingSummary(data)
      }
    } catch (err) {
      console.error("Failed to fetch spending summary")
    } finally {
      setLoadingSpendingSummary(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    const tab = searchParams.get("tab")

    if (tab === "groups" || tab === "activity" || tab === "people" || tab === "spending") {
      setActiveTab(tab)
      return
    }

    setActiveTab("groups")
  }, [searchParams])

  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivities()
    }
    if (activeTab === "spending") {
      fetchSpendingSummary()
    }
  }, [activeTab, fetchActivities, fetchSpendingSummary])

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    const handleUpdate = () => {
      fetchGroups()

      if (activeTab === "activity") {
        fetchActivities()
      }

      if (activeTab === "spending") {
        fetchSpendingSummary()
      }
    }

    eventSource.addEventListener("update", handleUpdate)

    return () => {
      eventSource.removeEventListener("update", handleUpdate)
      eventSource.close()
    }
  }, [activeTab, fetchActivities, fetchGroups, fetchSpendingSummary])

  const navigateToTab = (tab: "groups" | "activity" | "people" | "spending") => {
    setActiveTab(tab)
    router.push(tab === "groups" ? "/dashboard" : `/dashboard?tab=${tab}`)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 pt-20">
      <SoloExpenseModal 
        isOpen={showSoloModal} 
        onClose={() => setShowSoloModal(false)}
        onSuccess={fetchGroups}
      />
      {/* Header */}
      <div className="px-6 pt-8 pb-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="">
            <h1 className="text-2xl font-bold text-slate-900">
              Hello, {session?.user?.name?.split(' ')[0] || "User"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === "groups" && "Your expense groups"}
              {activeTab === "activity" && "Recent group activities"}
              {activeTab === "people" && "People you owe or owe you"}
              {activeTab === "spending" && "Track what you spend across groups and individual payments"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary border-2 border-white shadow-sm flex items-center justify-center text-white font-bold transition-all hover:scale-105">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "U"}
          </div>
        </div>

        {/* Balance Summary Card - Only show on main tabs */}
        {activeTab !== "activity" && (
           <Card className="p-6 rounded-3xl shadow-md border border-slate-200/50 bg-white overflow-hidden relative group hover:shadow-lg transition-all">
             <div className="relative z-10">
               <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-tight">
                 Total Balance
               </p>
               <p className={`text-4xl font-bold ${totalBalance >= 0 ? "text-primary" : "text-rose-600"}`}>
                 {totalBalance >= 0
                   ? `You are owed ₹${totalBalance.toLocaleString()}`
                   : `You owe ₹${Math.abs(totalBalance).toLocaleString()}`}
               </p>
             </div>
             {/* Subtle decoration */}
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Activity className="w-24 h-24" />
             </div>
           </Card>
        )}
      </div>

      {/* Main Content Area */}
      <div className="px-6 pb-6 max-w-4xl mx-auto w-full">

        {activeTab === "groups" && (
           <>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-black text-slate-900">Your Groups</h2>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button 
                    onClick={() => setShowSoloModal(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Individual
                  </button>
                  <button 
                    onClick={() => setShowArchived(!showArchived)}
                    className={`rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                        showArchived ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm"
                    }`}
                  >
                    {showArchived ? "Showing Archived" : "Show Archived"}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
                 <div className="flex flex-col items-center justify-center py-12 space-y-4 opacity-50">
                   <Loader2 className="w-8 h-8 animate-spin text-primary" />
                   <p className="text-sm font-medium text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading groups...</p>
                 </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                   <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                     <Users className="w-10 h-10" />
                   </div>
                   <h3 className="text-lg font-bold text-slate-900 mb-2">No groups yet</h3>
                   <p className="text-slate-500 text-sm max-w-[240px] mb-8">
                     Create a group to start splitting expenses with your friends.
                   </p>
                   <Button onClick={() => router.push("/create-group")} className="rounded-2xl px-8 shadow-md">
                     <Plus className="w-4 h-4 mr-2 stroke-[3]" />
                     Create Group
                   </Button>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    className="p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100 rounded-[2rem] bg-white group flex flex-col h-full"
                    onClick={() => router.push(`/groups/${group.id}`)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Users className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg group-hover:text-primary transition-colors">
                            {group.name}
                          </h3>
                          <p className="text-sm text-slate-400">Total spent: ₹{group.totalSpent.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-3 border-t border-slate-50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center -space-x-2">
                        {group.members.slice(0, 3).map((initial: string, idx: number) => (
                          <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">{initial}</div>
                        ))}
                        {group.members.length > 3 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">+{group.members.length - 3}</div>
                        )}
                      </div>

                      <p className={`text-sm font-bold sm:text-right ${group.yourBalance > 0 ? "text-primary" : group.yourBalance < 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {group.yourBalance > 0 ? `You are owed ₹${group.yourBalance.toLocaleString()}` : group.yourBalance < 0 ? `You owe ₹${Math.abs(group.yourBalance).toLocaleString()}` : "Settled up"}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
           </>
        )}

        {activeTab === "activity" && (
           <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Activity Feed</h2>
              {loadingActivities ? (
                 <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>
              ) : activities.length === 0 ? (
                 <div className="text-center py-12 text-slate-400">No activity yet.</div>
              ) : (
                 <div className="space-y-3">
                    {activities.map((activity) => (
                       <Card key={activity.id} className="p-4 border-slate-100 rounded-2xl flex gap-4 items-start bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                             activity.type.includes("EXPENSE") ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                          }`}>
                             <Activity className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm text-slate-900 font-medium leading-tight">{activity.message}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                 <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest">
                                    {activity.group?.name || "Individual Payment"}
                                 </span>
                                 <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">• {new Date(activity.createdAt).toLocaleDateString()}</span>
                              </div>
                          </div>
                          {activity.metadata?.amount && (
                             <div className="text-sm font-black text-slate-900">₹{activity.metadata.amount}</div>
                          )}
                       </Card>
                    ))}
                 </div>
              )}
           </div>
        )}

        {activeTab === "people" && (
           <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-4">People Overview</h2>
              {peopleList.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><User className="w-8 h-8" /></div>
                    <h3 className="font-bold text-slate-900">Nicely done!</h3>
                    <p className="text-sm text-slate-400 mt-1">You are settled up with everyone across all groups.</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 gap-3">
                    {peopleList.map((person) => (
                       <Card key={person.userId} className="group flex flex-col gap-4 rounded-2xl border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {person.name.substring(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <h3 className="font-bold text-slate-900">{person.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Balance</p>
                             </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:items-end sm:text-right">
                             <div>
                                <p className={`text-lg font-black ${person.amount > 0 ? "text-primary" : "text-rose-600"}`}>
                                   {person.amount > 0 ? `+₹${person.amount.toLocaleString()}` : `-₹${Math.abs(person.amount).toLocaleString()}`}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                   {person.amount > 0 ? "owes you" : "you owe"}
                                </p>
                             </div>
                             <button 
                                onClick={() => {
                                   const sharedGroup = groups.find(g => g.debts.some((d:any) => d.userId === person.userId));
                                   if (sharedGroup) router.push(`/groups/${sharedGroup.id}`);
                                }}
                                className="self-start rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 transition-all hover:scale-105 active:scale-95 sm:self-end"
                             >
                                Settle
                             </button>
                          </div>
                       </Card>
                    ))}
                 </div>
              )}
           </div>
        )}

        {activeTab === "spending" && (
           <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900">Spending Summary</h2>
                <button
                  onClick={fetchSpendingSummary}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:text-slate-700"
                >
                  Refresh
                </button>
              </div>

              {loadingSpendingSummary ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>
              ) : !spendingSummary || spendingSummary.categories.length === 0 ? (
                <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <PieChart className="h-8 w-8" />
                  </div>
                  <h3 className="font-bold text-slate-900">No spending data yet</h3>
                  <p className="mt-1 text-sm text-slate-400">Add a group or individual expense to start seeing category insights.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="rounded-3xl border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Total Paid</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">₹{spendingSummary.totals.total.toLocaleString()}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">{spendingSummary.totals.count} expense entries</p>
                    </Card>
                    <Card className="rounded-3xl border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Group Spend</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">₹{spendingSummary.totals.group.toLocaleString()}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">Shared group expenses you paid</p>
                    </Card>
                    <Card className="rounded-3xl border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Individual Spend</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">₹{spendingSummary.totals.solo.toLocaleString()}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">Direct payments to friends</p>
                    </Card>
                  </div>

                  <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Top Category</p>
                        <div className="mt-2 flex items-center gap-2">
                          {spendingSummary.topCategory && <CategoryIcon category={spendingSummary.topCategory.category} className="h-5 w-5 text-primary" />}
                          <h3 className="text-lg font-black text-slate-900">{spendingSummary.topCategory?.label ?? "Other"}</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-slate-900">₹{(spendingSummary.topCategory?.total ?? 0).toLocaleString()}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{spendingSummary.topCategory?.count ?? 0} entries</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {spendingSummary.categories.map((item: any) => {
                        const percentage = spendingSummary.totals.total > 0 ? (item.total / spendingSummary.totals.total) * 100 : 0

                        return (
                          <div key={item.category} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <CategoryIcon category={item.category} className="h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">{item.label}</p>
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Group ₹{item.group.toLocaleString()} • Individual ₹{item.solo.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <p className="shrink-0 text-sm font-black text-slate-900">₹{item.total.toLocaleString()}</p>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percentage, 100)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  <Card className="rounded-[2rem] border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-slate-900">Recent Payments</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Latest 6</p>
                    </div>
                    <div className="space-y-3">
                      {spendingSummary.recentExpenses.map((expense: any) => (
                        <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                              <CategoryIcon category={expense.category} className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{expense.description}</p>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {expense.group?.name || "Individual Payment"} • {new Date(expense.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-black text-slate-900">₹{expense.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}
           </div>
        )}
      </div>

      {/* Floating Action Button - Only on Groups Tab */}
      {activeTab === "groups" && (
         <div className="fixed bottom-28 right-6 z-40">
           <Button
             onClick={() => router.push("/create-group")}
             size="icon"
             className="w-16 h-16 rounded-3xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
           >
             <Plus className="w-8 h-8 stroke-[3]" />
           </Button>
         </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 shadow-[-1px_-5px_20px_-10px_rgba(0,0,0,0.1)] z-50 px-4 py-2.5 pb-safe md:pb-4">
        <div className="flex items-center justify-around max-w-2xl mx-auto">
          <button 
            onClick={() => navigateToTab("groups")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "groups" ? "text-primary" : "text-slate-400 opacity-70"}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === "groups" ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"}`}>
               <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Groups</span>
          </button>
          
          <button 
            onClick={() => navigateToTab("activity")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "activity" ? "text-primary" : "text-slate-400 opacity-70"}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === "activity" ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"}`}>
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Activity</span>
          </button>
          
          <button 
            onClick={() => navigateToTab("people")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "people" ? "text-primary" : "text-slate-400 opacity-70"}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === "people" ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"}`}>
               <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">People</span>
          </button>
          
          <button 
            onClick={() => navigateToTab("spending")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "spending" ? "text-primary" : "text-slate-400 opacity-70"}`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === "spending" ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"}`}>
               <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Spend</span>
          </button>

          <button 
            onClick={() => router.push("/me")}
            className="flex flex-col items-center gap-1 text-slate-400 opacity-70 transition-all hover:text-primary"
          >
            <div className="p-2 rounded-xl hover:bg-slate-50">
               <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">Me</span>
          </button>
        </div>
      </div>
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
      <DashboardContent />
    </Suspense>
  )
}
