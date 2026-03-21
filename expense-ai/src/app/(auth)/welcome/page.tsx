"use client"

import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Sparkles } from "lucide-react"
import Image from "next/image"

export default function WelcomePage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex flex-col">
      {/* Top Section - Illustration */}
      <div className="flex-1 flex items-center justify-center px-6 pt-12 pb-6">
        <div className="w-full max-w-md">
          {/* App Logo Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Illustration Container */}
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
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section - App Name & Tagline */}
      <div className="px-6 pb-8 text-center animate-in delay-100">
        <h1 className="text-4xl font-bold mb-3 text-slate-900">
          SplitSmart AI
        </h1>
        <p className="text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
          Split expenses with friends effortlessly using AI.
        </p>
      </div>

      {/* Bottom Section - CTA */}
      <div className="px-6 pb-12 space-y-4 max-w-md mx-auto w-full animate-in delay-200">
        <Link href="/signup" className="w-full">
          <Button
            className="w-full h-14 rounded-2xl shadow-lg text-base font-semibold"
            size="lg"
          >
            Get Started
          </Button>
        </Link>

        <div className="text-center">
          <Link
            href="/login"
            className="text-primary hover:underline font-semibold transition-all"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
