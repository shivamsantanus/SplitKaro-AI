"use client"

import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut, Mail, Users } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { BottomNav } from "@/components/shared/BottomNav"

type GroupSummary = {
  id: string
  name: string
  yourBalance: number
}

export default function MePage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)
  const [profileMessage, setProfileMessage] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status !== "authenticated") {
      return
    }

    const loadGroups = async () => {
      setLoading(true)

      try {
        const response = await fetch("/api/groups")

        if (response.ok) {
          const data = await response.json()
          setGroups(data)
        }
      } catch (error) {
        console.error("Failed to load profile groups", error)
      } finally {
        setLoading(false)
      }
    }

    loadGroups()
  }, [router, status])

  useEffect(() => {
    setName(session?.user?.name || "")
  }, [session?.user?.name])

  const handleSaveName = async () => {
    if (!name.trim()) {
      setProfileMessage("Name cannot be empty.")
      return
    }

    setIsSavingName(true)
    setProfileMessage("")

    try {
      const response = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()

      if (!response.ok) {
        setProfileMessage(data.message || "Could not update your name.")
        return
      }

      await update({ name: data.name })
      setName(data.name || "")
      setProfileMessage("Your name was updated successfully.")
    } catch (error) {
      console.error("Failed to update profile name", error)
      setProfileMessage("Something went wrong while updating your name.")
    } finally {
      setIsSavingName(false)
    }
  }

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 pb-32 pt-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Button
            variant="outline"
            className="rounded-2xl border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 sm:px-5"
            onClick={() => signOut({ callbackUrl: "/welcome" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-lg">
          <div className="bg-primary px-8 py-10 text-white">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/30 bg-white/15 text-2xl font-black shadow-inner">
                {initials}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">
                  Profile
                </p>
                <h1 className="mt-1 text-3xl font-black">
                  {session?.user?.name || "No name set"}
                </h1>
                <div className="mt-3 flex items-center gap-2 text-sm text-white/85">
                  <Mail className="h-4 w-4" />
                  <span>{session?.user?.email || "No email available"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 px-6 py-6 md:grid-cols-[0.85fr_1.15fr]">
            <Card className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-none">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                User Details
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Name
                  </p>
                  <div className="mt-3 space-y-3">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Enter your name"
                      className="h-12 rounded-2xl border-slate-200 bg-white font-semibold text-slate-900"
                    />
                    <Button
                      onClick={handleSaveName}
                      disabled={isSavingName}
                      className="h-11 rounded-2xl px-5 font-bold"
                    >
                      {isSavingName ? "Saving..." : "Save Name"}
                    </Button>
                    {profileMessage && (
                      <p className="text-xs font-semibold text-slate-500">
                        {profileMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 break-all text-base font-bold text-slate-900">
                    {session?.user?.email || "No email available"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    Active Groups
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">{groups.length}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm font-medium text-slate-400">Loading your groups...</p>
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
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          Tap to open group details
                        </p>
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                        Open
                      </span>
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
