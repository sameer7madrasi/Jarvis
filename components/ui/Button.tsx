import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-100 text-ink-950 hover:bg-white shadow-sm disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-200 hover:bg-ink-800/80 disabled:opacity-50",
  outline:
    "bg-transparent border border-ink-600 text-ink-100 hover:bg-ink-800/60 disabled:opacity-50",
  danger:
    "bg-danger-600/90 text-white hover:bg-danger-500 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ink-500/60 focus:ring-offset-2 focus:ring-offset-ink-950 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
