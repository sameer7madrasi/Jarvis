import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Jarvis — Financial Storyteller",
  description:
    "Personal capital allocation, markets research, and your two AI personas — JarvisHome and JarvisFinance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
