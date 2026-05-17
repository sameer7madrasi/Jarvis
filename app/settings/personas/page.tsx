import { Settings } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PersonaAvatar } from "@/components/chat/PersonaAvatar";
import { anyProviderConfigured, isProviderConfigured } from "@/lib/ai";
import { PERSONA_LIST } from "@/lib/personas";

export const dynamic = "force-dynamic";

export default function PersonaSettingsPage() {
  const aiOn = anyProviderConfigured();
  const openaiOn = isProviderConfigured("openai");
  const anthropicOn = isProviderConfigured("anthropic");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-ink-800 p-2 text-ink-300 ring-1 ring-ink-700">
          <Settings size={18} />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-ink-400">
            Settings
          </div>
          <h1 className="text-2xl font-semibold text-ink-100">Personas</h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>AI providers</CardTitle>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              aiOn
                ? "border border-accent-500/40 bg-accent-500/10 text-accent-500"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
            }`}
          >
            {aiOn ? "Live" : "Offline"}
          </span>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink-300">
          <ProviderRow name="OpenAI" envKey="OPENAI_API_KEY" on={openaiOn} />
          <ProviderRow name="Anthropic" envKey="ANTHROPIC_API_KEY" on={anthropicOn} />
          <p className="pt-2 text-xs text-ink-500">
            Add keys to <code className="rounded bg-black/40 px-1">.env.local</code> and restart the
            dev server. Each persona below uses its own default model — set{" "}
            <code className="rounded bg-black/40 px-1">JARVIS_AI_PROVIDER</code> to force one
            provider for all personas (useful while you only have one key).
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PERSONA_LIST.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <PersonaAvatar persona={p} />
                <div>
                  <div className="text-sm font-semibold text-ink-100">{p.displayName}</div>
                  <div className="text-[11px] text-ink-400">{p.tagline}</div>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 text-xs text-ink-300">
              <Row label="Persona id" value={p.id} mono />
              <Row label="Default model" value={p.defaultModel} mono />
              <Row label="Color" value={p.hex} mono />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">
                  Allowed tools ({p.tools.length})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">
                  System prompt
                </div>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-2 text-[11px] leading-relaxed text-ink-300">
                  {p.systemPrompt}
                </pre>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-ink-500">
        Configurable overrides (display name, model, custom prompt) land in a later phase.
        The schema is already in place — see <code>persona_configs</code> in{" "}
        <code>supabase/schema_v2.sql</code>.
      </p>
    </div>
  );
}

function ProviderRow({ name, envKey, on }: { name: string; envKey: string; on: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2">
      <div className="text-sm font-medium text-ink-100">{name}</div>
      <code className="text-[11px] text-ink-400">{envKey}</code>
      <span
        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
          on
            ? "border border-accent-500/40 bg-accent-500/10 text-accent-500"
            : "border border-ink-700 bg-ink-800 text-ink-400"
        }`}
      >
        {on ? "configured" : "not set"}
      </span>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
      <span
        className={`truncate text-ink-200 ${mono ? "font-mono text-[11px]" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
