import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getExpenseCategoryLabel, normalizeExpenseCategory } from "@/lib/expense-categories";
import { findUserByEmailWithSelect } from "@/lib/users";

type GroupedCategorySummary = {
  category: string;
  _sum: {
    amount: number | null;
  };
  _count: {
    _all: number;
  };
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const [allExpenses, soloExpenses, recentExpenses] = await Promise.all([
      prisma.expense.groupBy({
        by: ["category"],
        where: {
          paidById: user.id,
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: {
          paidById: user.id,
          groupId: null,
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.expense.findMany({
        where: {
          paidById: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
        select: {
          id: true,
          description: true,
          amount: true,
          category: true,
          createdAt: true,
          groupId: true,
          group: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    const soloByCategory = new Map<string, GroupedCategorySummary>(
      soloExpenses.map((entry) => [normalizeExpenseCategory(entry.category), entry as GroupedCategorySummary])
    );

    const categories = (allExpenses as GroupedCategorySummary[])
      .map((entry) => {
        const normalizedCategory = normalizeExpenseCategory(entry.category);
        const total = entry._sum.amount ?? 0;
        const solo = soloByCategory.get(normalizedCategory)?._sum.amount ?? 0;
        const soloCount = soloByCategory.get(normalizedCategory)?._count._all ?? 0;
        const group = total - solo;

        return {
          category: normalizedCategory,
          label: getExpenseCategoryLabel(normalizedCategory),
          total,
          group,
          solo,
          count: entry._count._all,
          soloCount,
          groupCount: entry._count._all - soloCount,
        };
      })
      .sort((a, b) => b.total - a.total);

    const totals = categories.reduce(
      (acc, item) => {
        acc.total += item.total;
        acc.group += item.group;
        acc.solo += item.solo;
        acc.count += item.count;
        return acc;
      },
      { total: 0, group: 0, solo: 0, count: 0 }
    );

    return NextResponse.json({
      totals,
      topCategory: categories[0] ?? null,
      categories,
      recentExpenses,
    });
  } catch (error) {
    console.error("Spending summary error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
