/**
 * Plaid Personal Finance Category (PFC) → Jarvis category mapping.
 *
 * Plaid returns a two-level taxonomy on every transaction:
 *   personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" }
 *
 * Reference: https://plaid.com/docs/api/products/transactions/#personal_finance_category
 *
 * We collapse the rich Plaid taxonomy to the much smaller Jarvis set
 * defined in lib/categories.ts. We map the `detailed` field first (more
 * specific), then fall back to the `primary` field, then default to
 * "Misc" for expenses and "Misc" for income.
 *
 * `kind` tells the caller whether the row should land in our INCOME or
 * EXPENSE bucket — this is the source of truth for `Transaction.type`,
 * NOT the raw amount sign (Plaid's sign convention is per-account-subtype
 * and easy to mis-handle).
 */

import type { TransactionType } from "../types";

export type JarvisCategoryKind = Extract<TransactionType, "income" | "expense">;

export interface MappedCategory {
  category: string;
  kind: JarvisCategoryKind;
}

const DETAILED: Record<string, MappedCategory> = {
  // ---- Income ---------------------------------------------------------
  INCOME_WAGES: { category: "Salary", kind: "income" },
  INCOME_TAX_REFUND: { category: "Misc", kind: "income" },
  INCOME_UNEMPLOYMENT: { category: "Misc", kind: "income" },
  INCOME_RETIREMENT_PENSION: { category: "Misc", kind: "income" },
  INCOME_DIVIDENDS: { category: "Dividends", kind: "income" },
  INCOME_INTEREST_EARNED: { category: "Interest", kind: "income" },
  INCOME_OTHER_INCOME: { category: "Side Income", kind: "income" },

  // ---- Transfers (treated as expenses where amount > 0) ---------------
  TRANSFER_IN_DEPOSIT: { category: "Misc", kind: "income" },
  TRANSFER_IN_OTHER_TRANSFER_IN: { category: "Misc", kind: "income" },
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: { category: "Misc", kind: "income" },

  // ---- Food + dining --------------------------------------------------
  FOOD_AND_DRINK_RESTAURANT: { category: "Restaurants", kind: "expense" },
  FOOD_AND_DRINK_FAST_FOOD: { category: "Restaurants", kind: "expense" },
  FOOD_AND_DRINK_COFFEE: { category: "Restaurants", kind: "expense" },
  FOOD_AND_DRINK_GROCERIES: { category: "Groceries", kind: "expense" },
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: { category: "Groceries", kind: "expense" },
  FOOD_AND_DRINK_VENDING_MACHINES: { category: "Misc", kind: "expense" },

  // ---- Rent + utilities ----------------------------------------------
  RENT_AND_UTILITIES_RENT: { category: "Rent", kind: "expense" },
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: { category: "Rent", kind: "expense" },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: { category: "Subscriptions", kind: "expense" },
  RENT_AND_UTILITIES_TELEPHONE: { category: "Subscriptions", kind: "expense" },
  RENT_AND_UTILITIES_WATER: { category: "Rent", kind: "expense" },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: { category: "Rent", kind: "expense" },

  // ---- Transportation -------------------------------------------------
  TRANSPORTATION_GAS: { category: "Transportation", kind: "expense" },
  TRANSPORTATION_PUBLIC_TRANSIT: { category: "Transportation", kind: "expense" },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: { category: "Transportation", kind: "expense" },
  TRANSPORTATION_PARKING: { category: "Transportation", kind: "expense" },
  TRANSPORTATION_TOLLS: { category: "Transportation", kind: "expense" },

  // ---- Travel ---------------------------------------------------------
  TRAVEL_FLIGHTS: { category: "Travel", kind: "expense" },
  TRAVEL_LODGING: { category: "Travel", kind: "expense" },
  TRAVEL_RENTAL_CARS: { category: "Travel", kind: "expense" },

  // ---- Entertainment --------------------------------------------------
  ENTERTAINMENT_TV_AND_MOVIES: { category: "Entertainment", kind: "expense" },
  ENTERTAINMENT_MUSIC_AND_AUDIO: { category: "Entertainment", kind: "expense" },
  ENTERTAINMENT_VIDEO_GAMES: { category: "Entertainment", kind: "expense" },
  ENTERTAINMENT_CASINOS_AND_GAMBLING: { category: "Entertainment", kind: "expense" },
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: {
    category: "Entertainment",
    kind: "expense",
  },

  // ---- Subscriptions / general services -------------------------------
  GENERAL_SERVICES_INSURANCE: { category: "Subscriptions", kind: "expense" },
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: { category: "Subscriptions", kind: "expense" },

  // ---- Shopping -------------------------------------------------------
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: { category: "Shopping", kind: "expense" },
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: { category: "Shopping", kind: "expense" },
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: { category: "Shopping", kind: "expense" },
  GENERAL_MERCHANDISE_ELECTRONICS: { category: "Shopping", kind: "expense" },
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: { category: "Shopping", kind: "expense" },

  // ---- Health / fitness ----------------------------------------------
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: { category: "Fitness", kind: "expense" },
  PERSONAL_CARE_HAIR_AND_BEAUTY: { category: "Shopping", kind: "expense" },
  MEDICAL_PRIMARY_CARE: { category: "Misc", kind: "expense" },
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: { category: "Misc", kind: "expense" },
};

const PRIMARY_FALLBACK: Record<string, MappedCategory> = {
  INCOME: { category: "Side Income", kind: "income" },
  TRANSFER_IN: { category: "Misc", kind: "income" },
  TRANSFER_OUT: { category: "Misc", kind: "expense" },
  LOAN_PAYMENTS: { category: "Misc", kind: "expense" },
  BANK_FEES: { category: "Misc", kind: "expense" },
  ENTERTAINMENT: { category: "Entertainment", kind: "expense" },
  FOOD_AND_DRINK: { category: "Restaurants", kind: "expense" },
  GENERAL_MERCHANDISE: { category: "Shopping", kind: "expense" },
  HOME_IMPROVEMENT: { category: "Misc", kind: "expense" },
  MEDICAL: { category: "Misc", kind: "expense" },
  PERSONAL_CARE: { category: "Shopping", kind: "expense" },
  GENERAL_SERVICES: { category: "Subscriptions", kind: "expense" },
  GOVERNMENT_AND_NON_PROFIT: { category: "Misc", kind: "expense" },
  TRANSPORTATION: { category: "Transportation", kind: "expense" },
  TRAVEL: { category: "Travel", kind: "expense" },
  RENT_AND_UTILITIES: { category: "Rent", kind: "expense" },
};

const FALLBACK: MappedCategory = { category: "Misc", kind: "expense" };

export function mapPlaidCategory(
  primary?: string | null,
  detailed?: string | null,
): MappedCategory {
  if (detailed && DETAILED[detailed]) return DETAILED[detailed];
  if (primary && PRIMARY_FALLBACK[primary]) return PRIMARY_FALLBACK[primary];
  return FALLBACK;
}
