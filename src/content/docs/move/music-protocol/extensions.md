---
title: Extensions
description: How optional data attaches to compositions, recordings, and releases, and which extension package adds what.
---

This page is for developers choosing which descriptive data to attach to music objects. It explains how extensions attach to the core and lists every music extension by object, each with its own page.

Music Protocol Extensions add optional typed data to compositions, recordings, and releases. The core keeps each object's identity and relationships; extensions add titles, credits, lyrics, and other descriptive fields without expanding that core.

Each package is its own directory in [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0), alongside the [Framework](/move/framework/) packages. Choose the data your application needs. Party names, profiles, genres, and membership are covered separately in [Party Protocol Extensions](/move/party-protocol/extensions/). Shared value types such as [`credit`](/move/framework/credit/), [`genre`](/move/framework/genre/), [`cover_art`](/move/framework/cover-art/), and [`audio`](/move/framework/audio/) are Framework libraries.

## How Extensions Fit the Core

State-attaching extensions write typed dynamic fields through the object's admin-gated `uid_mut` surface. Reads are permissionless. Each extension owns its field keys, validation, and update rules. Owning shares alone does not authorize extension writes.

Extensions describe objects. [Framework packages](/move/framework/) define policies and workflows such as recording licenses, royalty distribution, and capability custody. A descriptive field alone does not establish an economic agreement or verify a real-world claim.

<span id="extension-inventory"></span>

## Composition

The composition extensions describe the underlying written work: its preferred title, writing credits, and lyrics. They enrich the Composition object while its identity and share type remain in core.

For example, the same composition can have language-keyed lyrics and writing credits pointing to Party IDs, while several recordings continue to refer to that one composition.

| Package | Object | Adds |
| --- | --- | --- |
| [`composition_title`](/move/music-protocol/extensions/composition-title/) | Composition | Preferred title |
| [`composition_credits`](/move/music-protocol/extensions/composition-credits/) | Composition | Songwriter, composer, lyricist, arranger, adapter, and translator credits by Party ID |
| [`composition_lyrics`](/move/music-protocol/extensions/composition-lyrics/) | Composition | Language-keyed, compressed lyrics |

## Recording

The recording extensions describe a particular master: its version label, performance and production credits, advisory classification, genres, languages, and verified audio. The core Recording keeps the master's identity, share type, and immutable composition ID.

A studio version and a live take can therefore have different labels and credits while both refer to the same underlying composition.

| Package | Object | Adds |
| --- | --- | --- |
| [`recording_version`](/move/music-protocol/extensions/recording-version/) | Recording | Take or version label |
| [`recording_credits`](/move/music-protocol/extensions/recording-credits/) | Recording | Artist, performance, and production credits |
| [`recording_advisory`](/move/music-protocol/extensions/recording-advisory/) | Recording | Explicit, not explicit, or cleaned advisory |
| [`recording_genre`](/move/music-protocol/extensions/recording-genre/) | Recording | Genres, one dynamic field per genre |
| [`recording_language`](/move/music-protocol/extensions/recording-language/) | Recording | Ordered languages or instrumental indication |
| [`recording_master`](/move/music-protocol/extensions/recording-master/) | Recording | References to canonical verified [`audio`](/move/framework/audio/) masters, which the admin can add and remove |

## Release

The release extensions describe how an ordered track list is presented: its title, artwork, artist billing, description, genres, and kind. The core Release retains its identity and ordered recording IDs.

Artwork or a preferred title can be updated under the release administrator without changing the fixed track list. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not these presentation fields.

| Package | Object | Adds |
| --- | --- | --- |
| [`release_title`](/move/music-protocol/extensions/release-title/) | Release | Preferred title |
| [`release_cover_art`](/move/music-protocol/extensions/release-cover-art/) | Release | Cover art and optional track overrides |
| [`release_credits`](/move/music-protocol/extensions/release-credits/) | Release | Top-line artist billing |
| [`release_description`](/move/music-protocol/extensions/release-description/) | Release | Editorial description |
| [`release_genre`](/move/music-protocol/extensions/release-genre/) | Release | Genres, one dynamic field per genre |
| [`release_kind`](/move/music-protocol/extensions/release-kind/) | Release | Album, EP, mixtape, or other label |

## Compatibility and Licensing

Each directory is a separate Move package with its own dependency pins and published identity. At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` the extensions pin `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). Check each package's `Move.toml` and `Published.toml` to select compatible source and deployed revisions before combining packages; see [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Package source is © Miso Labs, Inc. and uses [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/LICENSE.md). Follow the repository's source license when reusing code, including excerpts.

Source: [Framework README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/README.md#music-extensions) and each package's README at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`.
