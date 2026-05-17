"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERSONA_LIST, type Persona, type PersonaId } from "@/lib/personas";
import { ChatPanel } from "./ChatPanel";
import { PersonaAvatar } from "./PersonaAvatar";

interface ContextValue {
  isOpen: boolean;
  open: (persona?: PersonaId) => void;
  close: () => void;
  toggle: () => void;
  activePersona: Persona;
  setActivePersona: (id: PersonaId) => void;
}

const ChatDrawerContext = React.createContext<ContextValue | null>(null);

export function useChatDrawer() {
  const ctx = React.useContext(ChatDrawerContext);
  if (!ctx) throw new Error("useChatDrawer must be used inside ChatDrawerProvider");
  return ctx;
}

export function ChatDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<PersonaId>("home");

  // Restore from localStorage
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("jarvis:drawer:persona") : null;
    if (stored === "home" || stored === "finance") setActiveId(stored);
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jarvis:drawer:persona", activeId);
    }
  }, [activeId]);

  // Cmd/Ctrl+K to toggle
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value: ContextValue = React.useMemo(
    () => ({
      isOpen,
      open: (persona) => {
        if (persona) setActiveId(persona);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      activePersona: PERSONA_LIST.find((p) => p.id === activeId) ?? PERSONA_LIST[0],
      setActivePersona: setActiveId,
    }),
    [isOpen, activeId],
  );

  return (
    <ChatDrawerContext.Provider value={value}>
      {children}
      <Drawer />
    </ChatDrawerContext.Provider>
  );
}

function Drawer() {
  const { isOpen, close, activePersona, setActivePersona } = useChatDrawer();
  return (
    <>
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Jarvis chat"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-ink-800 bg-ink-950 shadow-2xl transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center gap-2 border-b border-ink-800 px-3 py-2">
          <div className="flex items-center gap-1 rounded-lg bg-ink-900 p-1">
            {PERSONA_LIST.map((p) => {
              const active = p.id === activePersona.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePersona(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-ink-700 text-ink-100"
                      : "text-ink-400 hover:text-ink-200",
                  )}
                >
                  <PersonaAvatar persona={p} size="sm" />
                  {p.displayName}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-ink-500">
            <kbd className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5">⌘K</kbd>
            <button
              onClick={close}
              className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          {/* Key by persona so useChat resets between switches */}
          <ChatPanel key={activePersona.id} persona={activePersona} variant="drawer" />
        </div>
      </aside>
    </>
  );
}

/**
 * Floating launcher button — shown bottom-right of every page. Cmd+K also opens.
 */
export function ChatLauncher() {
  const { open, isOpen } = useChatDrawer();
  if (isOpen) return null;
  return (
    <button
      onClick={() => open()}
      className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-900 text-ink-100 shadow-2xl ring-1 ring-white/5 transition-all hover:scale-105 hover:bg-ink-800"
      aria-label="Open Jarvis"
    >
      <span className="text-base font-semibold">J</span>
    </button>
  );
}
