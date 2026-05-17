"use client";

import * as React from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  args?: unknown;
  result?: unknown;
  state?: "call" | "result" | "partial-call";
}

export function ToolCallChip({ name, args, result, state }: Props) {
  const [open, setOpen] = React.useState(false);
  const hasDetails = args !== undefined || result !== undefined;
  return (
    <div
      className={cn(
        "my-1 rounded-lg border border-ink-700/70 bg-ink-800/60 text-xs",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left",
          hasDetails ? "cursor-pointer" : "cursor-default",
        )}
        aria-expanded={open}
      >
        <Wrench size={12} className="text-ink-300" />
        <span className="font-mono text-ink-200">{name}</span>
        <span className="text-ink-400">
          {state === "result"
            ? "completed"
            : state === "partial-call"
              ? "calling…"
              : "called"}
        </span>
        {hasDetails ? (
          <ChevronDown
            size={12}
            className={cn(
              "ml-auto text-ink-400 transition-transform",
              open && "rotate-180",
            )}
          />
        ) : null}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-ink-700/60 px-3 py-2 font-mono text-[11px] text-ink-300">
          {args !== undefined ? (
            <div>
              <div className="mb-0.5 uppercase tracking-wider text-ink-400">args</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                {safeJson(args)}
              </pre>
            </div>
          ) : null}
          {result !== undefined ? (
            <div>
              <div className="mb-0.5 uppercase tracking-wider text-ink-400">result</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">
                {safeJson(result)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
