"use client"

import Link from "next/link"
import { Info, Sparkles } from "lucide-react"
import Image from "next/image"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"

export default function WelcomePage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex flex-col">
      <div className="px-6 pt-6">
        <div className="max-w-md mx-auto flex justify-end">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Info className="w-4 h-4 text-primary" />
            About
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pt-8 pb-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="relative animate-in">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-blue-200/20 rounded-3xl blur-3xl" />
            <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/50">
              <div className="relative h-72 w-full">
                <Image
                  src="https://images.unsplash.com/photo-1758275557508-5caf0d3e89c0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwaGFwcHklMjBncm91cCUyMGNlbGVicmF0aW5nJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzczMTY3ODUyfDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Friends celebrating together"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 text-center animate-in delay-100">
        <h1 className="text-4xl font-bold mb-3 text-slate-900">SplitSmart AI</h1>
        <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
          Split expenses with friends effortlessly using AI.
        </p>
      </div>

      <div className="px-6 pb-10 max-w-md mx-auto w-full animate-in delay-200 space-y-3">
        <p className="text-center text-sm text-slate-500">
          Sign in or create an account with Google—one step for new and returning users.
        </p>
        <GoogleSignInButton />
      </div>
    </div>
  )
}
