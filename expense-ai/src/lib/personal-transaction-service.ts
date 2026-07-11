import prisma from "@/lib/prisma";
import { inferExpenseCategory, normalizeExpenseCategory } from "@/lib/expense-categories";
import { inferIncomeCategory, normalizeIncomeCategory } from "@/lib/income-categories";
import { TransactionType } from "@/generated/prisma";

type CreatePersonalTransactionInput = {
  ownerId: string;
  amount: number | string;
  description: string;
  category?: string | null;
  type?: TransactionType | null;
  transactionDate?: string | Date | null;
};

type UpdatePersonalTransactionInput = {
  transactionId: string;
  ownerId: string;
  amount: number | string;
  description: string;
  category?: string | null;
  type?: TransactionType | null;
  transactionDate?: string | Date | null;
};

type PersonalTransactionFilters = {
  month?: number | null;
  year?: number | null;
  type?: TransactionType | null;
  includeGroupExpenses?: boolean | null;
};

type DerivedGroupTransaction = {
  id: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
  transactionDate: Date;
  source: "group";
  groupId: string;
  groupName: string;
  editable: false;
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

function normalizeType(type?: TransactionType | null): TransactionType {
  return type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;
}

function resolveCategory(type: TransactionType, description: string, category?: string | null) {
  if (type === TransactionType.INCOME) {
    return category ? normalizeIncomeCategory(category) : inferIncomeCategory(description);
  }
  return category ? normalizeExpenseCategory(category) : inferExpenseCategory(description);
}

function buildMonthRange(filters: PersonalTransactionFilters) {
  if (!filters.month || !filters.year) {
    return null;
  }

  const start = new Date(filters.year, filters.month - 1, 1);
  const end = new Date(filters.year, filters.month, 1);

  return { start, end };
}

type GroupSplitRow = {
  id: string;
  amount: number;
  expense: {
    description: string;
    category: string;
    transactionDate: Date;
    groupId: string | null;
    group: { name: string } | null;
  };
};

const groupSplitSelect = {
  id: true,
  amount: true,
  expense: {
    select: {
      description: true,
      category: true,
      transactionDate: true,
      groupId: true,
      group: { select: { name: true } },
    },
  },
} as const;

// A user's true cost of a group expense is their split share, not the amount
// they paid (the rest is a receivable). Splits with no share are skipped.
function toDerivedGroupTransaction(row: GroupSplitRow): DerivedGroupTransaction {
  return {
    id: `group-split:${row.id}`,
    description: row.expense.description,
    category: normalizeExpenseCategory(row.expense.category),
    type: TransactionType.EXPENSE,
    amount: row.amount,
    transactionDate: row.expense.transactionDate,
    source: "group",
    groupId: row.expense.groupId ?? "",
    groupName: row.expense.group?.name ?? "",
    editable: false,
  };
}

async function fetchGroupSplitTransactions(
  ownerId: string,
  range: { start: Date; end: Date } | null
): Promise<DerivedGroupTransaction[]> {
  const rows = await prisma.expenseSplit.findMany({
    where: {
      userId: ownerId,
      amount: { gt: 0 },
      expense: {
        groupId: { not: null },
        ...(range ? { transactionDate: { gte: range.start, lt: range.end } } : {}),
      },
    },
    select: groupSplitSelect,
    orderBy: { expense: { transactionDate: "desc" } },
  });

  return rows.map(toDerivedGroupTransaction);
}

export const personalTransactionService = {
  async getById(transactionId: string, ownerId: string) {
    return prisma.personalTransaction.findFirst({
      where: {
        id: transactionId,
        ownerId,
      },
    });
  },

  async create(input: CreatePersonalTransactionInput) {
    const amount = Number(input.amount);
    const description = input.description.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!description) {
      throw new Error("Description is required");
    }

    const type = normalizeType(input.type);
    const category = resolveCategory(type, description, input.category);

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
        type,
        transactionDate,
      },
    });
  },

  async update(input: UpdatePersonalTransactionInput) {
    const existingTransaction = await this.getById(input.transactionId, input.ownerId);

    if (!existingTransaction) {
      throw new Error("Transaction not found");
    }

    const amount = Number(input.amount);
    const description = input.description.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!description) {
      throw new Error("Description is required");
    }

    const type = normalizeType(input.type ?? existingTransaction.type);
    const category = resolveCategory(type, description, input.category);

    const transactionDate = input.transactionDate
      ? new Date(input.transactionDate)
      : existingTransaction.transactionDate;

    if (Number.isNaN(transactionDate.getTime())) {
      throw new Error("Transaction date is invalid");
    }

    return prisma.personalTransaction.update({
      where: {
        id: input.transactionId,
      },
      data: {
        amount,
        description,
        category,
        type,
        transactionDate,
      },
    });
  },

  async remove(transactionId: string, ownerId: string) {
    const existingTransaction = await this.getById(transactionId, ownerId);

    if (!existingTransaction) {
      throw new Error("Transaction not found");
    }

    await prisma.personalTransaction.delete({
      where: {
        id: transactionId,
      },
    });
  },

  async list(ownerId: string, filters: PersonalTransactionFilters = {}) {
    const range = buildMonthRange(filters);

    const own = await prisma.personalTransaction.findMany({
      where: {
        ownerId,
        ...(filters.type ? { type: filters.type } : {}),
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

    // Group splits are always EXPENSE, so an INCOME-only filter excludes them.
    const includeDerived =
      filters.includeGroupExpenses && filters.type !== TransactionType.INCOME;

    if (!includeDerived) {
      return own;
    }

    const derived = await fetchGroupSplitTransactions(ownerId, range);

    return [...own, ...derived].sort(
      (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime()
    );
  },

  async getSummary(ownerId: string, filters: PersonalTransactionFilters = {}) {
    const now = new Date();
    const targetMonth = filters.month ?? now.getMonth() + 1;
    const targetYear = filters.year ?? now.getFullYear();
    const monthRange = buildMonthRange({ month: targetMonth, year: targetYear });

    const monthWhere = monthRange
      ? { transactionDate: { gte: monthRange.start, lt: monthRange.end } }
      : {};

    const lastSixMonthsStart = new Date(targetYear, targetMonth - 6, 1);
    const nextMonthStart = new Date(targetYear, targetMonth, 1);

    const [
      lifetimeByType,
      monthByType,
      expenseCategoryBreakdown,
      incomeCategoryBreakdown,
      recentTransactions,
      sixMonthTransactions,
    ] = await Promise.all([
      prisma.personalTransaction.groupBy({
        by: ["type"],
        where: { ownerId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.personalTransaction.groupBy({
        by: ["type"],
        where: { ownerId, ...monthWhere },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.personalTransaction.groupBy({
        by: ["category"],
        where: { ownerId, type: TransactionType.EXPENSE, ...monthWhere },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.personalTransaction.groupBy({
        by: ["category"],
        where: { ownerId, type: TransactionType.INCOME, ...monthWhere },
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
          type: true,
          transactionDate: true,
        },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    const sumFor = (
      rows: Array<{ type: TransactionType; _sum: { amount: number | null }; _count: { _all: number } }>,
      type: TransactionType
    ) => {
      const row = rows.find((entry) => entry.type === type);
      return { amount: row?._sum.amount ?? 0, count: row?._count._all ?? 0 };
    };

    const lifetimeIncome = sumFor(lifetimeByType, TransactionType.INCOME);
    const lifetimeExpense = sumFor(lifetimeByType, TransactionType.EXPENSE);
    const monthIncome = sumFor(monthByType, TransactionType.INCOME);
    const monthExpense = sumFor(monthByType, TransactionType.EXPENSE);

    let derivedLifetime = { amount: 0, count: 0 };
    const derivedMonth = { amount: 0, count: 0 };
    let derivedSixMonth: DerivedGroupTransaction[] = [];
    let derivedRecent: DerivedGroupTransaction[] = [];
    const derivedMonthByCategory = new Map<string, { amount: number; count: number }>();

    if (filters.includeGroupExpenses) {
      const groupWhere = { userId: ownerId, amount: { gt: 0 }, expense: { groupId: { not: null } } };
      const [lifetimeAgg, sixMonthRows, recentRows] = await Promise.all([
        prisma.expenseSplit.aggregate({
          where: groupWhere,
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.expenseSplit.findMany({
          where: {
            ...groupWhere,
            expense: { groupId: { not: null }, transactionDate: { gte: lastSixMonthsStart, lt: nextMonthStart } },
          },
          select: groupSplitSelect,
          orderBy: { expense: { transactionDate: "desc" } },
        }),
        prisma.expenseSplit.findMany({
          where: groupWhere,
          select: groupSplitSelect,
          orderBy: { expense: { transactionDate: "desc" } },
          take: 8,
        }),
      ]);

      derivedLifetime = { amount: lifetimeAgg._sum.amount ?? 0, count: lifetimeAgg._count._all };
      derivedSixMonth = sixMonthRows.map(toDerivedGroupTransaction);
      derivedRecent = recentRows.map(toDerivedGroupTransaction);

      for (const tx of derivedSixMonth) {
        if (monthRange && tx.transactionDate >= monthRange.start && tx.transactionDate < monthRange.end) {
          derivedMonth.amount += tx.amount;
          derivedMonth.count += 1;
          const existing = derivedMonthByCategory.get(tx.category) ?? { amount: 0, count: 0 };
          existing.amount += tx.amount;
          existing.count += 1;
          derivedMonthByCategory.set(tx.category, existing);
        }
      }
    }

    const lifetimeExpenseTotal = {
      amount: lifetimeExpense.amount + derivedLifetime.amount,
      count: lifetimeExpense.count + derivedLifetime.count,
    };
    const monthExpenseTotal = {
      amount: monthExpense.amount + derivedMonth.amount,
      count: monthExpense.count + derivedMonth.count,
    };

    const monthlyNet = monthIncome.amount - monthExpenseTotal.amount;
    // Savings rate is only meaningful when there is income; guard divide-by-zero.
    const savingsRate = monthIncome.amount > 0 ? monthlyNet / monthIncome.amount : 0;

    type MonthlyEntry = { income: number; expense: number };
    const monthlySummaryMap = new Map<string, MonthlyEntry>();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(targetYear, targetMonth - 1 - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlySummaryMap.set(key, { income: 0, expense: 0 });
    }

    for (const transaction of sixMonthTransactions) {
      const key = `${transaction.transactionDate.getFullYear()}-${String(
        transaction.transactionDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const entry = monthlySummaryMap.get(key);
      if (entry) {
        if (transaction.type === TransactionType.INCOME) {
          entry.income += transaction.amount;
        } else {
          entry.expense += transaction.amount;
        }
      }
    }

    for (const tx of derivedSixMonth) {
      const key = `${tx.transactionDate.getFullYear()}-${String(
        tx.transactionDate.getMonth() + 1
      ).padStart(2, "0")}`;
      const entry = monthlySummaryMap.get(key);
      if (entry) {
        entry.expense += tx.amount;
      }
    }

    const mapBreakdown = (
      rows: CategoryBreakdownItem[],
      normalize: (category: string) => string
    ) =>
      rows
        .map((entry) => ({
          category: normalize(entry.category),
          amount: entry._sum.amount ?? 0,
          count: entry._count._all,
        }))
        .sort((a, b) => b.amount - a.amount);

    const expenseByCategoryMap = new Map<string, { amount: number; count: number }>();
    for (const item of mapBreakdown(
      expenseCategoryBreakdown as CategoryBreakdownItem[],
      normalizeExpenseCategory
    )) {
      expenseByCategoryMap.set(item.category, { amount: item.amount, count: item.count });
    }
    for (const [category, agg] of derivedMonthByCategory) {
      const existing = expenseByCategoryMap.get(category) ?? { amount: 0, count: 0 };
      existing.amount += agg.amount;
      existing.count += agg.count;
      expenseByCategoryMap.set(category, existing);
    }
    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([category, agg]) => ({ category, amount: agg.amount, count: agg.count }))
      .sort((a, b) => b.amount - a.amount);

    const recentTransactionsMerged = [...recentTransactions, ...derivedRecent]
      .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
      .slice(0, 8);

    return {
      totals: {
        income: {
          lifetimeAmount: lifetimeIncome.amount,
          lifetimeCount: lifetimeIncome.count,
          monthlyAmount: monthIncome.amount,
          monthlyCount: monthIncome.count,
        },
        expense: {
          lifetimeAmount: lifetimeExpenseTotal.amount,
          lifetimeCount: lifetimeExpenseTotal.count,
          monthlyAmount: monthExpenseTotal.amount,
          monthlyCount: monthExpenseTotal.count,
        },
        net: {
          lifetimeAmount: lifetimeIncome.amount - lifetimeExpenseTotal.amount,
          monthlyAmount: monthlyNet,
        },
        savingsRate,
        month: targetMonth,
        year: targetYear,
      },
      expenseByCategory,
      incomeByCategory: mapBreakdown(
        incomeCategoryBreakdown as CategoryBreakdownItem[],
        normalizeIncomeCategory
      ),
      monthlySummary: Array.from(monthlySummaryMap.entries()).map(([monthKey, entry]) => ({
        month: monthKey,
        income: entry.income,
        expense: entry.expense,
        net: entry.income - entry.expense,
      })),
      recentTransactions: recentTransactionsMerged,
    };
  },
};
