import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExpenseCategoryLabel } from "@/lib/expense-categories";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { findUserByEmailWithSelect } from "@/lib/users";

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

    const summary = await personalTransactionService.getSummary(user.id, { month, year });

    return NextResponse.json({
      ...summary,
      categoryBreakdown: summary.categoryBreakdown.map((item: { category: string; amount: number; count: number }) => ({
        ...item,
        label: getExpenseCategoryLabel(item.category),
      })),
    });
  } catch (error) {
    console.error("Personal summary fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
