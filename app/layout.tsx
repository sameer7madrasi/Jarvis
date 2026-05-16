import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jarvis — Money Command Center",
  description:
    "Personal capital allocation dashboard for the Million by 30 plan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}
