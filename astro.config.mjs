// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.miso.fm',
  redirects: {
    '/protocol/releases': '/protocol/release/#release-consent',
  },
  integrations: [
    starlight({
      title: 'Miso Docs',
      description: 'Build on the Miso Music Protocol on Sui.',
      sidebar: [
        {
          label: 'Miso Music Protocol',
          items: [
            { label: 'Overview', slug: 'protocol/overview' },
            { label: 'Shares', slug: 'protocol/shares' },
            { label: 'Composition', slug: 'protocol/composition' },
            { label: 'Recording', slug: 'protocol/recording' },
            { label: 'Release', slug: 'protocol/release' },
          ],
        },
        {
          label: 'Miso Packages',
          items: [
            { label: 'Package Map', slug: 'packages' },
            { label: 'Royalty Pools', slug: 'packages/royalty-pool' },
            { label: 'Recording Licenses', slug: 'packages/recording-license' },
          ],
        },
        { label: 'Licensing', slug: 'licensing' },
      ],
    }),
  ],
});
