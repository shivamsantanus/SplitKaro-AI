import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    const transactions = await personalTransactionService.list(user.id, { month, year });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Personal transactions fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const { amount, description, category, transactionDate } = await req.json();

    const transaction = await personalTransactionService.create({
      ownerId: user.id,
      amount,
      description,
      category,
      transactionDate,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Personal transaction create error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
