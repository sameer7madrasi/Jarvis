import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08090c",
          900: "#0c0e13",
          800: "#13161d",
          700: "#1b1f28",
          600: "#262b36",
          500: "#3a4150",
          400: "#6b7280",
          300: "#9ca3af",
          200: "#d1d5db",
          100: "#e5e7eb",
          50: "#f3f4f6",
        },
        accent: {
          500: "#22c55e",
          600: "#16a34a",
        },
        danger: {
          500: "#ef4444",
          600: "#dc2626",
        },
        invest: {
          500: "#8b5cf6",
          600: "#7c3aed",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 3px 0 rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
