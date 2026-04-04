import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { inferExpenseCategory, normalizeExpenseCategory } from "@/lib/expense-categories";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { expenseId } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        description: true,
        amount: true,
        groupId: true,
        paidById: true,
        splits: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    if (expense.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: expense.groupId,
            userId: user.id,
          },
        },
      });

      if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    } else {
      const isParticipant =
        expense.paidById === user.id ||
        expense.splits.some((split) => split.userId === user.id);

      if (!isParticipant) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    // Mark activity before deletion (since cascade deletes it)
    if (user) {
      await prisma.activity.create({
        data: {
          type: "EXPENSE_DELETED",
          message: `${user.name || user.email} deleted "${expense.description}"`,
          groupId: expense.groupId,
          userId: user.id,
          metadata: { description: expense.description, amount: expense.amount }
        }
      });
    }

    // Because of onDelete: Cascade in Prisma Schema, deleting the Expense deletes the ExpenseSplits
    await prisma.expense.delete({
      where: { id: expenseId },
    });

    if (expense.groupId) {
      await publishGroupEvent(expense.groupId, "EXPENSE_DELETED");
    } else {
      const participantIds = new Set([
        expense.paidById,
        ...expense.splits.map((split) => split.userId),
      ]);

      for (const participantId of participantIds) {
        if (participantId !== user.id) {
          await publishUserEvent(participantId, "EXPENSE_DELETED");
        }
      }
    }

    return NextResponse.json({ message: "Expense deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { expenseId } = await params;
    const { amount, description, paidById, splits, category } = await req.json();

    if (!amount || !description) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        groupId: true,
        paidById: true,
        group: {
          select: {
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
        splits: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    let members: { userId: string }[] = [];
    let memberIds = new Set<string>();

    if (expense.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: expense.groupId,
            userId: user.id,
          },
        },
      });

      if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      if (!expense.group) {
        return NextResponse.json({ message: "Group not found" }, { status: 404 });
      }

      members = expense.group.members;
      memberIds = new Set(members.map((member) => member.userId));
    } else {
      const participantIds = new Set([
        expense.paidById,
        ...expense.splits.map((split) => split.userId),
      ]);

      if (!participantIds.has(user.id)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      memberIds = participantIds;
    }
    
    let expenseSplitData: { userId: string, amount: number, expenseId?: string }[] = [];
    const payerUserId = paidById || expense.paidById;
    const expenseCategory = category
      ? normalizeExpenseCategory(category)
      : inferExpenseCategory(description);

    if (expense.groupId && !memberIds.has(payerUserId)) {
      return NextResponse.json(
        { message: "Payer must be a member of this group" },
        { status: 400 }
      );
    }

    if (splits && Array.isArray(splits) && splits.length > 0) {
      // Validate Custom Splits
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);

      const hasInvalidSplitUser = splits.some(
        (split) =>
          !split?.userId || (expense.groupId && !memberIds.has(split.userId))
      );
      if (hasInvalidSplitUser) {
        return NextResponse.json(
          { message: "All split users must be members of this group" },
          { status: 400 }
        );
      }
      
      // Allow a small margin of error for floating point calculations
      if (Math.abs(totalSplitAmount - parseFloat(amount)) > 0.1) {
         return NextResponse.json({ message: "Split amounts must equal the total expense amount" }, { status: 400 });
      }
      expenseSplitData = splits;
    } else if (expense.groupId) {
      // Default behavior
      const splitAmount = parseFloat(amount) / members.length;
      expenseSplitData = members.map((member) => ({
          userId: member.userId,
          amount: splitAmount,
      }));
    } else {
      return NextResponse.json(
        { message: "Splits are required for individual payments" },
        { status: 400 }
      );
    }

    // Update expense and recreate splits atomically
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // 1. Update the core expense
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          amount: parseFloat(amount),
          description,
          category: expenseCategory,
          paidById: payerUserId,
        },
      });

      // 2. Delete old splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId: expenseId },
      });

      // 3. Create new accurate splits
      await tx.expenseSplit.createMany({
        data: expenseSplitData.map((split) => ({
          expenseId: updated.id,
          userId: split.userId,
          amount: split.amount,
        })),
      });

      // Log activity
      await tx.activity.create({
        data: {
          type: "EXPENSE_EDITED",
          message: `${user.name || user.email} updated "${description}"`,
          groupId: expense.groupId,
          userId: user.id,
          metadata: { description, amount: parseFloat(amount), category: expenseCategory }
        }
      });

      return updated;
    });

    if (expense.groupId) {
      await publishGroupEvent(expense.groupId, "EXPENSE_UPDATED");
    } else {
      const participantIds = new Set([
        payerUserId,
        ...expenseSplitData.map((split) => split.userId),
      ]);

      for (const participantId of participantIds) {
        if (participantId !== user.id) {
          await publishUserEvent(participantId, "EXPENSE_UPDATED");
        }
      }
    }

    return NextResponse.json(updatedExpense, { status: 200 });
  } catch (error) {
    console.error("Update expense error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
