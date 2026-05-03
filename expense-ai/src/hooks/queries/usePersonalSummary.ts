import { useQuery } from "@tanstack/react-query"

async function fetchPersonalSummary(month?: number | null, year?: number | null) {
  const params = new URLSearchParams()
  if (month != null) params.set("month", String(month))
  if (year != null) params.set("year", String(year))
  const res = await fetch(`/api/personal/summary?${params}`)
  if (!res.ok) throw new Error("Failed to fetch personal summary")
  return res.json()
}

export function usePersonalSummaryQuery(month?: number | null, year?: number | null) {
  return useQuery({
    queryKey: ["personal", "summary", year, month],
    queryFn: () => fetchPersonalSummary(month, year),
    staleTime: 30_000,
  })
}
