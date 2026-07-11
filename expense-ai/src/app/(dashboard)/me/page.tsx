"use client"

import { useEffect, useState, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CalendarDays, LogOut, Mail, Smartphone, Users, Languages, Pencil, Check, X, ChevronDown, Palette, Moon, Sun } from "lucide-react"
import { Toast } from "@/components/ui/Toast"
import { BottomNav } from "@/components/shared/BottomNav"
import { useToast } from "@/hooks/useToast"
import { useLanguage, LANGUAGE_NAMES, LANGUAGES } from "@/contexts/LanguageContext"
import { useTheme, THEMES } from "@/components/providers/ThemeProvider"

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/

type GroupSummary = { id: string; name: string; yourBalance: number }

export default function MePage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const { toast, showToast, dismissToast } = useToast()
  const { t, language, setLanguage } = useLanguage()
  const { theme, toggle, colorTheme, setColorTheme } = useTheme()

  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)

  const [upiId, setUpiId] = useState("")
  const [editingUpi, setEditingUpi] = useState(false)
  const [isSavingUpi, setIsSavingUpi] = useState(false)
  const [upiError, setUpiError] = useState("")

  const [memberSince, setMemberSince] = useState<string | null>(null)

  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const upiInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])
  useEffect(() => { if (editingUpi) upiInputRef.current?.focus() }, [editingUpi])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status !== "authenticated") return

    const load = async () => {
      setLoading(true)
      try {
        const [groupsRes, meRes] = await Promise.all([
          fetch("/api/groups"),
          fetch("/api/me"),
        ])
        if (groupsRes.ok) setGroups(await groupsRes.json())
        if (meRes.ok) {
          const me = await meRes.json()
          if (me.upiId) setUpiId(me.upiId)
          if (me.createdAt) setMemberSince(me.createdAt)
        }
      } catch {
        console.error("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, status])

  useEffect(() => { setName(session?.user?.name || "") }, [session?.user?.name])

  const handleSaveName = async () => {
    if (!name.trim()) { showToast("Name cannot be empty.", "error"); return }
    setIsSavingName(true)
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || "Could not update name.", "error"); return }
      await update({ name: data.name })
      setName(data.name || "")
      setEditingName(false)
      showToast("Name updated.", "success")
    } catch {
      showToast("Something went wrong.", "error")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleCancelName = () => {
    setName(session?.user?.name || "")
    setEditingName(false)
  }

  const handleSaveUpi = async () => {
    setUpiError("")
    const trimmed = upiId.trim()
    if (trimmed && !UPI_REGEX.test(trimmed)) {
      setUpiError(t("profile.upiError"))
      return
    }
    setIsSavingUpi(true)
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiId: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.message || "Could not save UPI ID.", "error"); return }
      setUpiId(data.upiId || "")
      setEditingUpi(false)
      showToast(trimmed ? "UPI ID saved." : "UPI ID removed.", "success")
    } catch {
      showToast("Something went wrong.", "error")
    } finally {
      setIsSavingUpi(false)
    }
  }

  const handleCancelUpi = () => {
    setUpiError("")
    setEditingUpi(false)
  }

  const initials =
    session?.user?.name?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U"

  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null

  return (
    <div className="min-h-screen bg-background px-4 pb-32 pt-20">
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}

      <div className="mx-auto w-full max-w-md flex flex-col gap-4">

        {/* Profile Header */}
        <div className="flex items-start gap-4 px-2 pt-4 pb-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-primary text-white text-xl font-black shadow-md">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            {/* Inline name edit */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName()
                    if (e.key === "Escape") handleCancelName()
                  }}
                  className="flex-1 min-w-0 bg-transparent text-xl font-black text-slate-900 dark:text-white border-b-2 border-primary outline-none pb-0.5"
                  placeholder="Your name"
                />
                <button onClick={handleSaveName} disabled={isSavingName} className="shrink-0 text-primary">
                  <Check className="h-5 w-5" />
                </button>
                <button onClick={handleCancelName} className="shrink-0 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="group flex items-center gap-2 text-left"
              >
                <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {session?.user?.name || "No name set"}
                </h1>
                <Pencil className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}

            {/* Inline UPI edit */}
            {editingUpi ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    ref={upiInputRef}
                    value={upiId}
                    onChange={(e) => { setUpiId(e.target.value); setUpiError("") }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveUpi()
                      if (e.key === "Escape") handleCancelUpi()
                    }}
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-primary outline-none pb-0.5"
                    placeholder="yourname@upi"
                  />
                  <button onClick={handleSaveUpi} disabled={isSavingUpi} className="shrink-0 text-primary">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={handleCancelUpi} className="shrink-0 text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {upiError && <p className="mt-1 text-xs text-rose-500 pl-5">{upiError}</p>}
              </div>
            ) : (
              <button
                onClick={() => setEditingUpi(true)}
                className="group mt-1.5 flex items-center gap-1.5 text-left"
              >
                <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {upiId || "Add UPI ID"}
                </span>
                <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}

            {/* Email (read-only) */}
            <div className="mt-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {session?.user?.email || "—"}
              </span>
            </div>

            {/* Member since */}
            {memberSinceLabel && (
              <div className="mt-1 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-400">
                  {t("profile.memberSince", { date: memberSinceLabel })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Language */}
        <div
          ref={langRef}
          className="relative rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-3.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <Languages className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Language</span>
          </div>

          {/* Trigger */}
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:border-primary/50 hover:bg-white dark:hover:bg-slate-600"
          >
            <span>{LANGUAGE_NAMES[language]}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown panel */}
          <div
            className={`absolute right-4 top-[calc(100%+6px)] z-50 min-w-[10rem] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/60 dark:shadow-black/30 overflow-hidden transition-all duration-200 origin-top-right
              ${langOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}`}
          >
            {LANGUAGES.map((lang, i) => (
              <button
                key={lang}
                onClick={() => { setLanguage(lang); setLangOpen(false) }}
                className={`flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition-colors
                  ${i !== 0 ? "border-t border-slate-100 dark:border-slate-700" : ""}
                  ${language === lang
                    ? "bg-primary/8 text-primary dark:bg-primary/15"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
              >
                <span>{LANGUAGE_NAMES[lang]}</span>
                {language === lang && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-4">
          <div className="flex items-center gap-2.5 mb-4">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t("profile.appearance")}</span>
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              {theme === "dark" ? <Moon className="h-4 w-4 text-slate-400" /> : <Sun className="h-4 w-4 text-slate-400" />}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("profile.darkMode")}</span>
            </div>
            <button
              role="switch"
              aria-checked={theme === "dark"}
              onClick={toggle}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-slate-200 dark:bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* Accent color swatches */}
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">{t("profile.themeColor")}</p>
          <div className="flex flex-wrap gap-3">
            {THEMES.map((th) => {
              const label = t(`profile.theme${th.id.charAt(0).toUpperCase()}${th.id.slice(1)}`)
              const selected = colorTheme === th.id
              return (
                <button
                  key={th.id}
                  onClick={() => setColorTheme(th.id)}
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 transition-transform active:scale-90 ${selected ? "ring-slate-900 dark:ring-white scale-105" : "ring-transparent"}`}
                  /* dynamic per-theme brand hex — cannot be a static Tailwind class */
                  style={{ backgroundColor: th.swatch }}
                >
                  {selected && <Check className="h-4 w-4 text-white" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active Groups */}
        <div className="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t("profile.activeGroups")}</span>
            </div>
            <span className="text-base font-black text-primary">{groups.length}</span>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm font-medium text-slate-400 py-1">{t("profile.loadingGroups")}</p>
            ) : groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-4 text-sm font-medium text-slate-500 text-center">
                {t("profile.noGroups")}
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-left transition-all hover:border-primary/30 hover:bg-white dark:hover:bg-slate-700"
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{group.name}</p>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">{t("common.open")}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/welcome" })}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-900/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t("profile.logout")}
        </button>
      </div>

      <BottomNav active="me" />
    </div>
  )
}
