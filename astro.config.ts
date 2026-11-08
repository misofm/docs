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
            ],
          },
          {
            label: "Music Protocol",
            items: [
              { label: "Overview", link: "/move/music-protocol/" },
              { label: "Composition", link: "/move/music-protocol/composition/" },
              { label: "Recording", link: "/move/music-protocol/recording/" },
              { label: "Release", link: "/move/music-protocol/release/" },
            ],
          },
          {
            label: "Framework",
            items: [
              { label: "Overview", link: "/move/framework/" },
              {
                label: "Composition Extensions",
                items: [
                  { label: "Composition Credits", link: "/move/framework/composition-credits/" },
                  { label: "Composition Lyrics", link: "/move/framework/composition-lyrics/" },
                  { label: "Composition Title", link: "/move/framework/composition-title/" },
                ],
              },
              {
                label: "Recording Extensions",
                items: [
                  { label: "Recording Advisory", link: "/move/framework/recording-advisory/" },
                  { label: "Recording Credits", link: "/move/framework/recording-credits/" },
                  { label: "Recording Genre", link: "/move/framework/recording-genre/" },
                  { label: "Recording Language", link: "/move/framework/recording-language/" },
                  { label: "Recording Master", link: "/move/framework/recording-master/" },
                ],
              },
              {
                label: "Release Extensions",
                items: [
                  { label: "Release Cover Art", link: "/move/framework/release-cover-art/" },
                  { label: "Release Credits", link: "/move/framework/release-credits/" },
                  { label: "Release Description", link: "/move/framework/release-description/" },
                  { label: "Release Genre", link: "/move/framework/release-genre/" },
                  { label: "Release Kind", link: "/move/framework/release-kind/" },
                  { label: "Release Title", link: "/move/framework/release-title/" },
                ],
              },
              {
                label: "Party Extensions",
                items: [
                  { label: "Party Genre", link: "/move/framework/party-genre/" },
                  { label: "Party Group", link: "/move/framework/party-group/" },
                  { label: "Party Name", link: "/move/framework/party-name/" },
                  { label: "Party Profile", link: "/move/framework/party-profile/" },
                  { label: "Party Wallet", link: "/move/framework/party-wallet/" },
                ],
              },
              {
                label: "Records and Player",
                items: [
                  { label: "Record", link: "/move/framework/record/" },
                  { label: "Record Sale", link: "/move/framework/record-sale/" },
                  { label: "Player", link: "/move/framework/player/" },
                  { label: "Player Wallet", link: "/move/framework/player-wallet/" },
                ],
              },
              {
                label: "Royalties",
                items: [
                  { label: "Royalty Pool", link: "/move/framework/royalty-pool/" },
                  { label: "Recording Revenue Share", link: "/move/framework/recording-revenue-share/" },
                  { label: "Release License", link: "/move/framework/release-license/" },
                  { label: "Royalty Grant", link: "/move/framework/royalty-grant/" },
                  { label: "Royalty Advance", link: "/move/framework/royalty-advance/" },
                ],
              },
              {
                label: "Audio",
                items: [
                  { label: "Audio", link: "/move/framework/audio/" },
                  { label: "Audio Verifier", link: "/move/framework/audio-verifier/" },
                  { label: "Enclave", link: "/move/framework/enclave/" },
                ],
              },
              {
                label: "Libraries",
                items: [
                  { label: "Cover Art", link: "/move/framework/cover-art/" },
                  { label: "Credit", link: "/move/framework/credit/" },
                  { label: "Genre", link: "/move/framework/genre/" },
                  { label: "Release Track Data", link: "/move/framework/release-track-data/" },
                  { label: "Release Track Iterator", link: "/move/framework/release-track-iterator/" },
                  { label: "Vault", link: "/move/framework/vault/" },
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
    "/packages/protocol-extensions": "/move/framework/#how-extensions-work",
    "/packages/protocol-extensions/party": "/move/framework/#party-extensions",
    "/packages/protocol-extensions/release": "/move/framework/#release-extensions",
    "/packages/protocol-extensions/recording": "/move/framework/#recording-extensions",
    "/packages/protocol-extensions/composition": "/move/framework/#composition-extensions",
    "/move/music-protocol/extensions": "/move/framework/#how-extensions-work",
    "/move/party-protocol/extensions": "/move/framework/#party-extensions",
    "/move/music-protocol/extensions/composition-credits": "/move/framework/composition-credits/",
    "/move/music-protocol/extensions/composition-lyrics": "/move/framework/composition-lyrics/",
    "/move/music-protocol/extensions/composition-title": "/move/framework/composition-title/",
    "/move/party-protocol/extensions/party-genre": "/move/framework/party-genre/",
    "/move/party-protocol/extensions/party-group": "/move/framework/party-group/",
    "/move/party-protocol/extensions/party-name": "/move/framework/party-name/",
    "/move/party-protocol/extensions/party-profile": "/move/framework/party-profile/",
    "/move/music-protocol/extensions/recording-advisory": "/move/framework/recording-advisory/",
    "/move/music-protocol/extensions/recording-credits": "/move/framework/recording-credits/",
    "/move/music-protocol/extensions/recording-genre": "/move/framework/recording-genre/",
    "/move/music-protocol/extensions/recording-language": "/move/framework/recording-language/",
    "/move/music-protocol/extensions/recording-master": "/move/framework/recording-master/",
    "/move/music-protocol/extensions/recording-version": "/move/framework/#recording-extensions",
    "/move/framework/recording-version": "/move/framework/#recording-extensions",
    "/move/music-protocol/extensions/release-cover-art": "/move/framework/release-cover-art/",
    "/move/music-protocol/extensions/release-credits": "/move/framework/release-credits/",
    "/move/music-protocol/extensions/release-description": "/move/framework/release-description/",
    "/move/music-protocol/extensions/release-genre": "/move/framework/release-genre/",
    "/move/music-protocol/extensions/release-kind": "/move/framework/release-kind/",
    "/move/music-protocol/extensions/release-title": "/move/framework/release-title/",
    "/protocol/overview": "/move/music-protocol/",
    "/protocol/composition": "/move/music-protocol/composition/",
    "/protocol/recording": "/move/music-protocol/recording/",
    "/protocol/release": "/move/music-protocol/release/",
    "/protocol/integrating": "/move/music-protocol/integrating/",
    "/protocol/party": "/move/party-protocol/",
    "/protocol/releases": "/move/music-protocol/release/#authorization-lives-in-a-release-license",
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
