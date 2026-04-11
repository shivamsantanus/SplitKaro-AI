import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callAI } from "@/lib/ai-client";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function stripMarkdown(text: string): string {
  return text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ message: "Text is required" }, { status: 400 });
    }

    const today = toISODate(new Date());
    const yesterday = toISODate(new Date(Date.now() - 86400000));
    const categoryValues = EXPENSE_CATEGORIES.map((c) => c.value).join(", ");

    const prompt = `Today's date is ${today}.

Extract every personal expense from the transcript below. Return ONLY a raw JSON array — no markdown, no code blocks, no explanation.

Each item must have exactly these fields:
- "description": short string describing what was spent on
- "amount": number in rupees (convert words like "two hundred" → 200, "fifty" → 50)
- "category": one of: ${categoryValues}
- "transactionDate": YYYY-MM-DD. Resolve relative dates: "today" → ${today}, "yesterday" → ${yesterday}. If no date mentioned, use ${today}.

Transcript: "${text.replace(/"/g, "'")}"

Return only the JSON array, e.g.: [{"description":"coffee","amount":80,"category":"FOOD","transactionDate":"${today}"}]`;

    const raw = await callAI(prompt);
    const cleaned = stripMarkdown(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { message: "Could not parse AI response. Please try again." },
        { status: 422 }
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { message: "Unexpected response format from AI." },
        { status: 422 }
      );
    }

    const expenses = parsed
      .filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" &&
        typeof item.description === "string" &&
        typeof item.amount === "number" &&
        item.amount > 0
      )
      .map((item) => ({
        description: String(item.description).trim(),
        amount: Number(item.amount),
        category: typeof item.category === "string" ? item.category : "OTHER",
        transactionDate: typeof item.transactionDate === "string" ? item.transactionDate : today,
      }));

    if (expenses.length === 0) {
      return NextResponse.json(
        { message: "No expenses detected. Try speaking more clearly." },
        { status: 422 }
      );
    }

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Personal parse error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
