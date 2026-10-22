---
title: Overview
description: Why the protocol separates songs, masters, and releases, and how they relate on-chain.
---

The music industry has long used distinct concepts for the underlying song, recordings of it, and the releases that bring those recordings together:

- **Composition:** The music and, where present, lyrics that form the work associated with publishing.
- **Recording:** A particular fixed performance and production of that work, known as the master.
- **Release:** An ordered collection of recordings presented and distributed together, such as a single, EP, or album.

For example, Dolly Parton wrote and recorded “I Will Always Love You” for [*Jolene*](https://www.dollyparton.com/news/i-will-always-love-you-duet-lulu-roman). Whitney Houston later recorded [her own version for *The Bodyguard* soundtrack](https://www.whitneyhouston.com/track/i-will-always-love-you/). In Miso terms, the song would be one `Composition`. Parton's and Houston's masters would be separate `Recording` objects pointing to it. *Jolene* and *The Bodyguard* soundtrack would be separate `Release` objects listing their respective recording IDs.

The composition and each recording can have different contributors, owners, and licenses. [U.S. copyright guidance](https://www.copyright.gov/engage/musicians/) likewise treats musical works and sound recordings as separate works.

The same recording can appear on more than one release. A release establishes a catalog and distribution grouping; it does not create a third class of song or master rights.

The [Miso Music Protocol](https://github.com/misofm/music-protocol) models these familiar distinctions in Sui Move, so concepts such as publishing, masters, and releases carry over for builders. Published as the `miso_music` package, its core fixes the identities and relationships among these objects. Separate packages define licensing, payments, credits, artwork, and other details. The protocol code is licensed under [Apache License 2.0](https://github.com/misofm/music-protocol/blob/main/LICENSE).

```text
+------------------------------------+
| Composition<CompositionShare>      |
| The underlying song                |
+------------------------------------+
                 ^
                 | composition_id
                 | (one composition)
+------------------------------------+
| Recording<RecordingShare>          |
| A particular master                |
+------------------------------------+
                 ^
                 | recording_ids
                 | (ordered, 1-1,000)
+------------------------------------+
| Release                            |
| An ordered track list              |
+------------------------------------+
```

| Core object | What it fixes | What it deliberately leaves out |
| --- | --- | --- |
| [`Composition<CompositionShare>`](/protocol/composition/) | The written work's identity and canonical share type | Title, writers, lyrics, recording commission |
| [`Recording<RecordingShare>`](/protocol/recording/) | Its identity, share type, and immutable composition ID | Master audio, artist credits, version name, license terms |
| [`Release`](/protocol/release/) | Its identity and ordered, distinct recording IDs | Title, cover art, price, release-wide revenue split |
| [`ReleaseConsent`](/protocol/release/#release-consent) | One recording admin's permission for their recording to appear in a specific release | Payment terms and presentation metadata |

A recording's composition ID is a **relationship**, not proof of a license. The current core lets anyone create a recording that points to a composition. Apps that require permission to distribute the recording should check a recognized [recording license](/packages/recording-license/) or another agreement. A release is similarly a catalog relationship; a sales package determines its own commercial terms.

## Immutable core, optional extensions

Each object is created and published in one transaction. Publication shares it and freezes the embedded relationships. An admin capability still grants `uid_mut` access to attach or change dynamic fields after publication. This is how [metadata extensions](/packages/#metadata-extensions) add titles, credits, lyrics, artwork, and classifications without expanding or upgrading the core object.

The admin capability controls the object's extension surface. [Share tokens](/protocol/shares/) express fractional economic ownership; owning shares does not grant the admin capability. Treat an extension value as a statement made under that capability and apply the extension's own trust rules.

Core offers one `CompositionRegistry`, one `RecordingRegistry`, and one `ReleaseRegistry` per package publication. Composition and recording IDs derive from the registry and their unique share types. Release IDs derive from the ordered recording list and a 32-byte salt. These registries are shared at package initialization and have no public constructor.

For a dependency entry and a creation flow, see [Move Integration](/protocol/integrating/).

## Where money flows

Core contains no royalty ledger, payout balance, composition commission rate, or release split. The [royalty-pool](/packages/royalty-pool/) package stakes a work's shares and distributes a payout currency to registered stakes. The [recording-license](/packages/recording-license/) package can express a composition's standing recording terms and hold its cut of recording shares. A sales or streaming package routes revenue into the appropriate pools. Read the specific package's terms before assuming a revenue path is active.

Source: [music-protocol README](https://github.com/misofm/music-protocol/blob/main/README.md) and its [`composition`](https://github.com/misofm/music-protocol/blob/main/sources/composition.move), [`recording`](https://github.com/misofm/music-protocol/blob/main/sources/recording.move), and [`release`](https://github.com/misofm/music-protocol/blob/main/sources/release.move) modules.
