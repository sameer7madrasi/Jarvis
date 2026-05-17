"use client";

import * as React from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Account } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Props {
  accounts: Account[];
  onImported?: () => void;
  className?: string;
}

interface ParsePreviewRow {
  date: string;
  description: string;
  amount: number;
}

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "preview"; file: File; rows: ParsePreviewRow[]; skipped: number }
  | { kind: "importing" }
  | { kind: "done"; imported: number; duplicates: number; errors: string[] }
  | { kind: "error"; message: string };

export function CsvImporter({ accounts, onImported, className }: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [accountId, setAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [dragOver, setDragOver] = React.useState(false);

  React.useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  async function handleFile(file: File) {
    if (!accountId) {
      setPhase({ kind: "error", message: "Pick an account to attribute these rows to first." });
      return;
    }
    setPhase({ kind: "uploading" });
    try {
      // Parse client-side via the API for a preview-only round-trip would
      // mean reading the file twice — easier to ship the full parsed list
      // back from one request. So we just go straight to import after a
      // local quick parse for the preview UI.
      const text = await file.text();
      const preview = quickPreview(text);
      setPhase({ kind: "preview", file, rows: preview.rows, skipped: preview.skipped });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "could not read CSV",
      });
    }
  }

  async function commitImport() {
    if (phase.kind !== "preview") return;
    const { file } = phase;
    setPhase({ kind: "importing" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("accountId", accountId);
      const res = await fetch("/api/banks/csv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPhase({
        kind: "done",
        imported: data.summary.imported,
        duplicates: data.summary.duplicates,
        errors: data.summary.errors,
      });
      onImported?.();
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "import failed",
      });
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>CSV import</CardTitle>
        <span className="text-xs text-ink-400">BoA + most US bank exports</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <label className="block text-xs text-ink-400">
          Attribute to
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:outline-none focus:ring-2 focus:ring-ink-500/50"
          >
            {accounts.length === 0 ? <option value="">No accounts yet</option> : null}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type})
              </option>
            ))}
          </select>
        </label>

        {phase.kind === "idle" || phase.kind === "uploading" || phase.kind === "error" ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-xs text-ink-400 transition-colors",
              dragOver ? "border-ink-300 bg-ink-800/60" : "border-ink-700/80 bg-ink-900/40 hover:border-ink-500",
            )}
          >
            {phase.kind === "uploading" ? (
              <Loader2 size={16} className="animate-spin text-ink-300" />
            ) : (
              <UploadCloud size={16} className="text-ink-300" />
            )}
            <div className="font-medium text-ink-200">Drop a CSV or click to choose</div>
            <div>BoA, Chase, Schwab, plain Date / Description / Amount all supported.</div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        ) : null}

        {phase.kind === "preview" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>
                <FileSpreadsheet size={12} className="mr-1 inline" />
                {phase.file.name}
              </span>
              <span>
                {phase.rows.length} valid rows · {phase.skipped} skipped
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-700/60 bg-ink-900/50">
              <table className="w-full text-xs">
                <thead className="bg-ink-800/50 text-[10px] uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Description</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-ink-200">
                  {phase.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-ink-800/60">
                      <td className="px-2 py-1 font-mono">{formatDate(r.date)}</td>
                      <td className="px-2 py-1 truncate">{r.description}</td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right tabular-nums",
                          r.amount < 0 ? "text-danger-400" : "text-accent-400",
                        )}
                      >
                        {formatCurrency(r.amount, true)}
                      </td>
                    </tr>
                  ))}
                  {phase.rows.length > 8 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-1 text-center text-[10px] text-ink-500">
                        … and {phase.rows.length - 8} more
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={commitImport} className="flex-1" size="sm">
                Import {phase.rows.length} rows
              </Button>
              <Button onClick={() => setPhase({ kind: "idle" })} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {phase.kind === "importing" ? (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Loader2 size={14} className="animate-spin" /> Importing…
          </div>
        ) : null}

        {phase.kind === "done" ? (
          <div className="space-y-1 rounded-lg border border-accent-500/40 bg-accent-500/5 px-3 py-2 text-xs text-accent-400">
            Imported {phase.imported} new · {phase.duplicates} duplicates skipped.
            {phase.errors.length > 0 ? (
              <ul className="ml-4 mt-1 list-disc text-danger-400">
                {phase.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setPhase({ kind: "idle" })}>
              Import another file
            </Button>
          </div>
        ) : null}

        {phase.kind === "error" ? (
          <div className="rounded-md border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
            {phase.message}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Client-side quick preview (mirrors lib/banks/csv.ts loosely; intentionally
// simpler — server still does authoritative parse on commit).
// ---------------------------------------------------------------------------

function quickPreview(text: string): { rows: ParsePreviewRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsePreviewRow[] = [];
  let skipped = 0;

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') inQ = true;
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const all = lines.map(splitLine);
  // Find header
  let headerIdx = -1;
  let cols = { date: 0, description: 1, amount: 2 };
  for (let i = 0; i < all.length; i += 1) {
    const cells = all[i].map((c) => c.toLowerCase());
    const d = cells.findIndex((c) => c === "date" || c === "posted date" || c === "transaction date");
    const desc = cells.findIndex((c) => c === "description" || c === "memo" || c === "name");
    const amt = cells.findIndex((c) => c === "amount" || c === "transaction amount");
    if (d >= 0 && desc >= 0 && amt >= 0) {
      headerIdx = i;
      cols = { date: d, description: desc, amount: amt };
      break;
    }
  }
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  for (let i = start; i < all.length; i += 1) {
    const r = all[i];
    if (r.length <= Math.max(cols.date, cols.description, cols.amount)) {
      skipped += 1;
      continue;
    }
    const rawDate = r[cols.date];
    const rawDesc = (r[cols.description] ?? "").replace(/\s+/g, " ");
    const amount = Number((r[cols.amount] ?? "").replace(/[$,\s]/g, ""));
    let iso: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) iso = rawDate;
    else {
      const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
        iso = `${yy}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      }
    }
    if (!iso || !Number.isFinite(amount) || !rawDesc) {
      skipped += 1;
      continue;
    }
    rows.push({ date: iso, description: rawDesc, amount });
  }
  return { rows, skipped };
}
