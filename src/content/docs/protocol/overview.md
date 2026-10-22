---
title: Overview
description: Why the protocol separates songs, masters, and releases, and how they relate on-chain.
---

The music industry has long distinguished the underlying song from any particular recording of it:

- **Composition:** The music and, where present, lyrics that form the work associated with publishing.
- **Recording:** A particular fixed performance and production of that work, known as the master.

The two can have different contributors, owners, and licenses. A studio version, a live take, and a cover can all record the same composition while remaining distinct masters. [U.S. copyright guidance](https://www.copyright.gov/engage/musicians/) likewise treats musical works and sound recordings as separate works.

A **release** answers a different question: which recordings are assembled and distributed together? A single, EP, album, or compilation gives recordings an ordered place in a catalog. The same recording can appear on more than one release. The release is a distribution grouping, rather than a third class of song or master rights.

The [Miso Music Protocol](https://github.com/misofm/music-protocol) models these familiar distinctions in Sui Move, so concepts such as publishing, masters, and releases carry over for builders. Published as the `miso_music` package, its core fixes the identities and relationships among these objects. Separate packages define licensing, payments, credits, artwork, and other details. The protocol code is licensed under [Apache License 2.0](https://github.com/misofm/music-protocol/blob/main/LICENSE).

```text
Composition<CompositionShare>          written work
  ↑ composition_id
Recording<RecordingShare>             a particular master of that work
  ↑ recording_id (one or more positions)
Release                                ordered recording IDs
```

| Core object | What it fixes | What it deliberately leaves out |
| --- | --- | --- |
| `Composition<CompositionShare>` | The written work's identity and canonical share type | Title, writers, lyrics, recording commission |
| `Recording<RecordingShare>` | Its identity, share type, and immutable composition ID | Master audio, artist credits, version name, license terms |
| `Release` | Its identity and ordered, distinct recording IDs | Title, cover art, price, release-wide revenue split |
| `ReleaseConsent` | One recording admin's permission for their recording to appear in a specific release | Payment terms and presentation metadata |

A recording's composition ID is a **relationship**, not proof of a license. The current core lets anyone create a recording that points to a composition. Apps that require permission to distribute the recording should check a recognized [recording license](/packages/recording-license/) or another agreement. A release is similarly a catalog relationship; a sales package determines its own commercial terms.

## Immutable core, optional extensions

Each object is created and published in one transaction. Publication shares it and freezes the embedded relationships. An admin capability still grants `uid_mut` access to attach or change dynamic fields after publication. This is how [metadata extensions](/packages/#metadata-extensions) add titles, credits, lyrics, artwork, and classifications without expanding or upgrading the core object.

The admin capability controls the object's extension surface. [Share tokens](/protocol/shares/) express fractional economic ownership; owning shares does not grant the admin capability. Treat an extension value as a statement made under that capability and apply the extension's own trust rules.

Core offers one `CompositionRegistry`, one `RecordingRegistry`, and one `ReleaseRegistry` per package publication. Composition and recording IDs derive from the registry and their unique share types. Release IDs derive from the ordered recording list and a 32-byte salt. These registries are shared at package initialization and have no public constructor.

## Where money flows

Core contains no royalty ledger, payout balance, composition commission rate, or release split. The [royalty-pool](/packages/royalty-pool/) package stakes a work's shares and distributes a payout currency to registered stakes. The [recording-license](/packages/recording-license/) package can express a composition's standing recording terms and hold its cut of recording shares. A sales or streaming package routes revenue into the appropriate pools. Read the specific package's terms before assuming a revenue path is active.

Source: [music-protocol README](https://github.com/misofm/music-protocol/blob/main/README.md) and its [`composition`](https://github.com/misofm/music-protocol/blob/main/sources/composition.move), [`recording`](https://github.com/misofm/music-protocol/blob/main/sources/recording.move), and [`release`](https://github.com/misofm/music-protocol/blob/main/sources/release.move) modules.
