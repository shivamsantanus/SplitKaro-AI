"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { ArrowLeft } from "lucide-react"
import { Suspense } from "react"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"

const isDevLoginEnabled = process.env.NODE_ENV !== "production"

const oauthErrorMessages: Record<string, string> = {
  OAuthSignin: "Could not start sign-in. Please try again.",
  OAuthCallback: "Something went wrong after signing in with Google.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  EmailCreateAccount: "Could not create your account. Please try again.",
  Callback: "Sign-in callback failed. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Use Google for this account.",
  SessionRequired: "You need to sign in to continue.",
  Default: "Sign-in failed. Please try again.",
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const { status } = useSession()

  const [error, setError] = useState("")
  const [devEmail, setDevEmail] = useState("")
  const [devPassword, setDevPassword] = useState("")
  const [devSubmitting, setDevSubmitting] = useState(false)

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setDevSubmitting(true)
    const res = await signIn("dev-credentials", {
      email: devEmail,
      password: devPassword,
      redirect: false,
      callbackUrl,
    })
    setDevSubmitting(false)
    if (res?.error) {
      setError("Invalid dev credentials.")
    } else {
      router.replace(callbackUrl)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  const oauthUrlMessage =
    urlError && (oauthErrorMessages[urlError] ?? oauthErrorMessages.Default)

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background flex flex-col">
      <div className="px-6 pt-6 pb-4 max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={() => router.push("/welcome")}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors border border-slate-100"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-900" />
        </button>
      </div>

      <div className="flex-1 px-6 pb-6 animate-in">
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">SplitSmart AI</h1>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Continue with Google</h2>
            <p className="text-slate-500">
              Google signs you in. If you&apos;re new here, we create your profile after you
              authorize—no separate signup step.
            </p>
          </div>

          {(error || oauthUrlMessage) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-2xl text-sm font-medium animate-in">
              {error || oauthUrlMessage}
            </div>
          )}

          <GoogleSignInButton callbackUrl={callbackUrl} onError={setError} />

          {isDevLoginEnabled && (
            <form onSubmit={handleDevLogin} className="space-y-3 border-t border-slate-200 pt-6">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dev login (local only)
              </p>
              <input
                type="email"
                required
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="dummy@test.com"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-primary"
              />
              <input
                type="password"
                required
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={devSubmitting}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {devSubmitting ? "Signing in…" : "Dev sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full mb-4" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
