export const EXPENSE_CATEGORIES = [
  { value: "FOOD", label: "Food" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "GROCERIES", label: "Groceries" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "TRAVEL", label: "Travel" },
  { value: "RENT", label: "Rent" },
  { value: "SHOPPING", label: "Shopping" },
  { value: "BILLS", label: "Bills" },
  { value: "HEALTH", label: "Health" },
  { value: "OTHER", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

const CATEGORY_KEYWORDS: Array<{ category: ExpenseCategory; patterns: RegExp[] }> = [
  { category: "FOOD", patterns: [/\bdinner\b/i, /\blunch\b/i, /\bbreakfast\b/i, /\bmeal\b/i, /\brestaurant\b/i, /\bcafe\b/i, /\bfood\b/i, /\bsnacks?\b/i] },
  { category: "TRANSPORT", patterns: [/\btaxi\b/i, /\bcab\b/i, /\buber\b/i, /\bola\b/i, /\bmetro\b/i, /\bbus\b/i, /\bpetrol\b/i, /\bfuel\b/i, /\btransport\b/i] },
  { category: "GROCERIES", patterns: [/\bgrocery\b/i, /\bgroceries\b/i, /\bsupermarket\b/i, /\bvegetables?\b/i, /\bmilk\b/i] },
  { category: "ENTERTAINMENT", patterns: [/\bmovie\b/i, /\bmovies\b/i, /\bparty\b/i, /\bclub\b/i, /\bgame\b/i, /\bconcert\b/i] },
  { category: "TRAVEL", patterns: [/\btrip\b/i, /\btravel\b/i, /\bflight\b/i, /\bhotel\b/i, /\bbooking\b/i] },
  { category: "RENT", patterns: [/\brent\b/i, /\baccommodation\b/i, /\bstay\b/i] },
  { category: "SHOPPING", patterns: [/\bshopping\b/i, /\bcloth(?:es|ing)?\b/i, /\bamazon\b/i, /\bmall\b/i] },
  { category: "BILLS", patterns: [/\bbill\b/i, /\belectricity\b/i, /\bwater\b/i, /\binternet\b/i, /\bwifi\b/i, /\bsubscription\b/i] },
  { category: "HEALTH", patterns: [/\bmedicine\b/i, /\bmedical\b/i, /\bdoctor\b/i, /\bhospital\b/i, /\bhealth\b/i] },
];

export function normalizeExpenseCategory(category?: string | null): ExpenseCategory {
  if (!category) {
    return "OTHER";
  }

  const upper = category.toUpperCase();
  return (EXPENSE_CATEGORIES.find((item) => item.value === upper)?.value ?? "OTHER") as ExpenseCategory;
}

export function inferExpenseCategory(description: string): ExpenseCategory {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(description))) {
      return entry.category;
    }
  }

  return "OTHER";
}

export function getExpenseCategoryLabel(category: string) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? "Other";
}

export function getExpenseCategoryIconName(category: string) {
  switch (normalizeExpenseCategory(category)) {
    case "FOOD":
      return "food";
    case "TRANSPORT":
      return "transport";
    case "GROCERIES":
      return "groceries";
    case "ENTERTAINMENT":
      return "entertainment";
    case "TRAVEL":
      return "travel";
    case "RENT":
      return "rent";
    case "SHOPPING":
      return "shopping";
    case "BILLS":
      return "bills";
    case "HEALTH":
      return "health";
    default:
      return "other";
  }
}
