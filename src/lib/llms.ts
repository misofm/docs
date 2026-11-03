import type { CollectionEntry } from 'astro:content';

/** The reading order used by the complete Markdown export. */
export const docIds = [
  'move/music-protocol',
  'move/party-protocol',
  'move/music-protocol/composition',
  'move/music-protocol/recording',
  'move/music-protocol/release',
  'move',
  'move/music-protocol/extensions',
  'move/music-protocol/extensions/composition-title',
  'move/music-protocol/extensions/composition-credits',
  'move/music-protocol/extensions/composition-lyrics',
  'move/music-protocol/extensions/recording-version',
  'move/music-protocol/extensions/recording-credits',
  'move/music-protocol/extensions/recording-advisory',
  'move/music-protocol/extensions/recording-genre',
  'move/music-protocol/extensions/recording-language',
  'move/music-protocol/extensions/recording-master',
  'move/music-protocol/extensions/release-title',
  'move/music-protocol/extensions/release-cover-art',
  'move/music-protocol/extensions/release-credits',
  'move/music-protocol/extensions/release-description',
  'move/music-protocol/extensions/release-genre',
  'move/music-protocol/extensions/release-kind',
  'move/party-protocol/extensions',
  'move/party-protocol/extensions/party-name',
  'move/party-protocol/extensions/party-profile',
  'move/party-protocol/extensions/party-genre',
  'move/party-protocol/extensions/party-group',
  'move/framework',
  'move/framework/royalty-pool',
  'move/framework/recording-license',
  'move/framework/release-license',
  'move/framework/royalty-grant',
  'move/framework/royalty-advance',
  'move/framework/record',
  'move/framework/record-shop',
  'move/framework/miso-player',
  'move/framework/party-wallet',
  'move/framework/vault',
  'move/framework/audio',
  'move/framework/audio-verifier',
  'move/framework/credit',
  'move/framework/genre',
  'move/framework/cover-art',
  'move/framework/release-track-data',
  'move/framework/release-track-iterator',
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
