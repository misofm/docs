---
title: Extensions
description: All music protocol extensions for compositions, recordings, and releases.
---

Music Protocol Extensions add optional typed data to compositions, recordings, and releases. The core keeps each object's identity and relationships; extensions add titles, credits, lyrics, and other descriptive fields without expanding that core.

Each package is its own directory in [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0), alongside the [Framework](/move/framework/) packages. Choose the data your application needs. Identity profiles and membership are covered separately in [Party Extensions](/move/party-protocol/extensions/).

## How Extensions Fit the Core

State-attaching extensions write typed dynamic fields through the object's admin-gated `uid_mut` surface. Reads are permissionless. Each extension owns its field keys, validation, and update rules. Owning shares alone does not authorize extension writes.

Extensions describe objects. [Framework packages](/move/framework/) define policies and workflows such as recording licenses, royalty distribution, and capability custody. A descriptive field alone does not establish an economic agreement or verify a real-world claim.

<span id="extension-inventory"></span>

## Composition

The composition extensions describe the underlying written work: its preferred title, songwriting and publishing credits, and lyrics. They enrich the Composition object while its identity and share type remain in core.

For example, the same composition can have language-keyed lyrics and credits pointing to Party IDs, while several recordings continue to refer to that one composition.

| Package | Object | Adds |
| --- | --- | --- |
| [`composition_title`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_title) | Composition | Preferred title |
| [`composition_credits`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_credits) | Composition | Writer and publisher credit by Party ID |
| [`composition_lyrics`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics) | Composition | Language-keyed, compressed lyrics |

## Recording

The recording extensions describe a particular master: its version label, performance and production credits, advisory classification, genres, languages, and verified audio. The core Recording keeps the master's identity, share type, and immutable composition ID.

A studio version and a live take can therefore have different labels and credits while both refer to the same underlying composition.

| Package | Object | Adds |
| --- | --- | --- |
| [`recording_version`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_version) | Recording | Take or version label |
| [`recording_credits`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_credits) | Recording | Artist, performance, and production credits |
| [`recording_advisory`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_advisory) | Recording | Explicit/clean advisory status |
| [`recording_genre`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_genre) | Recording | Genres, one dynamic field per genre |
| [`recording_language`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_language) | Recording | Ordered languages or instrumental indication |
| [`recording_master`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_master) | Recording | References to canonical verified [`audio`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/audio) masters, which the admin can add and remove |

## Release

The release extensions describe how an ordered track list is presented: its title, artwork, artist billing, description, genres, and kind. The core Release retains the ordered recording IDs and the identity approved by recording admins.

Artwork or a preferred title can be updated under the release administrator without changing the fixed track list. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not these presentation fields.

| Package | Object | Adds |
| --- | --- | --- |
| [`release_title`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_title) | Release | Preferred title |
| [`release_cover_art`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art) | Release | Cover art and optional track overrides |
| [`release_credits`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_credits) | Release | Top-line artist billing |
| [`release_description`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description) | Release | Editorial description |
| [`release_genre`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_genre) | Release | Genres, one dynamic field per genre |
| [`release_kind`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_kind) | Release | Album, EP, mixtape, or other label |

## Compatibility and Licensing

Each directory is a separate Move package with its own dependency pins and published identity. At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` the extensions pin `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). Check each package's `Move.toml` and `Published.toml` to select compatible source and deployed revisions before combining packages; see [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Package source is © Miso Labs, Inc. and uses [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/LICENSE.md). Follow the repository's source license when reusing code, including excerpts.

Source: [Framework README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/README.md#music-extensions) and each package's README at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`.
