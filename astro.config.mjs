// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://misofm.github.io',
  base: '/docs',
  integrations: [
    starlight({
      title: 'Miso Docs',
      description: 'Build on the Miso music protocol on Sui.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/misofm/docs' }],
      editLink: { baseUrl: 'https://github.com/misofm/docs/edit/main/' },
      sidebar: [
        {
          label: 'Music protocol',
          items: [
            { label: 'Core model', slug: 'protocol/overview' },
            { label: 'Share tokens', slug: 'protocol/shares' },
            { label: 'Release consent', slug: 'protocol/releases' },
            { label: 'Move integration', slug: 'protocol/integrating' },
          ],
        },
        {
          label: 'Miso packages',
          items: [
            { label: 'Package map', slug: 'packages' },
            { label: 'Royalty pools', slug: 'packages/royalty-pool' },
            { label: 'Recording licenses', slug: 'packages/recording-license' },
          ],
        },
      ],
    }),
  ],
});
