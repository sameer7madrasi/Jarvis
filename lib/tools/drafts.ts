/**
 * JarvisFinance drafts tools — let the persona research, outline and append
 * to article drafts that ship to `app/finance/drafts/[slug]/page.tsx`.
 */

import { tool } from "ai";
import { z } from "zod";

import {
  appendToDraft,
  createDraft,
  fetchDrafts,
} from "../data-v2";

export const listDrafts = tool({
  description:
    "List Sameer's article drafts (title, slug, status, target symbols, tags, last-updated).",
  parameters: z.object({}),
  execute: async () => {
    const drafts = await fetchDrafts();
    return {
      count: drafts.length,
      drafts: drafts.map((d) => ({
        slug: d.slug,
        title: d.title,
        status: d.status,
        tags: d.tags,
        target_symbols: d.target_symbols,
        updated_at: d.updated_at,
        excerpt: d.body_md.slice(0, 240),
      })),
    };
  },
});

export const createDraftTool = tool({
  description:
    "Create a new article draft seeded with a title and optional outline. Write action — confirm with the user before calling.",
  parameters: z.object({
    title: z.string().describe("Working title for the article"),
    target_symbols: z
      .array(z.string())
      .optional()
      .describe("Ticker symbols the article will analyze"),
    tags: z.array(z.string()).optional(),
    outline_md: z.string().optional().describe("Markdown outline body. Defaults to '# Title' if omitted."),
  }),
  execute: async ({ title, target_symbols, tags, outline_md }) => {
    const draft = await createDraft({
      title,
      target_symbols: (target_symbols ?? []).map((s) => s.toUpperCase()),
      tags,
      body_md: outline_md,
    });
    return {
      created: true,
      slug: draft.slug,
      title: draft.title,
      url: `/finance/drafts/${draft.slug}`,
    };
  },
});

export const appendToDraftTool = tool({
  description:
    "Append markdown content to an existing draft (e.g. a new section, table, or bullet list). Write action — confirm with the user before calling.",
  parameters: z.object({
    slug: z.string().describe("Slug of the draft (from list_drafts)"),
    markdown: z.string().describe("Markdown content to append"),
  }),
  execute: async ({ slug, markdown }) => {
    const draft = await appendToDraft(slug, markdown);
    return {
      updated: true,
      slug: draft.slug,
      length_chars: draft.body_md.length,
    };
  },
});

export const DRAFT_TOOLS = {
  list_drafts: listDrafts,
  create_draft: createDraftTool,
  append_to_draft: appendToDraftTool,
} as const;
