"use client";

/**
 * OAuth redirect landing page for Plaid Link (required for institutions like
 * Bank of America). `PLAID_REDIRECT_URI` must point here exactly.
 *
 * Flow: user leaves Jarvis → bank OAuth → Plaid redirects to this URL with
 * `oauth_state_id` in the query string → we fetch a fresh link_token and pass
 * `receivedRedirectUri` into `usePlaidLink` so Link can complete → onSuccess
 * runs exchange + initial sync → send user back to Money.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Loader2 } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  exchangePublicTokenAndInitialSync,
  fetchPlaidLinkToken,
  getPlaidOAuthReceivedRedirectUri,
} from "@/components/banks/plaidExchangeFlow";

export default function PlaidOAuthReturnPage() {
  const router = useRouter();
  const [receivedRedirectUri, setReceivedRedirectUri] = React.useState<string | undefined>();
  const [phase, setPhase] = React.useState<
    "init" | "fetching" | "ready" | "error" | "done"
  >("init");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [linkToken, setLinkToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const uri = getPlaidOAuthReceivedRedirectUri();
    if (!uri) {
      setPhase("error");
      setErrorMessage(
        "This page completes Plaid bank linking after you sign in at your bank. " +
          "Go to Money and tap Connect bank to start.",
      );
      return;
    }
    setReceivedRedirectUri(uri);

    let cancelled = false;
    (async () => {
      setPhase("fetching");
      try {
        const token = await fetchPlaidLinkToken();
        if (cancelled) return;
        setLinkToken(token);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : "Could not load Plaid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = React.useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        await exchangePublicTokenAndInitialSync(publicToken, metadata);
        setPhase("done");
        router.replace("/?bankLinked=1");
      } catch (err) {
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : "Link failed");
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess,
    onExit: (err) => {
      if (err) {
        setPhase("error");
        setErrorMessage(err.error_message ?? err.error_code ?? "Link cancelled");
      }
    },
  });

  React.useEffect(() => {
    if (phase === "ready" && ready && linkToken) {
      open();
    }
  }, [phase, ready, open, linkToken]);

  if (phase === "init" || phase === "fetching") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Finishing bank link</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center gap-2 text-sm text-ink-300">
            <Loader2 className="size-4 animate-spin" />
            Loading Plaid…
          </CardBody>
        </Card>
      </div>
    );
  }

  if (phase === "error" && errorMessage) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Bank link</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-danger-500">{errorMessage}</p>
            <Button type="button" onClick={() => router.push("/")}>
              Back to Money
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-md">
          <CardBody className="flex items-center gap-2 text-sm text-accent-500">
            <Loader2 className="size-4 animate-spin" />
            Redirecting…
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Finishing bank link</CardTitle>
        </CardHeader>
        <CardBody className="flex items-center gap-2 text-sm text-ink-300">
          <Loader2 className="size-4 animate-spin" />
          Opening Plaid…
        </CardBody>
      </Card>
    </div>
  );
}
