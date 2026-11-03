import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

const nimbusConfig = defineNimbusConfig({
  site: "https://docs.miso.fm",
  title: "Miso",
  description: "Build on the Miso Music Protocol on Sui.",
  locale: "en",
  github: "https://github.com/misofm/music-protocol",
  socialImageAlt: "Miso developer documentation",
  sidebar: {
    items: [
      "index",
      {
        label: "Move Packages",
        items: [
          { label: "Overview", link: "/move/" },
          {
            label: "Party Protocol",
            items: [
              { label: "Overview", link: "/move/party-protocol/" },
              { label: "Extensions", link: "/move/party-protocol/extensions/" },
            ],
          },
          {
            label: "Music Protocol",
            items: [
              { label: "Overview", link: "/move/music-protocol/" },
              { label: "Composition", link: "/move/music-protocol/composition/" },
              { label: "Recording", link: "/move/music-protocol/recording/" },
              { label: "Release", link: "/move/music-protocol/release/" },
              { label: "Extensions", link: "/move/music-protocol/extensions/" },
            ],
          },
          {
            label: "Framework",
            items: [
              { label: "Overview", link: "/move/framework/" },
              { label: "Royalty Pools", link: "/move/framework/royalty-pool/" },
              { label: "Recording Licenses", link: "/move/framework/recording-license/" },
              { label: "Release Licenses", link: "/move/framework/release-license/" },
            ],
          },
        ],
      },
    ],
  },
});

export default defineConfig({
  site: "https://docs.miso.fm",
  // Old /packages and /protocol URLs, kept working after the move to /move.
  redirects: {
    "/packages": "/move/",
    "/packages/framework": "/move/framework/",
    "/packages/royalty-pool": "/move/framework/royalty-pool/",
    "/packages/recording-license": "/move/framework/recording-license/",
    "/packages/protocol-extensions": "/move/music-protocol/extensions/",
    "/packages/protocol-extensions/party": "/move/party-protocol/extensions/",
    "/packages/protocol-extensions/release": "/move/music-protocol/extensions/#release",
    "/packages/protocol-extensions/recording": "/move/music-protocol/extensions/#recording",
    "/packages/protocol-extensions/composition": "/move/music-protocol/extensions/#composition",
    "/protocol/overview": "/move/music-protocol/",
    "/protocol/composition": "/move/music-protocol/composition/",
    "/protocol/recording": "/move/music-protocol/recording/",
    "/protocol/release": "/move/music-protocol/release/",
    "/protocol/integrating": "/move/music-protocol/integrating/",
    "/protocol/party": "/move/party-protocol/",
    "/protocol/releases": "/move/music-protocol/release/#release-consent",
    "/protocol/shares": "/move/music-protocol/#share-types",
  },
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    nimbus(nimbusConfig, {
      rules: {
        "nimbus/frontmatter-shape": "error",
        "nimbus/internal-link": "error",
      },
      markdown: {
        hastPlugins: [tableScroll()],
        features: { headingAttributes: true },
      },
    }),
  ],
});
