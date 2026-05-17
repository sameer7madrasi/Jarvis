"use client";

import * as React from "react";
import { ChatDrawerProvider, ChatLauncher } from "./chat/ChatDrawer";
import { MobileTopBar, Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatDrawerProvider>
      <div className="flex min-h-screen bg-ink-950 text-ink-100">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <MobileTopBar />
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
      <ChatLauncher />
    </ChatDrawerProvider>
  );
}
