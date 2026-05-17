/**
 * Friendly fallback when no AI provider key is configured. Mirrors the
 * Supabase mock-data fallback pattern so the UI never crashes.
 */

export const OFFLINE_REPLY = [
  "I'm offline right now, sir. To wake me up, drop an API key into `.env.local`:",
  "",
  "```",
  "# pick one (or both)",
  "OPENAI_API_KEY=sk-...",
  "ANTHROPIC_API_KEY=sk-ant-...",
  "```",
  "",
  "Then restart the dev server. Once a key is set you can change models per persona in Settings → Personas.",
].join("\n");
