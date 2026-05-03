"use client"

import { useRouter } from "next/navigation"
import { Home, Users, Wallet, User } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

type ActivePage = "overview" | "groups" | "personal" | "me"

interface BottomNavProps {
  active: ActivePage
  topBar?: React.ReactNode
}

export function BottomNav({ active, topBar }: BottomNavProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const NAV_ITEMS: { key: ActivePage; labelKey: string; icon: React.ElementType; href: string }[] = [
    { key: "overview",  labelKey: "nav.home",     icon: Home,   href: "/dashboard" },
    { key: "groups",    labelKey: "nav.groups",   icon: Users,  href: "/dashboard/groups" },
    { key: "personal",  labelKey: "nav.personal", icon: Wallet, href: "/dashboard/personal" },
    { key: "me",        labelKey: "nav.me",       icon: User,   href: "/me" },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/90 backdrop-blur-lg border-t border-slate-100 dark:border-white/10 shadow-[-1px_-5px_20px_-10px_rgba(0,0,0,0.1)] z-50 px-4 pb-safe md:pb-4">
      {topBar && (
        <div className="flex justify-center pt-2 pb-1">
          {topBar}
        </div>
      )}
      <div className={`flex items-center justify-around max-w-2xl mx-auto ${topBar ? "py-2" : "py-2.5"}`}>
        {NAV_ITEMS.map(({ key, labelKey, icon: Icon, href }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? "text-primary" : "text-slate-400 dark:text-slate-500 opacity-70"
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-colors ${
                  isActive ? "bg-primary/10 shadow-inner" : "hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{t(labelKey)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
