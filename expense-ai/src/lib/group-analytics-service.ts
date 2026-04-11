import prisma from "@/lib/prisma";
import { normalizeExpenseCategory, getExpenseCategoryLabel } from "@/lib/expense-categories";

export const groupAnalyticsService = {
  async getSummary(userId: string) {
    const [
      paidAggregate,
      splitAggregate,
      categoryBreakdown,
      topGroupsRaw,
      recentExpenses,
    ] = await Promise.all([
      // Total I paid across all group expenses
      prisma.expense.aggregate({
        where: { paidById: userId, groupId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // My total share across all group expenses (what I owe/owed)
      prisma.expenseSplit.aggregate({
        where: {
          userId,
          expense: { groupId: { not: null } },
        },
        _sum: { amount: true },
      }),
      // Category breakdown of group expenses I paid
      prisma.expense.groupBy({
        by: ["category"],
        where: { paidById: userId, groupId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // Per-group totals of what I paid (top 5)
      prisma.expense.groupBy({
        by: ["groupId"],
        where: { paidById: userId, groupId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      // Recent group expenses involving me (as payer or split participant)
      prisma.expense.findMany({
        where: {
          groupId: { not: null },
          OR: [
            { paidById: userId },
            { splits: { some: { userId } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          description: true,
          amount: true,
          category: true,
          createdAt: true,
          paidById: true,
          group: { select: { id: true, name: true } },
          payer: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Resolve group names for topGroups (groupBy only returns the id)
    const groupIds = topGroupsRaw
      .map((g) => g.groupId)
      .filter((id): id is string => id !== null);

    const groups =
      groupIds.length > 0
        ? await prisma.group.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, name: true },
          })
        : [];

    const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

    const totalPaid = paidAggregate._sum.amount ?? 0;
    const totalOwed = splitAggregate._sum.amount ?? 0;

    return {
      totals: {
        totalPaid,
        totalOwed,
        // positive = others net owe me; negative = I net owe others
        netBalance: totalPaid - totalOwed,
        expenseCount: paidAggregate._count._all,
      },
      categoryBreakdown: categoryBreakdown
        .map((entry) => {
          const cat = normalizeExpenseCategory(entry.category);
          return {
            category: cat,
            label: getExpenseCategoryLabel(cat),
            amount: entry._sum.amount ?? 0,
            count: entry._count._all,
          };
        })
        .sort((a, b) => b.amount - a.amount),
      topGroups: topGroupsRaw.map((entry) => ({
        groupId: entry.groupId,
        groupName: groupNameMap.get(entry.groupId ?? "") ?? "Unknown",
        totalPaid: entry._sum.amount ?? 0,
        expenseCount: entry._count._all,
      })),
      recentExpenses,
    };
  },
};
