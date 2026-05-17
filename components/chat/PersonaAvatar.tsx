import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/personas";

interface Props {
  persona: Persona;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { box: "h-7 w-7", icon: 14 },
  md: { box: "h-9 w-9", icon: 18 },
  lg: { box: "h-12 w-12", icon: 22 },
} as const;

export function PersonaAvatar({ persona, size = "md", className }: Props) {
  const { box, icon } = sizeMap[size];
  const Icon = persona.Icon;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl ring-1",
        box,
        className,
      )}
      style={{
        backgroundColor: hexToBg(persona.hex),
        color: persona.hex,
        boxShadow: `inset 0 0 0 1px ${hexToBg(persona.hex, 0.35)}`,
      }}
      aria-hidden
    >
      <Icon size={icon} />
    </div>
  );
}

function hexToBg(hex: string, alpha = 0.12): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
