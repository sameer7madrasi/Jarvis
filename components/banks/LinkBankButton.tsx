"use client";

import * as React from "react";
import { Building2, Loader2 } from "lucide-react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  exchangePublicTokenAndInitialSync,
  fetchPlaidLinkToken,
  getPlaidOAuthReceivedRedirectUri,
} from "./plaidExchangeFlow";

interface Props {
  /** Called after the new linked_items row is created AND initial sync completes. */
  onLinked?: (itemId: string) => void;
  className?: string;
  variant?: "primary" | "outline";
}

type Phase =
  | { kind: "idle" }
  | { kind: "fetching-token" }
  | { kind: "ready"; linkToken: string }
  | { kind: "exchanging" }
  | { kind: "syncing"; itemId: string }
  | { kind: "error"; message: string };

export function LinkBankButton({ onLinked, className, variant = "primary" }: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });

  const requestLinkToken = React.useCallback(async () => {
    setPhase({ kind: "fetching-token" });
    try {
      const linkToken = await fetchPlaidLinkToken();
      setPhase({ kind: "ready", linkToken });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to create Plaid link token",
      });
    }
  }, []);

  const onSuccess = React.useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setPhase({ kind: "exchanging" });
      try {
        const { itemId } = await exchangePublicTokenAndInitialSync(publicToken, metadata);
        setPhase({ kind: "syncing", itemId });
        onLinked?.(itemId);
        setPhase({ kind: "idle" });
      } catch (err) {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to finish linking",
        });
      }
    },
    [onLinked],
  );

  const linkToken = phase.kind === "ready" ? phase.linkToken : null;
  const receivedRedirectUri = getPlaidOAuthReceivedRedirectUri();
  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess,
    onExit: (err) => {
      if (err) {
        setPhase({ kind: "error", message: err.error_message ?? err.error_code ?? "Link cancelled" });
      } else {
        setPhase({ kind: "idle" });
      }
    },
  });

  // Auto-open Plaid Link once the token is fetched.
  React.useEffect(() => {
    if (phase.kind === "ready" && ready) {
      open();
    }
  }, [phase, ready, open]);

  const isBusy =
    phase.kind === "fetching-token" ||
    phase.kind === "exchanging" ||
    phase.kind === "syncing" ||
    (phase.kind === "ready" && !ready);

  const label = (() => {
    switch (phase.kind) {
      case "fetching-token":
        return "Loading Plaid…";
      case "ready":
        return ready ? "Opening Plaid…" : "Preparing…";
      case "exchanging":
        return "Exchanging token…";
      case "syncing":
        return "Syncing transactions…";
      case "error":
        return "Try again";
      case "idle":
      default:
        return "Connect bank";
    }
  })();

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        onClick={requestLinkToken}
        disabled={isBusy}
        variant={variant === "outline" ? "outline" : "primary"}
        className="w-full"
      >
        {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
        {label}
      </Button>
      {phase.kind === "error" ? (
        <p className="text-xs text-danger-500">{phase.message}</p>
      ) : null}
    </div>
  );
}
