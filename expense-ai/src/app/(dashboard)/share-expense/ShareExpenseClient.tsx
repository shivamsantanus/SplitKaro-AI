"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { MessageExpenseModal } from "@/components/ui/MessageExpenseModal"

interface ShareExpenseClientProps {
  initialText: string
}

export function ShareExpenseClient({ initialText }: ShareExpenseClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const goToPersonal = () => router.replace("/dashboard/personal")

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["personal", "summary"] })
    queryClient.invalidateQueries({ queryKey: ["personal", "insights"] })
    queryClient.invalidateQueries({ queryKey: ["personal", "transactions"] })
  }

  return (
    <div className="min-h-screen bg-background">
      <MessageExpenseModal
        isOpen
        initialText={initialText}
        onClose={goToPersonal}
        onSuccess={invalidate}
      />
    </div>
  )
}
