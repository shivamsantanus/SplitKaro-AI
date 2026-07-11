import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExpenseCategoryLabel } from "@/lib/expense-categories";
import { getIncomeCategoryLabel } from "@/lib/income-categories";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { findUserByEmailWithSelect } from "@/lib/users";
import { getCache, setCache } from "@/lib/cache";

function parseOptionalInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const month = parseOptionalInt(searchParams.get("month"));
    const year = parseOptionalInt(searchParams.get("year"));
    // Default on: a group expense you're part of is money you spent.
    const includeGroupExpenses = searchParams.get("includeGroup") !== "false";

    const cacheKey = `personal:summary:${user.id}:${year ?? "all"}:${month ?? "all"}:${
      includeGroupExpenses ? "g1" : "g0"
    }`;
    const cached = await getCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const summary = await personalTransactionService.getSummary(user.id, {
      month,
      year,
      includeGroupExpenses,
    });

    const withLabel = (label: (category: string) => string) => (item: {
      category: string;
      amount: number;
      count: number;
    }) => ({ ...item, label: label(item.category) });

    const result = {
      ...summary,
      expenseByCategory: summary.expenseByCategory.map(withLabel(getExpenseCategoryLabel)),
      incomeByCategory: summary.incomeByCategory.map(withLabel(getIncomeCategoryLabel)),
    };
    await setCache(cacheKey, result, 120);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Personal summary fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
