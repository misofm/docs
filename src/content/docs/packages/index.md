---
title: Package Map
description: Core, metadata, royalty, licensing, and commerce packages for Move integrations.
---

The Miso Music Protocol and its extensions are split into small Sui Move packages. Start with [`misofm/music-protocol`](https://github.com/misofm/music-protocol) for composition, recording, release, share types, and release consent. Add only the packages your product needs. Each repository has its own `Move.toml`, source revision, license, and published package IDs.

## Choose by task

- **Create a work or a release:** Start with [Move Integration](/protocol/integrating/), then the relevant [Composition](/protocol/composition/), [Recording](/protocol/recording/), or [Release](/protocol/release/) example.
- **Add titles, credits, or artwork:** Use the [metadata extensions](#metadata-extensions) for the core object you want to describe.
- **Distribute revenue to shareholders:** Read [Royalty Pools](/packages/royalty-pool/) and check which payment package deposits into the pool.
- **Express standing recording terms:** Read [Recording Licenses](/packages/recording-license/); a recording's composition link alone does not grant permission.
- **Resolve an industry code:** Use [Miso Link](#identifier-resolution), then validate the resolved object's type and the namespace's authority.

## Metadata extensions

[`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions) contains independently versioned packages. They attach typed dynamic fields to a core object's UID. Writes require the corresponding admin capability; the extension defines its own read and update API. A title or classification can change after core publication.

| Package | Object | Adds |
| --- | --- | --- |
| [`composition_title`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_title) | Composition | Preferred title |
| [`composition_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_credits) | Composition | Writer and publisher credit by Party ID |
| [`composition_lyrics`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_lyrics) | Composition | Language-keyed, compressed lyrics |
| [`recording_version`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_version) | Recording | Take or version label |
| [`recording_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_credits) | Recording | Artist, performance, and production credits |
| [`recording_advisory`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_advisory) | Recording | Explicit/clean advisory status |
| [`recording_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_genre) | Recording | Ordered genres |
| [`recording_language`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_language) | Recording | Ordered languages or instrumental indication |
| [`release_title`](https://github.com/misofm/music-protocol-extensions/tree/main/release_title) | Release | Preferred title |
| [`release_cover_art`](https://github.com/misofm/music-protocol-extensions/tree/main/release_cover_art) | Release | Cover art and optional track overrides |
| [`release_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/release_credits) | Release | Top-line artist billing |
| [`release_description`](https://github.com/misofm/music-protocol-extensions/tree/main/release_description) | Release | Editorial description |
| [`release_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/release_genre) | Release | Ordered genres |
| [`release_kind`](https://github.com/misofm/music-protocol-extensions/tree/main/release_kind) | Release | Album, EP, mixtape, or other label |

Pin a specific repository commit and the package subdirectory, for example:

```toml
[dependencies]
release_title = { git = "https://github.com/misofm/music-protocol-extensions.git", subdir = "release_title", rev = "<40-character-commit>" }
```

## Rights and payments

| Package | Role |
| --- | --- |
| [`share`](https://github.com/misofm/share) | Validates and fixes each work's canonical share coin supply. Called by core work constructors. |
| [`recording-license`](https://github.com/misofm/recording-license) | Optional standing policy and a recording-share stake representing the composition's agreed cut. [Read the guide](/packages/recording-license/). |
| [`royalty-pool`](https://github.com/misofm/royalty-pool) | One derived pool per work and payout currency; registered share stakes receive royalties. [Read the guide](/packages/royalty-pool/). |
| [`release-revenue-forwarder`](https://github.com/misofm/release-revenue-forwarder) | Release-to-recording payout forwarding. Check its pinned core version and split policy before use. |
| [`pay`](https://github.com/misofm/pay) | Typed payments to compositions, recordings, or releases with receipt events. |
| [`crank`](https://github.com/misofm/crank) | Processes record-sale revenue into claimable royalties. |
| [`streaming`](https://github.com/misofm/streaming) | Prepaid streaming and settlement contracts, with an SDK and example app. |

## Identity, administration, and commerce

| Package | Role |
| --- | --- |
| [`party-protocol`](https://github.com/misofm/party-protocol) and [`party-protocol-extensions`](https://github.com/misofm/party-protocol-extensions) | Party identities and optional party data used by credits. |
| [`credit`](https://github.com/misofm/credit) | Shared credit data type used by attribution extensions. |
| [`vault`](https://github.com/misofm/vault), [`vault-plugins`](https://github.com/misofm/vault-plugins), and [`party-protocol-actions`](https://github.com/misofm/party-protocol-actions) | Capability custody and composed administrative workflows. |
| [`record`](https://github.com/misofm/record) and [`record-extensions`](https://github.com/misofm/record-extensions) | Numbered editions and purchased Records, plus first-party extensions. |
| [`record-shop`](https://github.com/misofm/record-shop) | Fixed or floor price Record listings and purchases. |
| [`release-track-data`](https://github.com/misofm/release-track-data) | Data aligned to a release's track list. |
| [`release-track-iterator`](https://github.com/misofm/release-track-iterator) | Iteration over the release track list for composition in Move. |
| [`genre`](https://github.com/misofm/genre) and [`cover-art`](https://github.com/misofm/cover-art) | Reusable genre vocabulary and artwork primitives. |

## Identifier resolution

[`@misofm/link`](https://github.com/misofm/link) is a TypeScript Sui client extension, not a Move package. It uses SuiNS leaf subnames to map ISWC codes to composition IDs, ISRC codes to recording IDs, and UPC/GTIN codes to release IDs. It also supports IPI and ISNI codes for party identities. The namespace controller can register, reassign, or remove a link; `resolve` returns the target address without fetching or type-checking the object. See [Miso Link](/protocol/overview/#miso-link) for the trust boundary.

This is a source map, not a claim that each `main` branch or deployed generation is mutually compatible. Read each dependency pin and the relevant `Published.toml` before building a multi-package transaction. Package license terms also differ: the core is Apache-2.0, while several extensions use FSL-1.1-ALv2; follow each repository's own license.

Sources: [core](https://github.com/misofm/music-protocol), [extension inventory](https://github.com/misofm/music-protocol-extensions/blob/main/README.md), and the linked package repositories.
