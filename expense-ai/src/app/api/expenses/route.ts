import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { amount, description, groupId, paidById } = await req.json();

    if (!amount || !description || !groupId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Check if group exists and user is a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // Get all members of the group to split equally
    const members = await prisma.groupMember.findMany({
      where: { groupId },
    });

    const splitAmount = parseFloat(amount) / members.length;

    // Create the expense and splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          amount: parseFloat(amount),
          description,
          groupId,
          paidById: paidById || user.id,
        },
      });

      // Create splits for every member
      await tx.expenseSplit.createMany({
        data: members.map((member) => ({
          expenseId: newExpense.id,
          userId: member.userId,
          amount: splitAmount,
        })),
      });

      return newExpense;
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Expense creation error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
