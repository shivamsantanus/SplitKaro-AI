import { callAI } from "@/lib/ai-client";
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from "@/lib/expense-categories";
import { INCOME_CATEGORIES, normalizeIncomeCategory } from "@/lib/income-categories";

export type ParsedTransactionType = "INCOME" | "EXPENSE";

export interface ParsedExpense {
  description: string;
  amount: number;
  category: string;
  type: ParsedTransactionType;
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
  const expenseCategories = EXPENSE_CATEGORIES.map((c) => c.value).join(", ");
  const incomeCategories = INCOME_CATEGORIES.map((c) => c.value).join(", ");

  const prompt = `Today's date is ${today}.

Extract every personal finance entry — both money SPENT and money RECEIVED — from the text below. Return ONLY a raw JSON array — no markdown, no code blocks, no explanation.

Each item must have exactly these fields:
- "type": "INCOME" for money received (salary, freelance pay, business income, card cashback, reward points redeemed, interest/dividends, refunds, gifts) or "EXPENSE" for money spent. If it is unclear, use "EXPENSE".
- "description": short string describing the entry
- "amount": positive number in rupees, always positive regardless of type (convert words like "two hundred" → 200, "fifty" → 50)
- "category": if "type" is "EXPENSE", one of: ${expenseCategories}. If "type" is "INCOME", one of: ${incomeCategories}.
- "transactionDate": YYYY-MM-DD. Resolve relative dates: "today" → ${today}, "yesterday" → ${yesterday}. If no date mentioned, use ${today}.

Text: "${text.replace(/"/g, "'")}"

Return only the JSON array, e.g.: [{"type":"EXPENSE","description":"coffee","amount":80,"category":"FOOD","transactionDate":"${today}"},{"type":"INCOME","description":"salary","amount":50000,"category":"SALARY","transactionDate":"${today}"}]`;

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
    .map((item) => {
      const type: ParsedTransactionType = item.type === "INCOME" ? "INCOME" : "EXPENSE";
      const rawCategory = typeof item.category === "string" ? item.category : undefined;
      const category =
        type === "INCOME"
          ? normalizeIncomeCategory(rawCategory)
          : normalizeExpenseCategory(rawCategory);

      return {
        description: String(item.description).trim(),
        amount: Number(item.amount),
        category,
        type,
        transactionDate:
          typeof item.transactionDate === "string" ? item.transactionDate : today,
      };
    });
}
