import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { docIds, renderMarkdown } from '../../lib/llms';

// Miso keeps its curated Markdown export instead of Nimbus's markdownRoute():
// only pages in `docIds` are exported, each with a canonical-page header.
export const getStaticPaths = (async () => {
  const entries = await getCollection('docs');
  return entries
    .filter((entry) => docIds.includes(entry.id as (typeof docIds)[number]))
    .map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) =>
  new Response(renderMarkdown(props.entry, site!), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
