import type { CollectionEntry } from 'astro:content';

/** The reading order used by the complete Markdown export. */
export const docIds = [
  'protocol/overview',
  'protocol/party',
  'protocol/composition',
  'protocol/recording',
  'protocol/release',
  'packages',
  'packages/protocol-extensions',
  'packages/protocol-extensions/party',
  'packages/framework',
  'packages/royalty-pool',
  'packages/recording-license',
  'protocol/integrating',
  'licensing',
] as const;

export function pagePath(id: string): string {
  return `/${id}/`;
}

export function markdownPath(id: string): string {
  return `${pagePath(id)}index.md`;
}

export function renderMarkdown(entry: CollectionEntry<'docs'>, site: URL): string {
  if (entry.body === undefined) throw new Error(`Docs page has no Markdown body: ${entry.id}`);
  const canonical = new URL(pagePath(entry.id), site).href;
  const body = entry.body.trim().replace(/\]\(\/(?!\/)/g, `](${site.origin}/`);
  return `# ${entry.data.title}\n\n> ${entry.data.description}\n\nCanonical page: [${canonical}](${canonical})\n\n${body}\n`;
}
