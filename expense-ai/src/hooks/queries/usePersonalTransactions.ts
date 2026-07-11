import { useQuery } from "@tanstack/react-query"

export type PersonalTransaction = {
  id: string
  description: string
  category: string
  type: "INCOME" | "EXPENSE"
  amount: number
  transactionDate: string
  source?: "group"
  groupId?: string
  groupName?: string
  editable?: boolean
}

async function fetchPersonalTransactions(
  month?: number | null,
  year?: number | null,
  type?: "INCOME" | "EXPENSE",
  includeGroup: boolean = true
): Promise<PersonalTransaction[]> {
  const params = new URLSearchParams()
  if (month != null) params.set("month", String(month))
  if (year != null) params.set("year", String(year))
  if (type) params.set("type", type)
  if (!includeGroup) params.set("includeGroup", "false")
  const res = await fetch(`/api/personal/transactions?${params}`)
  if (!res.ok) throw new Error("Failed to fetch personal transactions")
  return res.json()
}

export function usePersonalTransactionsQuery(
  month?: number | null,
  year?: number | null,
  type?: "INCOME" | "EXPENSE",
  includeGroup: boolean = true
) {
  return useQuery({
    queryKey: ["personal", "transactions", year, month, type ?? "ALL", includeGroup],
    queryFn: () => fetchPersonalTransactions(month, year, type, includeGroup),
    staleTime: 30_000,
  })
}
