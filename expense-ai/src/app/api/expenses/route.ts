import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { groupExpenseService } from "@/lib/group-expense-service";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { inferExpenseCategory, normalizeExpenseCategory } from "@/lib/expense-categories";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { amount, description, groupId, paidById, splits, category } = await req.json();

    if (!amount || !description) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    if (groupId) {
      try {
        const expense = await groupExpenseService.create({
          groupId,
          requesterId: user.id,
          actorName: user.name || "",
          actorEmail: user.email,
          amount,
          description,
          paidById,
          splits,
          category,
        });

        await publishGroupEvent(groupId, "EXPENSE_ADDED");
        return NextResponse.json(expense, { status: 201 });
      } catch (error) {
        if (error instanceof Error) {
          const status = error.message === "You are not a member of this group" ? 403 : 400;
          return NextResponse.json({ message: error.message }, { status });
        }

        throw error;
      }
    }

    const payerUserId = paidById || user.id;
    const expenseCategory = category
      ? normalizeExpenseCategory(category)
      : inferExpenseCategory(description);
    let expenseSplitData: { userId: string, amount: number }[] = [];

    if (splits && Array.isArray(splits) && splits.length > 0) {
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);

      if (Math.abs(totalSplitAmount - parseFloat(amount)) > 0.1) {
         return NextResponse.json({ message: "Split amounts must equal the total expense amount" }, { status: 400 });
      }
      
      expenseSplitData = splits;
    } else {
      return NextResponse.json({ message: "Splits are required for individual payments" }, { status:400 });
    }

    // Create the expense and splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          amount: parseFloat(amount),
          description,
          category: expenseCategory,
          groupId: groupId || null,
          paidById: payerUserId,
        },
      });

      await tx.expenseSplit.createMany({
        data: expenseSplitData.map((split) => ({
          expenseId: newExpense.id,
          userId: split.userId,
          amount: split.amount,
        })),
      });

      // Create activity log
      await tx.activity.create({
        data: {
          type: "EXPENSE_ADDED",
          message: `${user.name || session.user?.email} added "${description}"`,
          groupId: groupId || null,
          userId: user.id,
          metadata: {
            amount: parseFloat(amount),
            description,
            category: expenseCategory,
            splitUserIds: expenseSplitData.map((split) => split.userId),
            paidById: payerUserId,
          }
        }
      });

      return newExpense;
    });

    if (groupId) {
        await publishGroupEvent(groupId, "EXPENSE_ADDED");
    } else {
        await publishUserEvent(user.id, "EXPENSE_ADDED");
        // Individual update: broadcast to all split participants
        for (const split of expenseSplitData) {
            if (split.userId !== user.id) {
                await publishUserEvent(split.userId, "EXPENSE_ADDED");
            }
        }
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Expense creation error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
