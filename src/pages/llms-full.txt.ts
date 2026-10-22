import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { docIds, renderMarkdown } from '../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('docs');
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const pages = docIds.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Missing docs page for llms-full.txt: ${id}`);
    return renderMarkdown(entry, site!);
  });

  const introduction = '# Miso Music Protocol — Complete Documentation\n\n> Full text of the Miso Music Protocol documentation. For a focused reading path, see https://docs.miso.fm/llms.txt.\n';
  return new Response([introduction, ...pages].join('\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
