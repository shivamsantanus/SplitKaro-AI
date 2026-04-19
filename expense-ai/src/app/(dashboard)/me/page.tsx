"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CalendarDays, Mail, Smartphone, Users } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Toast } from "@/components/ui/Toast"
import { BottomNav } from "@/components/shared/BottomNav"
import { useToast } from "@/hooks/useToast"

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/

type GroupSummary = { id: string; name: string; yourBalance: number }

export default function MePage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const { toast, showToast, dismissToast } = useToast()

  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Name
  const [name, setName]               = useState("")
  const [isSavingName, setIsSavingName] = useState(false)

  // UPI
  const [upiId, setUpiId]             = useState("")
  const [isSavingUpi, setIsSavingUpi] = useState(false)
  const [upiError, setUpiError]       = useState("")

  // Meta
  const [memberSince, setMemberSince] = useState<string | null>(null)

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
          if (me.upiId)    setUpiId(me.upiId)
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
      showToast("Name updated successfully.", "success")
    } catch {
      showToast("Something went wrong.", "error")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleSaveUpi = async () => {
    setUpiError("")
    const trimmed = upiId.trim()
    if (trimmed && !UPI_REGEX.test(trimmed)) {
      setUpiError("Invalid format — should look like name@bank")
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
      showToast(trimmed ? "UPI ID saved." : "UPI ID removed.", "success")
    } catch {
      showToast("Something went wrong.", "error")
    } finally {
      setIsSavingUpi(false)
    }
  }

  const initials =
    session?.user?.name?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U"

  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 pb-32 pt-24">
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-lg">
          {/* Header banner */}
          <div className="bg-primary px-8 py-10 text-white">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/30 bg-white/15 text-2xl font-black shadow-inner">
                {initials}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">Profile</p>
                <h1 className="mt-1 text-3xl font-black">{session?.user?.name || "No name set"}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <div className="flex items-center gap-2 text-sm text-white/85">
                    <Mail className="h-4 w-4" />
                    <span>{session?.user?.email || "—"}</span>
                  </div>
                  {memberSinceLabel && (
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <CalendarDays className="h-4 w-4" />
                      <span>Member since {memberSinceLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 px-6 py-6 md:grid-cols-[0.85fr_1.15fr]">
            {/* Left column: User Details + Payment Settings */}
            <div className="flex flex-col gap-4">
              <Card className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">User Details</p>
                <div className="mt-5 space-y-4">
                  {/* Name */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Name</p>
                    <div className="mt-3 space-y-3">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="h-12 rounded-2xl border-slate-200 bg-white font-semibold text-slate-900"
                      />
                      <Button onClick={handleSaveName} disabled={isSavingName} className="h-11 rounded-2xl px-5 font-bold">
                        {isSavingName ? "Saving…" : "Save Name"}
                      </Button>
                    </div>
                  </div>
                  {/* Email (read-only) */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Email</p>
                    <p className="mt-2 break-all text-base font-bold text-slate-900">
                      {session?.user?.email || "—"}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Payment Settings */}
              <Card className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-none">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Payment Settings</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">UPI ID</p>
                  <Input
                    value={upiId}
                    onChange={(e) => { setUpiId(e.target.value); setUpiError("") }}
                    placeholder="yourname@upi"
                    className="h-12 rounded-2xl border-slate-200 bg-white font-semibold text-slate-900"
                  />
                  {upiError && (
                    <p className="text-xs font-semibold text-rose-500">{upiError}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Group members can pay you directly via UPI when settling up.
                  </p>
                  <Button onClick={handleSaveUpi} disabled={isSavingUpi} className="h-11 rounded-2xl px-5 font-bold">
                    {isSavingUpi ? "Saving…" : "Save UPI ID"}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Right column: Active Groups */}
            <Card className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Active Groups</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">{groups.length}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm font-medium text-slate-400">Loading your groups…</p>
                ) : groups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
                    You are not part of any active groups yet.
                  </div>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => router.push(`/groups/${group.id}`)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-white"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{group.name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Tap to open group details</p>
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Open</span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        </Card>
      </div>

      <BottomNav active="me" />
    </div>
  )
}
