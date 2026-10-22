---
title: Overview
description: Why the protocol models songs, masters, and releases as shared on-chain objects.
---

The music industry has long used distinct concepts for the underlying song, recordings of it, and the releases that bring those recordings together:

- **Composition:** The music and, where present, lyrics that form the work associated with publishing.
- **Recording:** A particular fixed performance and production of that work, known as the master.
- **Release:** An ordered collection of recordings presented and distributed together, such as a single, EP, or album.

For example, Dolly Parton wrote and recorded “I Will Always Love You” for [*Jolene*](https://www.dollyparton.com/news/i-will-always-love-you-duet-lulu-roman). Whitney Houston later recorded [her own version for *The Bodyguard* soundtrack](https://www.whitneyhouston.com/track/i-will-always-love-you/). In Miso terms, the song would be one `Composition`. Parton's and Houston's masters would be separate `Recording` objects pointing to it. *Jolene* and *The Bodyguard* soundtrack would be separate `Release` objects listing their respective recording IDs.

The composition and each recording can have different contributors, owners, and licenses. [U.S. copyright guidance](https://www.copyright.gov/engage/musicians/) likewise treats musical works and sound recordings as separate works.

The same recording can appear on more than one release. A release establishes a catalog and distribution grouping; it does not create a third class of song or master rights.

## Why Shared Objects Matter

The industry already has useful identifiers: an [ISWC](https://www.iswc.org/iswc) identifies a musical work, an [ISRC](https://isrc.ifpi.org/) identifies a recording, and a [UPC/GTIN](https://support.gs1.org/support/solutions/articles/43000734120-what-is-a-gs1-gtin-) identifies a saleable product. These are shared keys, but labels, publishers, societies, distributors, and services still maintain their own records under those keys. An identifier alone does not yield one authoritative record of a work's rights, licenses, shares, and relationships to other works.

There is a [central ISWC registry](https://www.iswc.org/get-iswc) with a public lookup for titles and creators, but [ISWC does not indicate ownership shares](https://www.iswc.org/iswc). ISRC records are more distributed: the [International ISRC Database is one of several searchable sources](https://isrc.ifpi.org/faqs), and it may not contain a valid ISRC if the recording was not submitted to SoundExchange. [ISRC also does not establish rights status](https://isrc.ifpi.org/why-use-isrc/ownership). A [GTIN lookup](https://support.gs1.org/support/solutions/articles/43000734115-how-can-i-know-which-company-assigned-a-gs1-gtin-to-a-product-) identifies the assigning party and may return product details. None of these lookups supplies a shared, programmable relationship among the song, master, and release.

Access also differs between manual search and software integration. The [ISWC public portal](https://www.iswc.org/sites/iswc/files/files/2024-08/Specification%20-%203rd%20Party%20access.pdf) supports individual searches, while [CISAC's third-party API](https://www.iswc.org/third-parties) requires onboarding, signed terms, a subscription key, and fees. The [International ISRC Database](https://isrc.ifpi.org/get-isrc/assign-isrc-online) can be searched for free, while [SoundExchange's ISRC search API](https://www.soundexchange.com/service-provider/licensing-101/) requires a request for access. [Verified by GS1](https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf) offers 30 free GTIN searches per day; [advanced API access](https://support.gs1.org/support/solutions/articles/43000734077-what-is-verified-by-gs1-) is arranged through a local GS1 member organization. These public lookup tools do not amount to unrestricted, complete rights-data APIs.

Those records must be reconciled as data moves between parties. [The MLC's Matching Tool](https://help.themlc.com/en/support/what-is-the-matching-tool) illustrates the cost: a reported recording use may still need to be matched to its underlying musical work. Even with shared codes, comparing catalogs can feel like comparing contact books with different names and connections for the same person. Someone has to reconcile the entries before they can act on them together.

The [Miso Music Protocol](https://github.com/misofm/music-protocol) gives builders shared, strongly typed `Composition`, `Recording`, and `Release` objects in Sui Move. Published as the `miso_music` package, its core fixes each object's identity and its relationships to the others. A published object ID resolves to on-chain core state. A recording keeps an immutable composition ID. A release keeps an ordered list of recording IDs authorized by the recording admins. Two integrations reading the same objects see the same core links and can verify the publication transaction. An integration can map ISWCs and ISRCs to the corresponding objects and associate product codes such as UPC/GTIN with releases.

The on-chain object is a canonical source for its own core state, so integrations using the same IDs avoid mismatches in those relationships. The core does not contain a complete rights or license record. Its publication history does not prove real-world authorship, and optional metadata can still conflict. Separate packages define licensing, payments, credits, artwork, and other details. Applications must apply their trust rules to those claims. The protocol code is licensed under [Apache License 2.0](https://github.com/misofm/music-protocol/blob/main/LICENSE).

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
