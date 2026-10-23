// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://docs.miso.fm',
  vite: { plugins: [tailwindcss()] },
  // Old /packages and /protocol URLs, kept working after the move to /move.
  redirects: {
    '/packages': '/move/',
    '/packages/framework': '/move/framework/',
    '/packages/royalty-pool': '/move/framework/royalty-pool/',
    '/packages/recording-license': '/move/framework/recording-license/',
    '/packages/protocol-extensions': '/move/music-protocol/extensions/',
    '/packages/protocol-extensions/party': '/move/party-protocol/extensions/',
    '/packages/protocol-extensions/release': '/move/music-protocol/extensions/#release',
    '/packages/protocol-extensions/recording': '/move/music-protocol/extensions/#recording',
    '/packages/protocol-extensions/composition': '/move/music-protocol/extensions/#composition',
    '/protocol/overview': '/move/music-protocol/',
    '/protocol/composition': '/move/music-protocol/composition/',
    '/protocol/recording': '/move/music-protocol/recording/',
    '/protocol/release': '/move/music-protocol/release/',
    '/protocol/integrating': '/move/music-protocol/integrating/',
    '/protocol/party': '/move/party-protocol/',
    '/protocol/releases': '/move/music-protocol/release/#release-consent',
    '/protocol/shares': '/move/music-protocol/#share-types',
  },
  integrations: [
    starlight({
      title: 'Miso',
      description: 'Build on the Miso Music Protocol on Sui.',
      favicon: '/favicon.svg',
      logo: {
        src: './src/assets/miso-mark.svg',
        alt: 'Miso',
      },
      customCss: ['./src/styles/miso.css'],
      components: {
        Head: './src/components/Head.astro',
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      social: [
        { icon: 'github', label: 'Miso Music Protocol on GitHub', href: 'https://github.com/misofm/music-protocol' },
        { icon: 'x.com', label: 'Miso on X', href: 'https://x.com/_misofm' },
      ],
      sidebar: [
        {
          label: 'Move Packages',
          items: [
            { label: 'Overview', slug: 'move' },
            {
              label: 'Party Protocol',
              items: [
                { label: 'Overview', slug: 'move/party-protocol' },
                { label: 'Extensions', slug: 'move/party-protocol/extensions' },
              ],
            },
            {
              label: 'Music Protocol',
              items: [
                { label: 'Overview', slug: 'move/music-protocol' },
                { label: 'Composition', slug: 'move/music-protocol/composition' },
                { label: 'Recording', slug: 'move/music-protocol/recording' },
                { label: 'Release', slug: 'move/music-protocol/release' },
                { label: 'Extensions', slug: 'move/music-protocol/extensions' },
              ],
            },
            {
              label: 'Framework',
              items: [
                { label: 'Overview', slug: 'move/framework' },
                { label: 'Royalty Pools', slug: 'move/framework/royalty-pool' },
                { label: 'Recording Licenses', slug: 'move/framework/recording-license' },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
