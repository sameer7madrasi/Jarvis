import Link from "next/link";
import { fetchDrafts } from "@/lib/data-v2";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function DraftsIndexPage() {
  const drafts = await fetchDrafts().catch(() => []);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-ink-400">
          Workspace
        </div>
        <h1 className="mt-1 text-3xl font-semibold text-ink-100">Drafts</h1>
        <p className="mt-1 text-sm text-ink-400">
          Article research surface. JarvisFinance can outline, append, and refine these.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{drafts.length} drafts</CardTitle>
        </CardHeader>
        <CardBody>
          {drafts.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-400">
              No drafts yet. Open JarvisFinance and ask for an outline.
            </div>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/finance/drafts/${d.slug}`}
                    className="block rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3 transition-colors hover:border-ink-500 hover:bg-ink-800/60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base font-medium text-ink-100">{d.title}</span>
                      <span className="ml-auto rounded-full bg-ink-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-300">
                        {d.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-ink-400">
                      <span className="font-mono">/{d.slug}</span>
                      {d.target_symbols.map((s) => (
                        <span
                          key={s}
                          className="rounded-md bg-invest-500/10 px-1.5 py-0.5 font-mono text-[10px] text-invest-500 ring-1 ring-invest-500/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
