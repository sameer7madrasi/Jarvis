"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "ai";

import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/personas";
import { PersonaAvatar } from "./PersonaAvatar";
import { ToolCallChip } from "./ToolCallChip";

interface Props {
  message: Message;
  persona: Persona;
}

export function ChatMessage({ message, persona }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-700/70 text-xs font-semibold text-ink-200">
          You
        </div>
      ) : (
        <PersonaAvatar persona={persona} size="md" />
      )}
      <div
        className={cn(
          "max-w-[78%] space-y-2 rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-ink-100 text-ink-950"
            : "bg-ink-800/70 text-ink-100 ring-1 ring-ink-700/60",
        )}
      >
        <MessageBody message={message} isUser={isUser} />
      </div>
    </div>
  );
}

function MessageBody({ message, isUser }: { message: Message; isUser: boolean }) {
  // AI SDK v4 puts content into `parts` for tool-calling responses while
  // keeping `content` as the concatenated text. We render both: parts in
  // order so tool calls appear inline, falling back to plain content.
  const parts = (message as unknown as { parts?: AnyPart[] }).parts;
  if (parts && parts.length > 0) {
    return (
      <div className="space-y-2">
        {parts.map((p, i) => {
          if (p.type === "text" && typeof p.text === "string") {
            return <Markdown key={i} text={p.text} isUser={isUser} />;
          }
          if (p.type === "tool-invocation" && p.toolInvocation) {
            const inv = p.toolInvocation;
            return (
              <ToolCallChip
                key={inv.toolCallId ?? `${i}`}
                name={inv.toolName}
                args={inv.args}
                result={"result" in inv ? (inv as { result: unknown }).result : undefined}
                state={inv.state}
              />
            );
          }
          return null;
        })}
      </div>
    );
  }
  const text = typeof message.content === "string" ? message.content : "";
  return <Markdown text={text} isUser={isUser} />;
}

function Markdown({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        isUser ? "prose-invert-light" : "prose-invert",
        // shared overrides
        "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1",
        "[&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5",
        "[&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3",
        "[&_a]:underline",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

interface AnyPart {
  type: string;
  text?: string;
  toolInvocation?: {
    toolCallId?: string;
    toolName: string;
    args?: unknown;
    state?: "call" | "result" | "partial-call";
    result?: unknown;
  };
}
