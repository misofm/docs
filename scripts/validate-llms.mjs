import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const docsDir = join(root, 'src/content/docs');
const distDir = join(root, 'dist');
const llms = readFileSync(join(distDir, 'llms.txt'), 'utf8');

if (!llms.startsWith('# Miso Music Protocol\n\n> ')) {
  throw new Error('llms.txt must start with a title and summary blockquote');
}

const links = [...llms.matchAll(/^- \[[^\]]+\]\((https?:\/\/[^)]+)\)/gm)].map((match) => new URL(match[1]));
const indexedUrls = new Set(links.map((url) => url.href));

for (const url of links) {
  if (url.origin !== 'https://docs.miso.fm') continue;
  const asset = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  if (!existsSync(join(distDir, asset.slice(1)))) {
    throw new Error(`llms.txt links to a missing built file: ${url.href}`);
  }
}

function* markdownFiles(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) yield* markdownFiles(file);
    else if (item.name.endsWith('.md')) yield file;
  }
}

for (const file of markdownFiles(docsDir)) {
  const sourcePath = relative(docsDir, file).split(sep).join('/');
  const route = sourcePath.endsWith('/index.md')
    ? sourcePath.slice(0, -'index.md'.length)
    : `${sourcePath.slice(0, -'.md'.length)}/`;
  const markdownUrl = `https://docs.miso.fm/${route}index.md`;
  if (!indexedUrls.has(markdownUrl)) {
    throw new Error(`Add ${markdownUrl} to public/llms.txt`);
  }
  if (!existsSync(join(distDir, route, 'index.md'))) {
    throw new Error(`Missing Markdown export for ${sourcePath}`);
  }
  const html = readFileSync(join(distDir, route, 'index.html'), 'utf8');
  if (!html.includes(`href="/${route}index.md"`) || !html.includes('rel="describedby" href="/llms.txt"')) {
    throw new Error(`Missing Markdown or llms.txt discovery link on ${route}`);
  }
}

console.log('llms.txt links, Markdown exports, and page discovery links are valid.');
