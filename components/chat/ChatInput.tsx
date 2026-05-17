"use client";

import * as React from "react";
import { Send, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  accentHex?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  placeholder,
  accentHex,
}: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isStreaming && value.trim()) onSubmit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-ink-700/80 bg-ink-900/80 p-2 shadow-card focus-within:border-ink-500"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isStreaming && value.trim()) onSubmit();
          }
        }}
        placeholder={placeholder ?? "Ask Jarvis…"}
        rows={1}
        className={cn(
          "min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink-100 placeholder:text-ink-400 focus:outline-none",
        )}
      />
      {isStreaming && onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-700/80 text-ink-100 hover:bg-ink-600"
          aria-label="Stop"
        >
          <StopCircle size={16} />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-ink-950 transition-colors disabled:opacity-40",
          )}
          style={{ backgroundColor: accentHex ?? "#e5e7eb" }}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      )}
    </form>
  );
}
