// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.miso.fm',
  integrations: [
    starlight({
      title: 'Miso Docs',
      description: 'Build on the Miso Music Protocol on Sui.',
      sidebar: [
        {
          label: 'Miso Music Protocol',
          items: [
            { label: 'Overview', slug: 'protocol/overview' },
            { label: 'Share Tokens', slug: 'protocol/shares' },
            { label: 'Release Consent', slug: 'protocol/releases' },
            { label: 'Move Integration', slug: 'protocol/integrating' },
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
