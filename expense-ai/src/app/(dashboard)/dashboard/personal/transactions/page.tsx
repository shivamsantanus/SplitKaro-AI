"use client"

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import TransactionsContent from "./TransactionsContent"

export default function PersonalTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4 opacity-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  )
}
