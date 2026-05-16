import type { TransactionType } from "./types";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Groceries",
  "Restaurants",
  "Fitness",
  "Transportation",
  "Entertainment",
  "Subscriptions",
  "Shopping",
  "Travel",
  "Misc",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Side Income",
  "Interest",
  "Dividends",
  "Misc",
] as const;

export const INVESTMENT_CATEGORIES = [
  "Roth IRA",
  "Brokerage",
  "401k",
  "Crypto",
  "Business",
  "Misc",
] as const;

export function categoriesFor(type: TransactionType): readonly string[] {
  switch (type) {
    case "income":
      return INCOME_CATEGORIES;
    case "investment":
      return INVESTMENT_CATEGORIES;
    case "expense":
    default:
      return EXPENSE_CATEGORIES;
  }
}

export const ALL_CATEGORIES: readonly string[] = Array.from(
  new Set<string>([
    ...EXPENSE_CATEGORIES,
    ...INCOME_CATEGORIES,
    ...INVESTMENT_CATEGORIES,
  ]),
);
