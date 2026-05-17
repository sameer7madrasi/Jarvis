/**
 * A Persona is a configurable AI avatar — name, identity, color, system
 * prompt, default model, allowed tools, and an icon for the chrome.
 *
 * V1 personas ship hard-coded in code. Phase 3 (settings UI) will overlay
 * user-supplied overrides stored in Supabase `persona_configs`.
 */

import type { LucideIcon } from "lucide-react";

export type PersonaId = "home" | "finance";

export interface Persona {
  id: PersonaId;
  displayName: string;
  /** One-line role description shown in chrome */
  tagline: string;
  /** Tailwind color token (matches values in tailwind.config.ts → accent/invest/etc) */
  color: "accent" | "invest" | "ink";
  /** Hex used for tinted UI accents (avatars, chips) */
  hex: string;
  /** Model spec like "openai:gpt-4o-mini" — resolved via lib/ai/provider.ts */
  defaultModel: string;
  /** Lucide icon used as the persona avatar in V1 (before user uploads PFP) */
  Icon: LucideIcon;
  /** Multi-line system prompt */
  systemPrompt: string;
  /** Whitelist of tool names this persona is allowed to call */
  tools: string[];
  /** Suggested opening questions surfaced in empty-state chat */
  starters: string[];
}
