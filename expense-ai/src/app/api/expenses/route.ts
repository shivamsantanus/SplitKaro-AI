import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";

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

    if (!amount || !description) {
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

    const payerUserId = paidById || user.id;
    let memberIds = new Set<string>();

    if (groupId) {
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

      // Get all members of the group
      const members = await prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      memberIds = new Set(members.map((m) => m.userId));

      if (!memberIds.has(payerUserId)) {
        return NextResponse.json({ message: "Payer must be a member of this group" }, { status: 400 });
      }
    }

    let expenseSplitData: { userId: string, amount: number }[] = [];

    if (splits && Array.isArray(splits) && splits.length > 0) {
      // Validate Custom Splits
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);

      if (groupId) {
          const hasInvalidSplitUser = splits.some((split) => !split?.userId || !memberIds.has(split.userId));
          if (hasInvalidSplitUser) {
            return NextResponse.json({ message: "All split users must be members of this group" }, { status: 400 });
          }
      }
      
      if (Math.abs(totalSplitAmount - parseFloat(amount)) > 0.1) {
         return NextResponse.json({ message: "Split amounts must equal the total expense amount" }, { status: 400 });
      }
      
      expenseSplitData = splits;
    } else if (groupId) {
      // Default: equal among group members
      const members = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
      const splitAmount = parseFloat(amount) / members.length;
      expenseSplitData = members.map((m) => ({ userId: m.userId, amount: splitAmount }));
    } else {
        return NextResponse.json({ message: "Splits are required for individual payments" }, { status:400 });
    }

    // Create the expense and splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          amount: parseFloat(amount),
          description,
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
