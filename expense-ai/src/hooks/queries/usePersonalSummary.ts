import { useQuery } from "@tanstack/react-query"
import type { PersonalTransaction } from "./usePersonalTransactions"

export type PersonalCategoryBreakdownItem = {
  category: string
  label: string
  amount: number
  count: number
}

export type PersonalMonthlySummaryItem = {
  month: string
  income: number
  expense: number
  net: number
}

export type PersonalSummary = {
  totals: {
    income: { lifetimeAmount: number; lifetimeCount: number; monthlyAmount: number; monthlyCount: number }
    expense: { lifetimeAmount: number; lifetimeCount: number; monthlyAmount: number; monthlyCount: number }
    net: { lifetimeAmount: number; monthlyAmount: number }
    savingsRate: number
    month: number
    year: number
  }
  expenseByCategory: PersonalCategoryBreakdownItem[]
  incomeByCategory: PersonalCategoryBreakdownItem[]
  monthlySummary: PersonalMonthlySummaryItem[]
  recentTransactions: PersonalTransaction[]
}

async function fetchPersonalSummary(
  month?: number | null,
  year?: number | null,
  includeGroup: boolean = true
): Promise<PersonalSummary> {
  const params = new URLSearchParams()
  if (month != null) params.set("month", String(month))
  if (year != null) params.set("year", String(year))
  if (!includeGroup) params.set("includeGroup", "false")
  const res = await fetch(`/api/personal/summary?${params}`)
  if (!res.ok) throw new Error("Failed to fetch personal summary")
  return res.json()
}

export function usePersonalSummaryQuery(
  month?: number | null,
  year?: number | null,
  includeGroup: boolean = true
) {
  return useQuery({
    queryKey: ["personal", "summary", year, month, includeGroup],
    queryFn: () => fetchPersonalSummary(month, year, includeGroup),
    staleTime: 30_000,
  })
}
