import { useQuery } from "@tanstack/react-query"

export type InsightTone = "positive" | "neutral" | "watch"

export type PersonalInsights = {
  summary: string
  insights: { text: string; tone: InsightTone }[]
  empty: boolean
}

async function fetchPersonalInsights(
  month?: number | null,
  year?: number | null
): Promise<PersonalInsights> {
  const params = new URLSearchParams()
  if (month != null) params.set("month", String(month))
  if (year != null) params.set("year", String(year))
  const res = await fetch(`/api/personal/insights?${params}`)
  if (!res.ok) throw new Error("Failed to fetch personal insights")
  return res.json()
}

export function usePersonalInsightsQuery(month?: number | null, year?: number | null) {
  return useQuery({
    queryKey: ["personal", "insights", year, month],
    queryFn: () => fetchPersonalInsights(month, year),
    staleTime: 5 * 60_000,
  })
}
