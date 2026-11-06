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
              {
                label: "Extensions",
                collapsed: true,
                items: [
                  { label: "Overview", link: "/move/party-protocol/extensions/" },
                  { label: "Party Name", link: "/move/party-protocol/extensions/party-name/" },
                  { label: "Party Profile", link: "/move/party-protocol/extensions/party-profile/" },
                  { label: "Party Genre", link: "/move/party-protocol/extensions/party-genre/" },
                  { label: "Party Group", link: "/move/party-protocol/extensions/party-group/" },
                ],
              },
            ],
          },
          {
            label: "Music Protocol",
            items: [
              { label: "Overview", link: "/move/music-protocol/" },
              { label: "Composition", link: "/move/music-protocol/composition/" },
              { label: "Recording", link: "/move/music-protocol/recording/" },
              { label: "Release", link: "/move/music-protocol/release/" },
              {
                label: "Extensions",
                collapsed: true,
                items: [
                  { label: "Overview", link: "/move/music-protocol/extensions/" },
                  {
                    label: "Composition",
                    collapsed: true,
                    items: [
                      { label: "Composition Title", link: "/move/music-protocol/extensions/composition-title/" },
                      { label: "Composition Credits", link: "/move/music-protocol/extensions/composition-credits/" },
                      { label: "Composition Lyrics", link: "/move/music-protocol/extensions/composition-lyrics/" },
                    ],
                  },
                  {
                    label: "Recording",
                    collapsed: true,
                    items: [
                      { label: "Recording Version", link: "/move/music-protocol/extensions/recording-version/" },
                      { label: "Recording Credits", link: "/move/music-protocol/extensions/recording-credits/" },
                      { label: "Recording Advisory", link: "/move/music-protocol/extensions/recording-advisory/" },
                      { label: "Recording Genre", link: "/move/music-protocol/extensions/recording-genre/" },
                      { label: "Recording Language", link: "/move/music-protocol/extensions/recording-language/" },
                      { label: "Recording Master", link: "/move/music-protocol/extensions/recording-master/" },
                    ],
                  },
                  {
                    label: "Release",
                    collapsed: true,
                    items: [
                      { label: "Release Title", link: "/move/music-protocol/extensions/release-title/" },
                      { label: "Release Cover Art", link: "/move/music-protocol/extensions/release-cover-art/" },
                      { label: "Release Credits", link: "/move/music-protocol/extensions/release-credits/" },
                      { label: "Release Description", link: "/move/music-protocol/extensions/release-description/" },
                      { label: "Release Genre", link: "/move/music-protocol/extensions/release-genre/" },
                      { label: "Release Kind", link: "/move/music-protocol/extensions/release-kind/" },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: "Framework",
            items: [
              { label: "Overview", link: "/move/framework/" },
              {
                label: "Economics",
                items: [
                  { label: "Royalty Pool", link: "/move/framework/royalty-pool/" },
                  { label: "Recording Revenue Share", link: "/move/framework/recording-revenue-share/" },
                  { label: "Release License", link: "/move/framework/release-license/" },
                  { label: "Royalty Grant", link: "/move/framework/royalty-grant/" },
                  { label: "Royalty Advance", link: "/move/framework/royalty-advance/" },
                ],
              },
              {
                label: "Records and Player",
                collapsed: true,
                items: [
                  { label: "Record", link: "/move/framework/record/" },
                  { label: "Record Sale", link: "/move/framework/record-sale/" },
                  { label: "Player", link: "/move/framework/player/" },
                ],
              },
              {
                label: "Actions and Libraries",
                collapsed: true,
                items: [
                  { label: "Party Wallet", link: "/move/framework/party-wallet/" },
                  { label: "Player Wallet", link: "/move/framework/player-wallet/" },
                  { label: "Vault", link: "/move/framework/vault/" },
                  { label: "Enclave", link: "/move/framework/enclave/" },
                  { label: "Audio", link: "/move/framework/audio/" },
                  { label: "Audio Verifier", link: "/move/framework/audio-verifier/" },
                  { label: "Credit", link: "/move/framework/credit/" },
                  { label: "Genre", link: "/move/framework/genre/" },
                  { label: "Cover Art", link: "/move/framework/cover-art/" },
                  { label: "Release Track Data", link: "/move/framework/release-track-data/" },
                  { label: "Release Track Iterator", link: "/move/framework/release-track-iterator/" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

export default defineConfig({
  site: "https://docs.miso.fm",
  // Old /packages and /protocol URLs, kept working after the move to /move, and
  // pages of renamed packages.
  redirects: {
    "/packages": "/move/",
    "/packages/framework": "/move/framework/",
    "/packages/royalty-pool": "/move/framework/royalty-pool/",
    "/packages/recording-license": "/move/framework/recording-revenue-share/",
    "/move/framework/recording-license": "/move/framework/recording-revenue-share/",
    "/move/framework/record-shop": "/move/framework/record-sale/",
    "/move/framework/miso-player": "/move/framework/player/",
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
