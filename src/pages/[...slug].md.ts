import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { docIds, markdownPath, renderMarkdown } from '../lib/llms';

export const getStaticPaths = (async () => {
  const entries = await getCollection('docs');
  return entries
    .filter((entry) => docIds.includes(entry.id as (typeof docIds)[number]))
    .map((entry) => ({
      params: { slug: markdownPath(entry.id).slice(1, -'.md'.length) },
      props: { entry },
    }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) =>
  new Response(renderMarkdown(props.entry, site!), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
