import { useQuery } from "@tanstack/react-query"

async function fetchPersonalTransactions(month?: number | null, year?: number | null) {
  const params = new URLSearchParams()
  if (month != null) params.set("month", String(month))
  if (year != null) params.set("year", String(year))
  const res = await fetch(`/api/personal/transactions?${params}`)
  if (!res.ok) throw new Error("Failed to fetch personal transactions")
  return res.json()
}

export function usePersonalTransactionsQuery(month?: number | null, year?: number | null) {
  return useQuery({
    queryKey: ["personal", "transactions", year, month],
    queryFn: () => fetchPersonalTransactions(month, year),
    staleTime: 30_000,
  })
}
