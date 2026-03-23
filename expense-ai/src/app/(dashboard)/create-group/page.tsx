"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { 
  ArrowLeft, 
  Users, 
  MapPin, 
  Home, 
  ShoppingBag, 
  UtensilsCrossed 
} from "lucide-react"
import { cn } from "@/lib/utils"

const groupTypes = [
  { id: "trip", name: "Trip", icon: MapPin, color: "text-blue-500", bg: "bg-blue-50" },
  { id: "home", name: "Home", icon: Home, color: "text-rose-500", bg: "bg-rose-50" },
  { id: "lunch", name: "Lunch", icon: UtensilsCrossed, color: "text-amber-500", bg: "bg-amber-50" },
  { id: "other", name: "Other", icon: ShoppingBag, color: "text-slate-500", bg: "bg-slate-50" },
]

export default function CreateGroupPage() {
  const router = useRouter()
  const [groupName, setGroupName] = useState("")
  const [selectedType, setSelectedType] = useState("trip")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      })

      if (response.ok) {
        const group = await response.json()
        router.push(`/dashboard`) 
      } else {
        const data = await response.json()
        setError(data.message || "Something went wrong")
      }
    } catch (err) {
      setError("Failed to create group. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 max-w-lg mx-auto w-full flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors border border-slate-100"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-900" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Create Group</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="max-w-md mx-auto px-6 pt-8 space-y-8">
        {/* Name Input Section */}
        <form onSubmit={handleCreateGroup} className="space-y-8">
           <div className="space-y-4">
             <div className="flex justify-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white rounded-3xl shadow-lg border border-slate-100 flex items-center justify-center text-primary overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <Users className="w-12 h-12" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2 text-white shadow-md border-2 border-white group-hover:rotate-12 transition-transform">
                    <PlusIcon className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 pl-1 uppercase tracking-tight">
                 Group Name
               </label>
               <Input
                placeholder="Ex. Goa Trip, Flat Expenses"
                className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-lg focus:ring-primary focus:border-primary"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
               />
             </div>
           </div>

           {/* Type Selector */}
           <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 pl-1 uppercase tracking-tight">
                 Group Type
              </label>
              <div className="grid grid-cols-4 gap-3">
                {groupTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border",
                      selectedType === type.id 
                        ? "bg-white border-primary shadow-md ring-2 ring-primary/10" 
                        : "bg-white/50 border-transparent hover:bg-white hover:border-slate-200"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", type.bg)}>
                      <type.icon className={cn("w-5 h-5", type.color)} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{type.name}</span>
                  </button>
                ))}
              </div>
           </div>

           {error && (
             <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-sm font-medium">
               {error}
             </div>
           )}

           <div className="pt-4">
             <Button
                type="submit"
                disabled={loading || !groupName.trim()}
                className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                size="lg"
             >
               {loading ? "Creating..." : "Create Group"}
             </Button>
           </div>
        </form>
      </div>
    </div>
  )
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
