# Miso Docs

The [Miso documentation site](https://docs.miso.fm/) for Sui Move developers. Built with [Nimbus](https://nimbus-docs.com/) (`@cloudflare/nimbus-docs`, pinned in `package.json`) on Astro. The source repository is private while the first guides are developed; the website is public.

## Develop

Requires Node.js 22.23.4 or newer (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

`npm run check` validates Astro content and types; `npx @cloudflare/nimbus-docs check` runs Nimbus's structural and authoring checks. `npm run build` creates the static site in `dist/` for the site root.

Documentation lives in `src/content/docs/`. The site is deployed to Cloudflare Workers by `.github/workflows/deploy.yml` on pushes to `main`. The configured URL is `https://docs.miso.fm/`. The workflow needs the repository secret `CLOUDFLARE_API_TOKEN` with Workers Scripts edit and route/custom-domain permissions for the Miso Labs Cloudflare account.

When documenting contracts, use a specific source revision and distinguish it from published on-chain package generations. Different Miso package repositories may pin different revisions of the Miso Music Protocol. Verify APIs, deployment IDs, and license terms in each source repository before updating an integration guide.

## License

The documentation prose and diagrams are [CC BY 4.0](LICENSE-CONTENT.md). The site code, configuration, and independently written code examples are [Apache-2.0](LICENSE). Copied or adapted package excerpts retain their source license, including FSL where applicable; inclusion in these docs does not grant an additional Apache license to those excerpts. Layouts, components, styles, and routes copied from the Nimbus starter (`src/layouts/`, `src/components/`, `src/styles/`, `src/lib/cn.ts`, `src/lib/variants.ts`, and the starter routes under `src/pages/`) remain under the [MIT license](LICENSE-NIMBUS), Copyright (c) 2025 Cloudflare, Inc., including as modified here.
