"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Plus, Users, Activity, User, Home, Search, Loader2 } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Calculate total balance from all groups
  const totalBalance = groups.reduce((acc, group) => acc + (group.yourBalance || 0), 0)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch("/api/groups")
        if (response.ok) {
          const data = await response.json()
          setGroups(data)
        }
      } catch (err) {
        console.error("Failed to fetch groups")
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [])

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="">
            <h1 className="text-2xl font-bold text-slate-900">
              Hello, {session?.user?.name?.split(' ')[0] || "User"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Your expenses overview
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary border-2 border-white shadow-sm flex items-center justify-center text-white font-bold transition-all hover:scale-105">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "U"}
          </div>
        </div>

        {/* Balance Summary Card */}
        <Card className="p-6 rounded-3xl shadow-md border border-slate-200/50 bg-white overflow-hidden relative group hover:shadow-lg transition-all">
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-tight">
              Total Balance
            </p>
            <p className={`text-4xl font-bold ${totalBalance >= 0 ? "text-primary" : "text-rose-600"}`}>
              {totalBalance >= 0
                ? `You are owed ₹${totalBalance}`
                : `You owe ₹${Math.abs(totalBalance)}`}
            </p>
          </div>
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
             <Activity className="w-24 h-24" />
          </div>
        </Card>
      </div>

      {/* Groups Section */}
      <div className="px-6 pb-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">
            Groups
          </h2>
          <Button variant="ghost" size="sm" className="text-primary font-bold">
            View all
          </Button>
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
          <div className="space-y-4">
            {groups.map((group, idx) => (
              <Card
                key={group.id}
                className="p-5 shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 rounded-3xl bg-white group"
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
                  {/* Members Avatars */}
                  <div className="flex items-center -space-x-2">
                    {group.members.slice(0, 3).map((initial: string, idx: number) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm"
                      >
                        {initial}
                      </div>
                    ))}
                    {group.members.length > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                        +{group.members.length - 3}
                      </div>
                    )}
                  </div>

                  {/* Balance Text */}
                  <p
                    className={`text-sm font-bold ${
                      group.yourBalance > 0
                        ? "text-primary"
                        : group.yourBalance < 0
                          ? "text-rose-600"
                          : "text-slate-400"
                    }`}
                  >
                    {group.yourBalance > 0
                      ? `You are owed ₹${group.yourBalance}`
                      : group.yourBalance < 0
                        ? `You owe ₹${Math.abs(group.yourBalance)}`
                        : "Settled up"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-28 right-6">
        <Button
          onClick={() => router.push("/create-group")}
          size="icon"
          className="w-16 h-16 rounded-3xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
        >
          <Plus className="w-8 h-8 stroke-[3]" />
        </Button>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-2xl z-50">
        <div className="flex items-center justify-around px-6 py-4 max-w-lg mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary group">
            <div className="p-1 rounded-xl bg-primary/10 transition-colors">
               <Home className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold leading-none">Groups</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors group">
            <div className="p-1 rounded-xl hover:bg-slate-50 transition-colors">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold leading-none">Activity</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors group">
            <div className="p-1 rounded-xl hover:bg-slate-50 transition-colors">
               <User className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold leading-none">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
