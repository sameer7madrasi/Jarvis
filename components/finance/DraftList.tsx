import Link from "next/link";
import { FileText, Tag } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Draft } from "@/lib/types-v2";

interface Props {
  drafts: Draft[];
}

export function DraftList({ drafts }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drafts</CardTitle>
        <FileText size={16} className="text-ink-400" />
      </CardHeader>
      <CardBody>
        {drafts.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-400">
            No drafts yet. Ask JarvisFinance to outline an article.
          </div>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/finance/drafts/${d.slug}`}
                  className="block rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2 transition-colors hover:border-ink-500 hover:bg-ink-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-100">{d.title}</span>
                    <span className="ml-auto rounded-full bg-ink-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-300">
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.target_symbols.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-invest-500/10 px-1.5 py-0.5 font-mono text-[10px] text-invest-500 ring-1 ring-invest-500/30"
                      >
                        {s}
                      </span>
                    ))}
                    {d.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300"
                      >
                        <Tag size={8} />
                        {t}
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
  );
}
