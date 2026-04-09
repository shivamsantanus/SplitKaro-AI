import prisma from "@/lib/prisma";
import { inferExpenseCategory, normalizeExpenseCategory } from "@/lib/expense-categories";

type CreatePersonalTransactionInput = {
  ownerId: string;
  amount: number | string;
  description: string;
  category?: string | null;
  transactionDate?: string | Date | null;
};

type PersonalTransactionFilters = {
  month?: number | null;
  year?: number | null;
};

type CategoryBreakdownItem = {
  category: string;
  _sum: {
    amount: number | null;
  };
  _count: {
    _all: number;
  };
};

function buildMonthRange(filters: PersonalTransactionFilters) {
  if (!filters.month || !filters.year) {
    return null;
  }

  const start = new Date(filters.year, filters.month - 1, 1);
  const end = new Date(filters.year, filters.month, 1);

  return { start, end };
}

export const personalTransactionService = {
  async create(input: CreatePersonalTransactionInput) {
    const amount = Number(input.amount);
    const description = input.description.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!description) {
      throw new Error("Description is required");
    }

    const category = input.category
      ? normalizeExpenseCategory(input.category)
      : inferExpenseCategory(description);

    const transactionDate = input.transactionDate
      ? new Date(input.transactionDate)
      : new Date();

    if (Number.isNaN(transactionDate.getTime())) {
      throw new Error("Transaction date is invalid");
    }

    return prisma.personalTransaction.create({
      data: {
        ownerId: input.ownerId,
        amount,
        description,
        category,
        transactionDate,
      },
    });
  },

  async list(ownerId: string, filters: PersonalTransactionFilters = {}) {
    const range = buildMonthRange(filters);

    return prisma.personalTransaction.findMany({
      where: {
        ownerId,
        ...(range
          ? {
              transactionDate: {
                gte: range.start,
                lt: range.end,
              },
            }
          : {}),
      },
      orderBy: [
        { transactionDate: "desc" },
        { createdAt: "desc" },
      ],
    });
  },

  async getSummary(ownerId: string, filters: PersonalTransactionFilters = {}) {
    const now = new Date();
    const targetMonth = filters.month ?? now.getMonth() + 1;
    const targetYear = filters.year ?? now.getFullYear();
    const monthRange = buildMonthRange({ month: targetMonth, year: targetYear });

    const lastSixMonthsStart = new Date(targetYear, targetMonth - 6, 1);
    const nextMonthStart = new Date(targetYear, targetMonth, 1);

    const [overallAggregate, monthAggregate, categoryBreakdown, recentTransactions, sixMonthTransactions] =
      await Promise.all([
        prisma.personalTransaction.aggregate({
          where: { ownerId },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.personalTransaction.aggregate({
          where: {
            ownerId,
            ...(monthRange
              ? {
                  transactionDate: {
                    gte: monthRange.start,
                    lt: monthRange.end,
                  },
                }
              : {}),
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.personalTransaction.groupBy({
          by: ["category"],
          where: {
            ownerId,
            ...(monthRange
              ? {
                  transactionDate: {
                    gte: monthRange.start,
                    lt: monthRange.end,
                  },
                }
              : {}),
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.personalTransaction.findMany({
          where: { ownerId },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
          take: 8,
        }),
        prisma.personalTransaction.findMany({
          where: {
            ownerId,
            transactionDate: {
              gte: lastSixMonthsStart,
              lt: nextMonthStart,
            },
          },
          select: {
            amount: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "asc" },
        }),
      ]);

    const monthlySummaryMap = new Map<string, number>();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(targetYear, targetMonth - 1 - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlySummaryMap.set(key, 0);
    }

    for (const transaction of sixMonthTransactions) {
      const key = `${transaction.transactionDate.getFullYear()}-${String(
        transaction.transactionDate.getMonth() + 1
      ).padStart(2, "0")}`;

      if (monthlySummaryMap.has(key)) {
        monthlySummaryMap.set(key, (monthlySummaryMap.get(key) ?? 0) + transaction.amount);
      }
    }

    return {
      totals: {
        lifetimeAmount: overallAggregate._sum.amount ?? 0,
        lifetimeCount: overallAggregate._count._all,
        monthlyAmount: monthAggregate._sum.amount ?? 0,
        monthlyCount: monthAggregate._count._all,
        month: targetMonth,
        year: targetYear,
      },
      categoryBreakdown: (categoryBreakdown as CategoryBreakdownItem[])
        .map((entry) => ({
          category: normalizeExpenseCategory(entry.category),
          amount: entry._sum.amount ?? 0,
          count: entry._count._all,
        }))
        .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount),
      monthlySummary: Array.from(monthlySummaryMap.entries()).map(([monthKey, amount]) => ({
        month: monthKey,
        amount,
      })),
      recentTransactions,
    };
  },
};
