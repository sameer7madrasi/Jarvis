"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";

import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/personas";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { PersonaAvatar } from "./PersonaAvatar";

interface Props {
  persona: Persona;
  conversationId?: string;
  initialMessages?: Message[];
  /** Render dense (drawer) vs spacious (full page). */
  variant?: "drawer" | "page";
  onNewConversation?: (id: string) => void;
}

export function ChatPanel({
  persona,
  conversationId,
  initialMessages,
  variant = "page",
  onNewConversation,
}: Props) {
  // activeId can mutate mid-stream (the server assigns one on the first
  // response). sessionKey only bumps on *explicit* thread switches so we
  // don't blow away in-flight messages when the id propagates.
  const [activeId, setActiveId] = React.useState<string | undefined>(conversationId);
  const [sessionKey, setSessionKey] = React.useState(0);
  const activeIdRef = React.useRef(activeId);
  React.useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Bump only when the caller explicitly switches threads (different
  // conversationId). Don't bump on initialMessages identity changes —
  // that'd thrash on every parent re-render.
  React.useEffect(() => {
    setActiveId(conversationId);
    setSessionKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    stop,
  } = useChat({
    api: "/api/chat",
    id: `${persona.id}:${sessionKey}`,
    initialMessages: initialMessages ?? [],
    body: { personaId: persona.id },
    onResponse(res) {
      const newId = res.headers.get("x-jarvis-conversation-id");
      if (newId && newId !== activeIdRef.current) {
        setActiveId(newId);
        onNewConversation?.(newId);
      }
    },
  });

  function submitNow(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isLoading || !input.trim()) return;
    handleSubmit(undefined, {
      body: { personaId: persona.id, conversationId: activeIdRef.current },
    });
  }

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  const empty = messages.length === 0;

  function sendStarter(text: string) {
    setInput(text);
    // submit on next tick so the input controlled value flushes first
    setTimeout(() => submitNow(), 0);
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        variant === "drawer" ? "bg-ink-900" : "bg-transparent",
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto",
          variant === "drawer" ? "px-4 py-4" : "px-4 py-6 sm:px-6",
        )}
      >
        {empty ? (
          <EmptyState persona={persona} onStarter={sendStarter} variant={variant} />
        ) : (
          <div className={cn("mx-auto flex max-w-3xl flex-col gap-4")}>
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} persona={persona} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" ? (
              <div className="flex gap-3">
                <PersonaAvatar persona={persona} size="md" />
                <div className="rounded-2xl bg-ink-800/70 px-4 py-3 text-sm text-ink-300 ring-1 ring-ink-700/60">
                  <span className="inline-flex items-center gap-1.5">
                    <Dot /> <Dot delay={150} /> <Dot delay={300} />
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div
        className={cn(
          "border-t border-ink-800 bg-ink-950/90 backdrop-blur",
          variant === "drawer" ? "px-3 py-3" : "px-4 py-4 sm:px-6",
        )}
      >
        <div className="mx-auto max-w-3xl">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={() => submitNow()}
            onStop={stop}
            isStreaming={isLoading}
            placeholder={`Ask ${persona.displayName}…`}
            accentHex={persona.hex}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  persona,
  onStarter,
  variant,
}: {
  persona: Persona;
  onStarter: (s: string) => void;
  variant: "drawer" | "page";
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-2xl flex-col items-center text-center",
        variant === "drawer" ? "pt-6" : "pt-12",
      )}
    >
      <PersonaAvatar persona={persona} size="lg" />
      <div className="mt-3 text-lg font-semibold text-ink-100">{persona.displayName}</div>
      <div className="mt-1 max-w-md text-sm text-ink-400">{persona.tagline}</div>
      <div className="mt-6 flex w-full flex-col gap-2">
        {persona.starters.map((s) => (
          <button
            key={s}
            onClick={() => onStarter(s)}
            className="flex items-start gap-2 rounded-xl border border-ink-700/70 bg-ink-900/70 px-3 py-2 text-left text-sm text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-800/80"
          >
            <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: persona.hex }} />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
