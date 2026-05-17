import { ChatPanel } from "@/components/chat/ChatPanel";
import { PersonaAvatar } from "@/components/chat/PersonaAvatar";
import { DraftList } from "@/components/finance/DraftList";
import { PortfolioTable } from "@/components/finance/PortfolioTable";
import { WatchlistCard } from "@/components/finance/WatchlistCard";
import { anyProviderConfigured } from "@/lib/ai";
import { fetchDrafts, fetchHoldings, fetchWatchlist } from "@/lib/data-v2";
import { financePersona } from "@/lib/personas/finance";

export const dynamic = "force-dynamic";

export default async function JarvisFinancePage() {
  const [holdings, watchlist, drafts] = await Promise.all([
    fetchHoldings().catch(() => []),
    fetchWatchlist().catch(() => []),
    fetchDrafts().catch(() => []),
  ]);
  const aiConfigured = anyProviderConfigured();

  return (
    <div className="flex h-screen min-h-0">
      <aside className="hidden w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-ink-800 bg-ink-950/60 p-4 xl:flex">
        <PortfolioTable holdings={holdings} />
        <WatchlistCard items={watchlist} />
        <DraftList drafts={drafts} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-800 px-6 py-4">
          <PersonaAvatar persona={financePersona} size="md" />
          <div className="flex-1">
            <div className="text-base font-semibold text-ink-100">{financePersona.displayName}</div>
            <div className="text-xs text-ink-400">{financePersona.tagline}</div>
          </div>
          {!aiConfigured ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
              No AI key set
            </span>
          ) : (
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
              style={{
                borderColor: `${financePersona.hex}40`,
                color: financePersona.hex,
                backgroundColor: `${financePersona.hex}14`,
              }}
            >
              {financePersona.defaultModel}
            </span>
          )}
        </header>

        <div className="min-h-0 flex-1">
          <ChatPanel persona={financePersona} variant="page" />
        </div>
      </div>
    </div>
  );
}
