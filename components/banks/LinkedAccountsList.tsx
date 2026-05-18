"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, formatDateTime } from "@/lib/utils";
import type { LinkedItem } from "@/lib/banks/items";
import { LinkBankButton } from "./LinkBankButton";

interface Props {
  className?: string;
}

export function LinkedAccountsList({ className }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<LinkedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/banks/items", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load linked accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // When OAuth completes, /banks/return redirects to /?bankLinked=1. Refetch
  // the list (with a short retry window to ride out any Supabase replication
  // lag), then strip the query param so a manual refresh doesn't loop. Read
  // window.location.search directly so we don't need useSearchParams (which
  // would require a Suspense boundary on the surrounding page).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("bankLinked") !== "1") return;
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 4 && !cancelled; i++) {
        const res = await fetch("/api/banks/items", { cache: "no-store" }).catch(
          () => null,
        );
        if (cancelled) return;
        if (res && res.ok) {
          const data: { items?: LinkedItem[] } = await res.json().catch(() => ({}));
          if ((data.items?.length ?? 0) > 0) {
            if (!cancelled) {
              setItems(data.items ?? []);
              setLoading(false);
              setError(null);
            }
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 750));
      }
      if (!cancelled) router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function syncOne(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/banks/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `sync HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "sync failed");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Disconnect this institution? Existing transactions stay, but new ones won't sync.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/banks/items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `disconnect HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "disconnect failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-ink-300">
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {error ? (
          <div className="rounded-md border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-500">
            {error}
          </div>
        ) : null}

        {items.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-ink-700/60 bg-ink-900/40 px-4 py-6 text-center text-xs text-ink-400">
            No banks linked yet. Connect Bank of America (or any US institution Plaid supports) to start syncing transactions automatically.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2 text-sm"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500"
                  aria-hidden
                >
                  <Building2 size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink-100">
                    {it.institution_name ??
                      (it.provider === "csv" ? "CSV import" : "Untitled institution")}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5",
                        it.status === "active"
                          ? "bg-accent-500/10 text-accent-500"
                          : it.status === "login_required"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-danger-500/10 text-danger-500",
                      )}
                    >
                      {it.status}
                    </span>
                    <span className="font-mono uppercase tracking-wider">{it.provider}</span>
                    <span>
                      {it.last_synced_at
                        ? `synced ${formatDateTime(it.last_synced_at)}`
                        : "never synced"}
                    </span>
                  </div>
                  {it.last_error ? (
                    <div className="mt-1 truncate text-[10px] text-danger-500" title={it.last_error}>
                      {it.last_error}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => syncOne(it.id)}
                    disabled={busyId === it.id || it.provider !== "plaid"}
                    className="text-ink-300"
                    title={it.provider === "plaid" ? "Sync now" : "CSV imports re-sync on upload"}
                  >
                    <RefreshCw size={12} className={cn(busyId === it.id && "animate-spin")} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect(it.id)}
                    disabled={busyId === it.id}
                    className="text-ink-300 hover:text-danger-500"
                    title="Disconnect"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <LinkBankButton variant={items.length === 0 ? "primary" : "outline"} onLinked={load} />
      </CardBody>
    </Card>
  );
}
