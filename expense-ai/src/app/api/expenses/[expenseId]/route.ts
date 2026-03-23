import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { expenseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { expenseId } = await (params as any);

    // Verify expense exists and belongs to a group the user is in
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: { include: { members: { include: { user: true } } } } },
    });

    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

    const isMember = expense.group.members.some(m => m.user?.email === session?.user?.email);
    if (!isMember) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });

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

    return NextResponse.json({ message: "Expense deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { expenseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { expenseId } = await (params as any);
    const { amount, description, paidById, splits } = await req.json();

    if (!amount || !description) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: { include: { members: true } } },
    });

    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

    const members = expense.group.members;
    
    let expenseSplitData: { userId: string, amount: number, expenseId?: string }[] = [];

    if (splits && Array.isArray(splits) && splits.length > 0) {
      // Validate Custom Splits
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);
      
      // Allow a small margin of error for floating point calculations
      if (Math.abs(totalSplitAmount - parseFloat(amount)) > 0.1) {
         return NextResponse.json({ message: "Split amounts must equal the total expense amount" }, { status: 400 });
      }
      expenseSplitData = splits;
    } else {
      // Default behavior
      const splitAmount = parseFloat(amount) / members.length;
      expenseSplitData = members.map((member) => ({
          userId: member.userId,
          amount: splitAmount,
      }));
    }

    // Update expense and recreate splits atomically
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // 1. Update the core expense
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          amount: parseFloat(amount),
          description,
          paidById: paidById || expense.paidById,
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
      const user = await tx.user.findUnique({ where: { email: session?.user?.email! } });
      if (user) {
        await tx.activity.create({
          data: {
            type: "EXPENSE_EDITED",
            message: `${user.name || user.email} updated "${description}"`,
            groupId: expense.groupId,
            userId: user.id,
            metadata: { description, amount: parseFloat(amount) }
          }
        });
      }

      return updated;
    });

    return NextResponse.json(updatedExpense, { status: 200 });
  } catch (error) {
    console.error("Update expense error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
