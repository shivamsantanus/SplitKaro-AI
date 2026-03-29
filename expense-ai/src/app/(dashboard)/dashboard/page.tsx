"use client"

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Plus, Users, Activity, User, Home, Search, Loader2, UserPlus } from "lucide-react"
import { SoloExpenseModal } from "@/components/ui/SoloExpenseModal"

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<"groups" | "activity" | "people">("groups")
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
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

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    const tab = searchParams.get("tab")

    if (tab === "groups" || tab === "activity" || tab === "people") {
      setActiveTab(tab)
      return
    }

    setActiveTab("groups")
  }, [searchParams])

  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivities()
    }
  }, [activeTab, fetchActivities])

  useEffect(() => {
    const eventSource = new EventSource("/api/events")

    const handleUpdate = () => {
      fetchGroups()

      if (activeTab === "activity") {
        fetchActivities()
      }
    }

    eventSource.addEventListener("update", handleUpdate)

    return () => {
      eventSource.removeEventListener("update", handleUpdate)
      eventSource.close()
    }
  }, [activeTab, fetchActivities, fetchGroups])

  const navigateToTab = (tab: "groups" | "activity" | "people") => {
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">Your Groups</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSoloModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/20 transition-all border border-primary/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Individual
                  </button>
                  <button 
                    onClick={() => setShowArchived(!showArchived)}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all ${
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

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                      <div className="flex items-center -space-x-2">
                        {group.members.slice(0, 3).map((initial: string, idx: number) => (
                          <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">{initial}</div>
                        ))}
                        {group.members.length > 3 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">+{group.members.length - 3}</div>
                        )}
                      </div>

                      <p className={`text-sm font-bold ${group.yourBalance > 0 ? "text-primary" : group.yourBalance < 0 ? "text-rose-600" : "text-slate-400"}`}>
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
                       <Card key={person.userId} className="p-4 border-slate-100 rounded-2xl flex items-center justify-between bg-white shadow-sm group">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {person.name.substring(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <h3 className="font-bold text-slate-900">{person.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Balance</p>
                             </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
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
                                className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-slate-900/10"
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
