import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { findUserByEmailWithSelect } from "@/lib/users";
import { invalidatePersonalCaches } from "@/lib/cache-invalidation";

export async function POST(req: Request) {
  try {
    const [session, body] = await Promise.all([
      getServerSession(authOptions),
      req.json(),
    ]);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { expenses } = body;

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return NextResponse.json({ message: "expenses array required" }, { status: 400 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const transactions = await Promise.all(
      expenses.map((exp: { amount: number; description: string; category: string; transactionDate: string }) =>
        personalTransactionService.create({
          ownerId: user.id,
          amount: exp.amount,
          description: exp.description,
          category: exp.category,
          transactionDate: exp.transactionDate,
        })
      )
    );

    // Deduplicate (year, month) pairs before invalidating cache
    const monthKeys = new Set(
      expenses.map((exp: { transactionDate: string }) => {
        const d = new Date(exp.transactionDate);
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
      })
    );
    await Promise.all(
      [...monthKeys].map((key) => {
        const [year, month] = key.split("-").map(Number);
        return invalidatePersonalCaches(user.id, year, month);
      })
    );

    return NextResponse.json({ transactions }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Personal batch create error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
