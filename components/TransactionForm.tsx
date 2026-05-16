"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/Button";
import { Input, Label, Select, Textarea } from "./ui/Field";
import { categoriesFor } from "@/lib/categories";
import { todayISO } from "@/lib/utils";
import type { Account, NewTransaction, TransactionType } from "@/lib/types";

interface Props {
  accounts: Account[];
  onSubmit: (t: NewTransaction) => Promise<void> | void;
}

export function TransactionForm({ accounts, onSubmit }: Props) {
  const [type, setType] = React.useState<TransactionType>("expense");
  const [date, setDate] = React.useState<string>(todayISO());
  const [merchant, setMerchant] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<string>(categoriesFor("expense")[0]);
  const [accountId, setAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Reset category when type changes so it always matches the available list.
    setCategory(categoriesFor(type)[0]);
  }, [type]);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!merchant.trim()) return setError("Add a merchant or source.");
    if (!parsedAmount || parsedAmount <= 0)
      return setError("Amount must be greater than 0.");

    try {
      setSubmitting(true);
      await onSubmit({
        date,
        merchant: merchant.trim(),
        amount: parsedAmount,
        type,
        category,
        account_id: accountId || null,
        notes: notes.trim() || null,
      });
      setMerchant("");
      setAmount("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions: { value: TransactionType; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "investment", label: "Investment" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-ink-800/60 p-1">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              type === opt.value
                ? "bg-ink-100 text-ink-950"
                : "text-ink-300 hover:text-ink-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="amount">Amount (USD)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="merchant">
          {type === "income" ? "Source" : type === "investment" ? "Vehicle" : "Merchant"}
        </Label>
        <Input
          id="merchant"
          placeholder={
            type === "income"
              ? "Acme Corp Payroll"
              : type === "investment"
                ? "Vanguard, Coinbase, ..."
                : "Whole Foods, Equinox, ..."
          }
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoriesFor(type).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="account">Account</Label>
          <Select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.length === 0 ? (
              <option value="">No accounts</option>
            ) : (
              accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering about this transaction…"
        />
      </div>

      {error && (
        <div className="rounded-md border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        <Plus size={16} />
        {submitting ? "Saving…" : "Add transaction"}
      </Button>
    </form>
  );
}
