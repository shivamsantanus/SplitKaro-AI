"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const es = new EventSource("/api/events")

    es.addEventListener("update", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)

        if (payload.groupId) {
          queryClient.invalidateQueries({ queryKey: ["group", payload.groupId] })
          queryClient.invalidateQueries({ queryKey: ["groups"] })
          queryClient.invalidateQueries({ queryKey: ["analytics"] })
          queryClient.invalidateQueries({ queryKey: ["activities"] })
        } else if (payload.userId) {
          queryClient.invalidateQueries({ queryKey: ["groups"] })
          queryClient.invalidateQueries({ queryKey: ["analytics"] })
          queryClient.invalidateQueries({ queryKey: ["activities"] })
        }
      } catch {
        // ignore malformed events
      }
    })

    return () => es.close()
  }, [queryClient])
}
