// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://docs.miso.fm',
  vite: { plugins: [tailwindcss()] },
  redirects: {
    '/packages/protocol-extensions/release': '/packages/protocol-extensions/#release',
    '/packages/protocol-extensions/recording': '/packages/protocol-extensions/#recording',
    '/packages/protocol-extensions/composition': '/packages/protocol-extensions/#composition',
    '/protocol/releases': '/protocol/release/#release-consent',
    '/protocol/shares': '/protocol/overview/#share-types',
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
            { label: 'Overview', slug: 'packages' },
            {
              label: 'Party Protocol',
              items: [
                { label: 'Overview', slug: 'protocol/party' },
                { label: 'Extensions', slug: 'packages/protocol-extensions/party' },
              ],
            },
            {
              label: 'Music Protocol',
              items: [
                { label: 'Overview', slug: 'protocol/overview' },
                { label: 'Composition', slug: 'protocol/composition' },
                { label: 'Recording', slug: 'protocol/recording' },
                { label: 'Release', slug: 'protocol/release' },
                { label: 'Extensions', slug: 'packages/protocol-extensions' },
              ],
            },
            {
              label: 'Framework',
              items: [
                { label: 'Overview', slug: 'packages/framework' },
                { label: 'Royalty Pools', slug: 'packages/royalty-pool' },
                { label: 'Recording Licenses', slug: 'packages/recording-license' },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
