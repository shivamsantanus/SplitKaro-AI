import { callAI } from "@/lib/ai-client";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export interface ParsedExpense {
  description: string;
  amount: number;
  category: string;
  transactionDate: string;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function stripMarkdown(text: string): string {
  return text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
}

export async function parseExpensesFromText(text: string): Promise<ParsedExpense[]> {
  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86400000));
  const categoryValues = EXPENSE_CATEGORIES.map((c) => c.value).join(", ");

  const prompt = `Today's date is ${today}.

Extract every personal expense from the text below. Return ONLY a raw JSON array — no markdown, no code blocks, no explanation.

Each item must have exactly these fields:
- "description": short string describing what was spent on
- "amount": number in rupees (convert words like "two hundred" → 200, "fifty" → 50)
- "category": one of: ${categoryValues}
- "transactionDate": YYYY-MM-DD. Resolve relative dates: "today" → ${today}, "yesterday" → ${yesterday}. If no date mentioned, use ${today}.

Text: "${text.replace(/"/g, "'")}"

Return only the JSON array, e.g.: [{"description":"coffee","amount":80,"category":"FOOD","transactionDate":"${today}"}]`;

  const raw = await callAI(prompt);
  const cleaned = stripMarkdown(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null &&
        typeof item === "object" &&
        typeof item.description === "string" &&
        typeof item.amount === "number" &&
        item.amount > 0
    )
    .map((item) => ({
      description: String(item.description).trim(),
      amount: Number(item.amount),
      category: typeof item.category === "string" ? item.category : "OTHER",
      transactionDate:
        typeof item.transactionDate === "string" ? item.transactionDate : today,
    }));
}
