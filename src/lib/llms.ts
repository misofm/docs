import type { CollectionEntry } from 'astro:content';

/** The reading order used by the complete Markdown export. */
export const docIds = [
  'move/music-protocol',
  'move/party-protocol',
  'move/music-protocol/composition',
  'move/music-protocol/recording',
  'move/music-protocol/release',
  'move',
  'move/framework',
  'move/framework/royalty-pool',
  'move/framework/recording-revenue-share',
  'move/framework/release-license',
  'move/framework/royalty-grant',
  'move/framework/royalty-advance',
  'move/framework/record',
  'move/framework/record-sale',
  'move/framework/player',
  'move/framework/party-wallet',
  'move/framework/player-wallet',
  'move/framework/vault',
  'move/framework/enclave',
  'move/framework/audio',
  'move/framework/audio-verifier',
  'move/framework/credit',
  'move/framework/genre',
  'move/framework/cover-art',
  'move/framework/release-track-data',
  'move/framework/release-track-iterator',
  'move/framework/composition-title',
  'move/framework/composition-credits',
  'move/framework/composition-lyrics',
  'move/framework/recording-version',
  'move/framework/recording-credits',
  'move/framework/recording-advisory',
  'move/framework/recording-genre',
  'move/framework/recording-language',
  'move/framework/recording-master',
  'move/framework/release-title',
  'move/framework/release-cover-art',
  'move/framework/release-credits',
  'move/framework/release-description',
  'move/framework/release-genre',
  'move/framework/release-kind',
  'move/framework/party-name',
  'move/framework/party-profile',
  'move/framework/party-genre',
  'move/framework/party-group',
  'move/music-protocol/integrating',
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
