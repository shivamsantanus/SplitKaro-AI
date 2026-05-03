import { useQuery } from "@tanstack/react-query"

async function fetchOverview() {
  const res = await fetch("/api/analytics/overview")
  if (!res.ok) throw new Error("Failed to fetch overview")
  return res.json()
}

async function fetchGroupAnalytics() {
  const res = await fetch("/api/analytics/groups")
  if (!res.ok) throw new Error("Failed to fetch group analytics")
  return res.json()
}

export function useOverviewQuery() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: fetchOverview,
    staleTime: 60_000,
  })
}

export function useGroupAnalyticsQuery(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "groups"],
    queryFn: fetchGroupAnalytics,
    enabled,
    staleTime: 60_000,
  })
}
