"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import type { Message } from "ai";

import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/personas";
import type { ChatConversation, ChatMessageRow } from "@/lib/types-v2";
import { ChatPanel } from "./ChatPanel";
import { PersonaAvatar } from "./PersonaAvatar";

interface Props {
  persona: Persona;
  /** Render-time flag (server-evaluated) — true if at least one AI key is set. */
  aiConfigured: boolean;
}

/**
 * Full-page chat experience: left rail of past conversations + main thread.
 * Shared by /home and /finance via persona prop.
 */
export function ChatPage({ persona, aiConfigured }: Props) {
  const [conversations, setConversations] = React.useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = React.useState<Message[] | undefined>(undefined);
  const [loadingThread, setLoadingThread] = React.useState(false);

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations?personaId=${persona.id}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      setConversations([]);
    }
  }, [persona.id]);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/conversations?conversationId=${id}`);
      const data = await res.json();
      setInitialMessages(rowsToMessages(data.messages ?? []));
    } catch {
      setInitialMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  function newConversation() {
    setActiveId(undefined);
    setInitialMessages([]);
  }

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0 lg:h-screen">
      <ConversationRail
        persona={persona}
        conversations={conversations}
        activeId={activeId}
        onPick={openConversation}
        onNew={newConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-800 px-6 py-4">
          <PersonaAvatar persona={persona} size="md" />
          <div className="flex-1">
            <div className="text-base font-semibold text-ink-100">{persona.displayName}</div>
            <div className="text-xs text-ink-400">{persona.tagline}</div>
          </div>
          {!aiConfigured ? (
            <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 sm:inline">
              No AI key set — replies are stubbed
            </span>
          ) : (
            <span
              className="hidden rounded-full border px-2 py-0.5 font-mono text-[10px] sm:inline"
              style={{
                borderColor: `${persona.hex}40`,
                color: persona.hex,
                backgroundColor: `${persona.hex}14`,
              }}
            >
              {persona.defaultModel}
            </span>
          )}
        </header>
        <div className="min-h-0 flex-1">
          {loadingThread ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              Loading thread…
            </div>
          ) : (
            <ChatPanel
              key={activeId ?? "new"}
              persona={persona}
              conversationId={activeId}
              initialMessages={initialMessages}
              variant="page"
              onNewConversation={() => loadConversations()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationRail({
  persona,
  conversations,
  activeId,
  onPick,
  onNew,
}: {
  persona: Persona;
  conversations: ChatConversation[];
  activeId: string | undefined;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-950/60 md:flex">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
          Conversations
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-md border border-ink-700/60 bg-ink-900 px-2 py-1 text-xs text-ink-200 hover:bg-ink-800"
        >
          <MessageSquarePlus size={12} />
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-ink-500">
            No threads yet — ask {persona.displayName} something.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onPick(c.id)}
                  className={cn(
                    "block w-full truncate rounded-lg px-3 py-2 text-left text-xs transition-colors",
                    c.id === activeId
                      ? "bg-ink-800/80 text-ink-100"
                      : "text-ink-400 hover:bg-ink-800/40 hover:text-ink-200",
                  )}
                >
                  {c.title || "Untitled thread"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function rowsToMessages(rows: ChatMessageRow[]): Message[] {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r, i) => ({
      id: r.id ?? `${i}`,
      role: r.role as "user" | "assistant",
      content: r.content,
    }));
}
