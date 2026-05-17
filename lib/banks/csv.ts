/**
 * Bank-of-America CSV importer (also tolerates the lowest-common-denominator
 * Date / Description / Amount format that most US banks export).
 *
 * BoA export headers look like:
 *   Description,,Summary Amt.
 *   "Beginning balance as of 03/01/2026", ,"$1,234.56"
 *
 *   Date,Description,Amount,Running Bal.
 *   03/12/2026,"STARBUCKS STORE 12345",-5.43,"1,229.13"
 *
 * Plan dedupe key: `csv:<accountId>:<yyyy-mm-dd>:<amount-cents>:<normalized-description>`
 *
 * We deliberately do not auto-categorise CSV rows beyond "Misc" — categories
 * for hand-imported transactions are a UI exercise the user can do later
 * (and ideally we steer them to Plaid for auto-categorisation).
 */

import { getSupabase } from "../supabase";
import type { TransactionType } from "../types";

export interface CsvParseRow {
  date: string;
  description: string;
  amount: number;
  raw: string;
}

export interface CsvParseResult {
  rows: CsvParseRow[];
  skipped: number;
  detectedColumns: { date: number; description: number; amount: number };
}

export interface CsvImportSummary {
  imported: number;
  duplicates: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const DATE_RE = /^\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/;
const ISO_DATE_RE = /^\s*\d{4}-\d{2}-\d{2}\s*$/;

/** Split a single CSV line respecting double-quote escaping. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, mm, dd, yyRaw] = match;
  const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
  return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function findHeaderRow(rows: string[][]): {
  headerIdx: number;
  cols: { date: number; description: number; amount: number };
} | null {
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => c.toLowerCase());
    const dateIdx = cells.findIndex((c) => c === "date" || c === "posted date" || c === "transaction date");
    const descIdx = cells.findIndex((c) => c === "description" || c === "memo" || c === "name");
    const amtIdx = cells.findIndex(
      (c) => c === "amount" || c === "transaction amount" || c === "debit" || c === "credit",
    );
    if (dateIdx >= 0 && descIdx >= 0 && amtIdx >= 0) {
      return { headerIdx: i, cols: { date: dateIdx, description: descIdx, amount: amtIdx } };
    }
  }
  return null;
}

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.map(splitCsvLine);
  const header = findHeaderRow(rows);

  let cols = { date: 0, description: 1, amount: 2 };
  let dataStart = 0;
  if (header) {
    cols = header.cols;
    dataStart = header.headerIdx + 1;
  } else {
    // Headerless fallback: assume the first cell that looks like a date is the date column.
    const candidate = rows.findIndex((r) => r.some((c) => DATE_RE.test(c) || ISO_DATE_RE.test(c)));
    if (candidate < 0) {
      return { rows: [], skipped: rows.length, detectedColumns: cols };
    }
    dataStart = candidate;
  }

  const out: CsvParseRow[] = [];
  let skipped = 0;
  for (let i = dataStart; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.length < Math.max(cols.date, cols.description, cols.amount) + 1) {
      skipped += 1;
      continue;
    }
    const date = parseDate(r[cols.date] ?? "");
    const amount = parseAmount(r[cols.amount] ?? "");
    const description = (r[cols.description] ?? "").replace(/\s+/g, " ").trim();
    if (!date || amount === null || !description) {
      skipped += 1;
      continue;
    }
    out.push({ date, amount, description, raw: lines[i] });
  }
  return { rows: out, skipped, detectedColumns: cols };
}

// ---------------------------------------------------------------------------
// Importer
// ---------------------------------------------------------------------------

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildExternalId(accountId: string, row: CsvParseRow): string {
  const cents = Math.round(row.amount * 100);
  return `csv:${accountId}:${row.date}:${cents}:${normalizeDescription(row.description)}`;
}

export interface ImportOptions {
  accountId: string;
  /** Optional override — useful for the per-row "treat as income" toggle. */
  classify?: (row: CsvParseRow) => TransactionType;
}

export async function importCsv(
  rows: CsvParseRow[],
  opts: ImportOptions,
): Promise<CsvImportSummary> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase is not configured — CSV import requires NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  const summary: CsvImportSummary = { imported: 0, duplicates: 0, errors: [] };
  const classify =
    opts.classify ?? ((row: CsvParseRow): TransactionType => (row.amount < 0 ? "expense" : "income"));

  for (const row of rows) {
    const type = classify(row);
    const external = buildExternalId(opts.accountId, row);

    // Check for existing — the unique index will reject duplicates too, but
    // pre-checking lets us count duplicates accurately for the UI.
    const { data: existing } = await sb
      .from("transactions")
      .select("id")
      .eq("external_id", external)
      .maybeSingle();
    if (existing) {
      summary.duplicates += 1;
      continue;
    }

    const { error } = await sb.from("transactions").insert({
      date: row.date,
      merchant: row.description.slice(0, 200),
      amount: Math.abs(row.amount),
      type,
      category: "Misc",
      account_id: opts.accountId,
      notes: "Imported from CSV",
      external_id: external,
    });
    if (error) {
      summary.errors.push(`${row.date} ${row.description}: ${error.message}`);
      continue;
    }
    summary.imported += 1;
  }
  return summary;
}
