"use client"

import { useRouter } from "next/navigation"
import { Home, Users, Wallet, User } from "lucide-react"

type ActivePage = "overview" | "groups" | "personal" | "me"

const NAV_ITEMS: { key: ActivePage; label: string; icon: React.ElementType; href: string }[] = [
  { key: "overview",  label: "Home",     icon: Home,   href: "/dashboard" },
  { key: "groups",    label: "Groups",   icon: Users,  href: "/dashboard/groups" },
  { key: "personal",  label: "Personal", icon: Wallet, href: "/dashboard/personal" },
  { key: "me",        label: "Me",       icon: User,   href: "/me" },
]

export function BottomNav({ active }: { active: ActivePage }) {
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 shadow-[-1px_-5px_20px_-10px_rgba(0,0,0,0.1)] z-50 px-4 py-2.5 pb-safe md:pb-4">
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ key, label, icon: Icon, href }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? "text-primary" : "text-slate-400 opacity-70"
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-colors ${
                  isActive ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
