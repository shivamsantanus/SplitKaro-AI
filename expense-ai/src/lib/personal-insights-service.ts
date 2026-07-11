import { callAI } from "@/lib/ai-client";
import { personalTransactionService } from "@/lib/personal-transaction-service";
import { getExpenseCategoryLabel } from "@/lib/expense-categories";
import { getIncomeCategoryLabel } from "@/lib/income-categories";

export type InsightTone = "positive" | "neutral" | "watch";

export type PersonalInsight = {
  text: string;
  tone: InsightTone;
};

export type PersonalInsights = {
  summary: string;
  insights: PersonalInsight[];
  empty: boolean;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function stripMarkdown(text: string): string {
  return text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
}

function normalizeTone(value: unknown): InsightTone {
  return value === "positive" || value === "watch" ? value : "neutral";
}

type Filters = { month?: number | null; year?: number | null };

export const personalInsightsService = {
  async generate(ownerId: string, filters: Filters = {}): Promise<PersonalInsights> {
    const summary = await personalTransactionService.getSummary(ownerId, {
      ...filters,
      includeGroupExpenses: true,
    });

    const income = Math.round(summary.totals.income.monthlyAmount);
    const expense = Math.round(summary.totals.expense.monthlyAmount);
    const entries = summary.totals.income.monthlyCount + summary.totals.expense.monthlyCount;

    // Nothing to analyze — don't spend an AI call inventing observations.
    if (entries === 0) {
      return { summary: "", insights: [], empty: true };
    }

    const net = Math.round(summary.totals.net.monthlyAmount);
    const savingsRate = Math.round(summary.totals.savingsRate * 100);
    const monthLabel = `${MONTH_NAMES[summary.totals.month - 1]} ${summary.totals.year}`;

    const topExpenses = summary.expenseByCategory
      .slice(0, 5)
      .map((c) => `${getExpenseCategoryLabel(c.category)} ₹${Math.round(c.amount)}`)
      .join(", ") || "none";
    const incomeSources = summary.incomeByCategory
      .slice(0, 5)
      .map((c) => `${getIncomeCategoryLabel(c.category)} ₹${Math.round(c.amount)}`)
      .join(", ") || "none";
    const trend = summary.monthlySummary
      .map((m) => `${m.month}: in ₹${Math.round(m.income)} out ₹${Math.round(m.expense)} net ₹${Math.round(m.net)}`)
      .join("; ");

    const prompt = `You are a personal-finance assistant for an Indian user. Amounts are in Indian rupees (₹).

Based ONLY on the monthly summary data below, write 3 short, FACTUAL observations about this user's spending and saving. Be descriptive and neutral. Do NOT give financial, investment, or budgeting advice, and do NOT tell the user what they should do — only describe what the numbers show (comparisons across categories or months are welcome). Each observation must be under 20 words.

Return ONLY raw JSON — no markdown, no code fences:
{"summary":"<one short headline sentence>","insights":[{"text":"<observation>","tone":"positive"},{"text":"<observation>","tone":"neutral"},{"text":"<observation>","tone":"watch"}]}

Use tone "positive" for good signs (money saved, income up), "watch" for rising spending or a negative net, and "neutral" otherwise.

Data:
Month: ${monthLabel}
Income this month: ₹${income}
Expenses this month: ₹${expense}
Net this month: ₹${net} (${savingsRate}% of income saved)
Top expense categories: ${topExpenses}
Income sources: ${incomeSources}
Last 6 months (income/expense/net): ${trend}`;

    try {
      const raw = await callAI(prompt);
      const parsed = JSON.parse(stripMarkdown(raw)) as unknown;

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray((parsed as { insights?: unknown }).insights)
      ) {
        return { summary: "", insights: [], empty: false };
      }

      const obj = parsed as { summary?: unknown; insights: unknown[] };
      const insights = obj.insights
        .filter(
          (i): i is Record<string, unknown> =>
            i !== null && typeof i === "object" && typeof (i as { text?: unknown }).text === "string"
        )
        .slice(0, 4)
        .map((i) => ({
          text: String(i.text).trim(),
          tone: normalizeTone(i.tone),
        }));

      return {
        summary: typeof obj.summary === "string" ? obj.summary.trim() : "",
        insights,
        empty: false,
      };
    } catch {
      // AI or parse failure — degrade gracefully, never break the page.
      return { summary: "", insights: [], empty: false };
    }
  },
};
