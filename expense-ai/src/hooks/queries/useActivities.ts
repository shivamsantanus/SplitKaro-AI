import { useQuery } from "@tanstack/react-query"

async function fetchActivities() {
  const res = await fetch("/api/activities")
  if (!res.ok) throw new Error("Failed to fetch activities")
  return res.json()
}

export function useActivitiesQuery(enabled = true) {
  return useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
    enabled,
    staleTime: 30_000,
  })
}
