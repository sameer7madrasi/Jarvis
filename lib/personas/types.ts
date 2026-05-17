/**
 * A Persona is a configurable AI avatar — name, identity, color, system
 * prompt, default model, allowed tools, and an icon for the chrome.
 *
 * V1 personas ship hard-coded in code. Phase 3 (settings UI) will overlay
 * user-supplied overrides stored in Supabase `persona_configs`.
 */

export type PersonaId = "home" | "finance";

/** Symbolic icon name resolved client-side to a Lucide component. */
export type PersonaIconName = "home" | "trending-up";

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
  /**
   * Icon identifier (NOT the React component) — kept as a string so the
   * persona object stays JSON-serializable when passed from server components
   * to client components in Next's App Router.
   */
  iconName: PersonaIconName;
  /** Multi-line system prompt */
  systemPrompt: string;
  /** Whitelist of tool names this persona is allowed to call */
  tools: string[];
  /** Suggested opening questions surfaced in empty-state chat */
  starters: string[];
}
