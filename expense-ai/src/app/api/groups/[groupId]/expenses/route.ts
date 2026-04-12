import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groupExpenseService } from "@/lib/group-expense-service";
import { publishGroupEvent } from "@/lib/realtime";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
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

    const { groupId } = await params;
    const expenses = await groupExpenseService.list(groupId, user.id);

    return NextResponse.json(expenses);
  } catch (error) {
    if (error instanceof Error && error.message === "You are not a member of this group") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Group expenses fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { groupId } = await params;
    const { amount, description, paidById, splits, category } = await req.json();

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
      const status =
        error.message === "You are not a member of this group"
          ? 403
          : 400;
      return NextResponse.json({ message: error.message }, { status });
    }

    console.error("Group expense create error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
