"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useChatDrawer } from "@/components/chat/ChatDrawer";
import { cn } from "@/lib/utils";
import type { Draft, DraftStatus } from "@/lib/types-v2";

interface Props {
  draft: Draft;
}

const STATUS_OPTIONS: DraftStatus[] = ["idea", "outline", "drafting", "ready", "archived"];

export function DraftEditor({ draft: initial }: Props) {
  const [title, setTitle] = React.useState(initial.title);
  const [body, setBody] = React.useState(initial.body_md);
  const [status, setStatus] = React.useState<DraftStatus>(initial.status);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const { open } = useChatDrawer();

  React.useEffect(() => {
    setDirty(
      title !== initial.title || body !== initial.body_md || status !== initial.status,
    );
  }, [title, body, status, initial]);

  const save = React.useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${initial.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body_md: body, status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedAt(new Date());
      setDirty(false);
    } catch (err) {
      console.error("save draft failed", err);
    } finally {
      setSaving(false);
    }
  }, [dirty, body, title, status, initial.slug]);

  // Autosave debounced
  React.useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [dirty, save]);

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-ink-800 bg-ink-950/80 px-6 py-3 backdrop-blur">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xl text-base font-semibold"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DraftStatus)}
          className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-500">
            {saving
              ? "Saving…"
              : dirty
                ? "Unsaved"
                : savedAt
                  ? `Saved ${savedAt.toLocaleTimeString()}`
                  : "Saved"}
          </span>
          <Button size="sm" variant="outline" onClick={save} disabled={!dirty || saving}>
            <Save size={14} />
            Save
          </Button>
          <Button size="sm" onClick={() => open("finance")}>
            <Sparkles size={14} />
            Ask JarvisFinance
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck
          className={cn(
            "min-h-0 resize-none border-r border-ink-800 bg-ink-950 p-6 font-mono text-sm leading-relaxed text-ink-100 focus:outline-none",
          )}
          placeholder="Start writing in markdown…"
        />
        <div className="min-h-0 overflow-y-auto bg-ink-900/40 p-6">
          <article className="prose prose-sm prose-invert max-w-none [&_a]:underline [&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_pre]:rounded-lg [&_pre]:bg-black/40">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || "*(empty)*"}</ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
