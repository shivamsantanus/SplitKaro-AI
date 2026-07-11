import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseExpensesFromText } from "@/lib/telegram-expense-parser";

export async function POST(req: Request) {
  try {
    const [session, body] = await Promise.all([
      getServerSession(authOptions),
      req.json(),
    ]);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { text } = body;

    if (!text?.trim()) {
      return NextResponse.json({ message: "Text is required" }, { status: 400 });
    }

    const expenses = await parseExpensesFromText(text);

    if (expenses.length === 0) {
      return NextResponse.json(
        { message: "Nothing detected. Try speaking more clearly." },
        { status: 422 }
      );
    }

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Personal parse error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
