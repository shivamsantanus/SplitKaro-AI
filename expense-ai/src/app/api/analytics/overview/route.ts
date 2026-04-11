import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmailWithSelect } from "@/lib/users";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { groupAnalyticsService } from "@/lib/group-analytics-service";
import { getExpenseCategoryLabel } from "@/lib/expense-categories";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const [personalSummary, groupSummary] = await Promise.all([
      personalTransactionService.getSummary(user.id, {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
      groupAnalyticsService.getSummary(user.id),
    ]);

    return NextResponse.json({
      personal: {
        thisMonthAmount: personalSummary.totals.monthlyAmount,
        thisMonthCount: personalSummary.totals.monthlyCount,
        lifetimeAmount: personalSummary.totals.lifetimeAmount,
        lifetimeCount: personalSummary.totals.lifetimeCount,
        topCategories: personalSummary.categoryBreakdown
          .slice(0, 3)
          .map((item: { category: string; amount: number; count: number }) => ({
            ...item,
            label: getExpenseCategoryLabel(item.category),
          })),
        recentTransactions: personalSummary.recentTransactions.slice(0, 4),
      },
      groups: {
        totalPaid: groupSummary.totals.totalPaid,
        totalOwed: groupSummary.totals.totalOwed,
        netBalance: groupSummary.totals.netBalance,
        expenseCount: groupSummary.totals.expenseCount,
        topGroups: groupSummary.topGroups.slice(0, 3),
        recentExpenses: groupSummary.recentExpenses.slice(0, 4),
      },
    });
  } catch (error) {
    console.error("Overview analytics error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
