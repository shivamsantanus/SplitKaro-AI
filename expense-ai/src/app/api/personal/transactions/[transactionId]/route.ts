import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ transactionId: string }> }
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

    const { transactionId } = await params;
    const { amount, description, category, transactionDate } = await req.json();

    const transaction = await personalTransactionService.update({
      transactionId,
      ownerId: user.id,
      amount,
      description,
      category,
      transactionDate,
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Transaction not found" ? 404 : 400;
      return NextResponse.json({ message: error.message }, { status });
    }

    console.error("Personal transaction update error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ transactionId: string }> }
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

    const { transactionId } = await params;
    await personalTransactionService.remove(transactionId, user.id);

    return NextResponse.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Transaction not found" ? 404 : 400;
      return NextResponse.json({ message: error.message }, { status });
    }

    console.error("Personal transaction delete error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
