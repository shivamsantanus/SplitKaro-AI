"use client"

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { RupeeSpinner } from "@/components/ui/RupeeSpinner"
import TransactionsContent from "./TransactionsContent"

export default function PersonalTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4 opacity-40">
          <RupeeSpinner className="w-8 h-8 text-primary" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  )
}
