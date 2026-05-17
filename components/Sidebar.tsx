"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Home as HomeIcon,
  LineChart,
  MessageCircle,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useChatDrawer } from "./chat/ChatDrawer";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Money", icon: Wallet, match: (p) => p === "/" },
  { href: "/home", label: "JarvisHome", icon: HomeIcon },
  { href: "/finance", label: "JarvisFinance", icon: TrendingUp },
];

const SECONDARY: NavItem[] = [
  { href: "/finance/drafts", label: "Drafts", icon: FileText, match: (p) => p.startsWith("/finance/drafts") },
  { href: "/settings/personas", label: "Personas", icon: Settings, match: (p) => p.startsWith("/settings") },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  const { open } = useChatDrawer();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950/80 backdrop-blur lg:flex">
      <Link
        href="/"
        className="flex items-center gap-2 border-b border-ink-800 px-4 py-4"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-invest-500 text-sm font-bold text-ink-950">
          J
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-ink-100">Jarvis</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Financial Storyteller
          </span>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
        <NavGroup items={PRIMARY} pathname={pathname} />
        <NavGroup title="Workspace" items={SECONDARY} pathname={pathname} />
      </nav>

      <div className="border-t border-ink-800 p-3">
        <button
          onClick={() => open()}
          className="flex w-full items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-900/80 px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800"
        >
          <MessageCircle size={16} className="text-ink-400" />
          <span className="flex-1 text-left">Ask Jarvis</span>
          <kbd className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  );
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      {title ? (
        <div className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-ink-500">
          {title}
        </div>
      ) : null}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.match ? item.match(pathname) : pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-ink-800/80 text-ink-100"
                    : "text-ink-400 hover:bg-ink-800/40 hover:text-ink-100",
                )}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tiny logo+hamburger header for mobile (lg:hidden). */
export function MobileTopBar() {
  const { open } = useChatDrawer();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-invest-500 text-xs font-bold text-ink-950">
          J
        </div>
        <span className="text-sm font-semibold text-ink-100">Jarvis</span>
      </Link>
      <nav className="flex items-center gap-1 text-xs text-ink-400">
        <Link href="/" className="rounded-md px-2 py-1 hover:text-ink-100">
          Money
        </Link>
        <Link href="/home" className="rounded-md px-2 py-1 hover:text-ink-100">
          Home
        </Link>
        <Link href="/finance" className="rounded-md px-2 py-1 hover:text-ink-100">
          Finance
        </Link>
        <button
          onClick={() => open()}
          className="ml-1 rounded-md bg-ink-800 px-2 py-1 text-ink-100"
          aria-label="Ask Jarvis"
        >
          <LineChart size={14} />
        </button>
      </nav>
    </header>
  );
}
