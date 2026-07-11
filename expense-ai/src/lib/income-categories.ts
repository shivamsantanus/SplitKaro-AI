export const INCOME_CATEGORIES = [
  { value: "SALARY", label: "Salary" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "BUSINESS", label: "Business" },
  { value: "CASHBACK", label: "Cashback" },
  { value: "REWARDS", label: "Rewards" },
  { value: "INTEREST", label: "Interest" },
  { value: "REFUND", label: "Refund" },
  { value: "GIFT", label: "Gift" },
  { value: "OTHER_INCOME", label: "Other" },
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]["value"];

const CATEGORY_KEYWORDS: Array<{ category: IncomeCategory; patterns: RegExp[] }> = [
  { category: "SALARY", patterns: [/\bsalary\b/i, /\bpayroll\b/i, /\bstipend\b/i, /\bwages?\b/i, /\bpaycheck\b/i] },
  { category: "FREELANCE", patterns: [/\bfreelance\b/i, /\bcontract\b/i, /\bgig\b/i, /\bconsulting\b/i, /\bclient\b/i] },
  { category: "BUSINESS", patterns: [/\bbusiness\b/i, /\bsales\b/i, /\brevenue\b/i, /\bprofit\b/i] },
  { category: "CASHBACK", patterns: [/\bcashback\b/i, /\bcash back\b/i] },
  { category: "REWARDS", patterns: [/\breward\b/i, /\brewards\b/i, /\bpoints?\b/i, /\bredeem(?:ed)?\b/i] },
  { category: "INTEREST", patterns: [/\binterest\b/i, /\bdividend\b/i, /\bfd\b/i, /\bmaturity\b/i] },
  { category: "REFUND", patterns: [/\brefund\b/i, /\breimburse(?:ment|d)?\b/i, /\breturn\b/i] },
  { category: "GIFT", patterns: [/\bgift\b/i, /\bpresent\b/i, /\bbonus\b/i] },
];

export function normalizeIncomeCategory(category?: string | null): IncomeCategory {
  if (!category) {
    return "OTHER_INCOME";
  }

  const upper = category.toUpperCase();
  return (INCOME_CATEGORIES.find((item) => item.value === upper)?.value ?? "OTHER_INCOME") as IncomeCategory;
}

export function inferIncomeCategory(description: string): IncomeCategory {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(description))) {
      return entry.category;
    }
  }

  return "OTHER_INCOME";
}

export function getIncomeCategoryLabel(category: string) {
  return INCOME_CATEGORIES.find((item) => item.value === category)?.label ?? "Other";
}

export function getIncomeCategoryIconName(category: string) {
  switch (normalizeIncomeCategory(category)) {
    case "SALARY":
      return "salary";
    case "FREELANCE":
      return "freelance";
    case "BUSINESS":
      return "business";
    case "CASHBACK":
      return "cashback";
    case "REWARDS":
      return "rewards";
    case "INTEREST":
      return "interest";
    case "REFUND":
      return "refund";
    case "GIFT":
      return "gift";
    default:
      return "other_income";
  }
}
