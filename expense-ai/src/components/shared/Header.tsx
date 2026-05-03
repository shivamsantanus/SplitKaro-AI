"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Moon, Sparkles, Sun } from "lucide-react"
import { useTheme } from "@/components/providers/ThemeProvider"
import { useLanguage } from "@/contexts/LanguageContext"

export const Header = () => {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { t } = useLanguage()

  const isAuth =
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname === "/welcome" ||
    pathname === "/"
  const isGroupDetail = pathname?.includes("/groups/")

  if (isAuth || isGroupDetail) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-100 dark:border-white/10 flex items-center justify-between px-6 md:px-12">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">SplitKaro AI</span>
      </Link>

      <button
        onClick={toggle}
        aria-label={t("header.toggleDarkMode")}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </header>
  )
}
