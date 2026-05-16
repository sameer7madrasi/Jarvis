import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capital OS — Personal Wealth Command Center",
  description:
    "A clean personal finance dashboard built around the Million by 30 goal.",
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
