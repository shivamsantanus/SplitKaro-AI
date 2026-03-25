import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/realtime";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { amount, description, groupId, paidById, splits } = await req.json();

    if (!amount || !description || !groupId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if group exists and user is a member
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // Get all members of the group to split equally if splits are NOT declared custom
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
      },
    });
    const memberIds = new Set(members.map((member) => member.userId));

    let expenseSplitData: { userId: string, amount: number, expenseId?: string }[] = [];

    const payerUserId = paidById || user.id;

    if (!memberIds.has(payerUserId)) {
      return NextResponse.json(
        { message: "Payer must be a member of this group" },
        { status: 400 }
      );
    }

    if (splits && Array.isArray(splits) && splits.length > 0) {
      // Validate Custom Splits
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);

      const hasInvalidSplitUser = splits.some(
        (split) => !split?.userId || !memberIds.has(split.userId)
      );
      if (hasInvalidSplitUser) {
        return NextResponse.json(
          { message: "All split users must be members of this group" },
          { status: 400 }
        );
      }
      
      // Allow a small margin of error for floating point calculations (e.g., 0.01)
      if (Math.abs(totalSplitAmount - parseFloat(amount)) > 0.1) {
         return NextResponse.json({ message: "Split amounts must equal the total expense amount" }, { status: 400 });
      }
      
      expenseSplitData = splits;
    } else {
      // Default behavior: completely equal among ALL members
      const splitAmount = parseFloat(amount) / members.length;
      expenseSplitData = members.map((member) => ({
          userId: member.userId,
          amount: splitAmount,
      }));
    }

    // Create the expense and splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          amount: parseFloat(amount),
          description,
          groupId,
          paidById: payerUserId,
        },
      });

      // Create splits for every active member
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
          groupId,
          userId: user.id,
          metadata: { amount: parseFloat(amount), description }
        }
      });

      return newExpense;
    });

    await publishGroupEvent(groupId, "EXPENSE_ADDED");

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Expense creation error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
