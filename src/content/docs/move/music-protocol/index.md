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

<span id="why-shared-objects-matter"></span>

## Industry Identifiers

The industry already has useful identifiers: an [ISWC](https://www.iswc.org/iswc) identifies a musical work, an [ISRC](https://isrc.ifpi.org/) identifies a recording, and a [UPC/GTIN](https://support.gs1.org/support/solutions/articles/43000734120-what-is-a-gs1-gtin-) identifies a saleable product. Labels, publishers, societies, distributors, and services keep their own records under those shared keys. The codes alone do not provide one rights record or a programmable link between the song, master, and release.

The [central ISWC registry](https://www.iswc.org/get-iswc) offers a public title and creator lookup, but [ISWC does not indicate ownership shares](https://www.iswc.org/iswc). The [International ISRC Database](https://isrc.ifpi.org/faqs) is one of several recording lookups and may lack valid codes that were not submitted to SoundExchange; [ISRC does not establish rights status](https://isrc.ifpi.org/why-use-isrc/ownership). A [GTIN lookup](https://support.gs1.org/support/solutions/articles/43000734115-how-can-i-know-which-company-assigned-a-gs1-gtin-to-a-product-) identifies the assigning party and may return product details. None is a complete shared record of rights and relationships.

## Access and Reconciliation

Manual lookup and software access differ. The [ISWC public portal](https://www.iswc.org/sites/iswc/files/files/2024-08/Specification%20-%203rd%20Party%20access.pdf) supports individual searches; [CISAC's API](https://www.iswc.org/third-parties) requires onboarding, signed terms, a subscription key, and fees. The [International ISRC Database](https://isrc.ifpi.org/get-isrc/assign-isrc-online) can be searched for free, while [SoundExchange's ISRC API](https://www.soundexchange.com/service-provider/licensing-101/) requires an access request. [Verified by GS1](https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf) offers 30 free GTIN searches per day; [advanced API access](https://support.gs1.org/support/solutions/articles/43000734077-what-is-verified-by-gs1-) goes through a local GS1 member organization.

Records still need reconciliation as data moves between parties. [The MLC's Matching Tool](https://help.themlc.com/en/support/what-is-the-matching-tool) illustrates this: a reported recording use may need to be matched to its underlying musical work.

## Music's Shared Ledger

The [Miso Music Protocol](https://github.com/misofm/music-protocol) gives builders shared, strongly typed `Composition`, `Recording`, and `Release` objects in Sui Move. Published as the `miso_music` package, its core fixes each object's identity and its relationships to the others. A published object ID resolves to on-chain core state. A recording keeps an immutable composition ID. A release keeps an ordered list of existing recordings' IDs. Two integrations reading the same objects see the same core links and can verify the creating transaction.

The on-chain object is a canonical source for its own core state, so integrations using the same IDs avoid mismatches in those relationships. The core does not contain a complete rights or license record. Its publication history does not prove real-world authorship, and optional metadata can still conflict. Separate packages define licensing, payments, credits, artwork, and other details. Applications must apply their trust rules to those claims. The protocol code is licensed under [Apache License 2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

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
                 | (ordered, 1-255)
+------------------------------------+
| Release                            |
| An ordered track list              |
+------------------------------------+
```

| Core object | What it fixes | What it leaves out |
| --- | --- | --- |
| [Composition](/move/music-protocol/composition/) | Written-work identity and its unique share type | Title, writers, lyrics, recording commission |
| [Recording](/move/music-protocol/recording/) | Master identity, its share type, and immutable composition ID | Master audio, artist credits, version name, license terms |
| [Release](/move/music-protocol/release/) | Identity and ordered, distinct recording IDs | Title, cover art, price, recording admins' authorization, revenue splits |

A recording's composition ID is a **relationship**, not proof of a license. The current core lets anyone create a recording that points to a composition. Apps that require permission to distribute the recording should check a recognized [recording license](/move/framework/recording-license/) or another agreement. A release is similarly a catalog relationship: anyone can create one, and a [release license](/move/framework/release-license/) records each recording admin's authorization and the release's revenue splits.

## Share Types

Each composition and recording has its own **share type**, tying shares to that particular work. Core fixes the supply at **100,000,000 shares with six decimals**. The work's identity and share type stay associated as those shares are allocated, transferred, or staked.

Shares express fractional economic ownership. Admin capabilities separately control extension writes and the licenses a work grants. Holding shares alone does not activate royalties: payment packages must route revenue into funded pools, and holders must register stakes. See [Composition Shares](/move/music-protocol/composition/#composition-shares), [Recording Shares](/move/music-protocol/recording/#recording-shares), and [Royalty Pools](/move/framework/royalty-pool/) for the details.

## Miso Link

[Miso Link](https://github.com/misofm/link) connects these on-chain objects to existing industry codes through SuiNS. It normalizes an ISWC, ISRC, or UPC/GTIN into a leaf subname under a configured namespace and points that name to a Sui address. An ISWC can point to a `Composition`, an ISRC to a `Recording`, and a UPC/GTIN to a `Release`. Apps that trust the same namespace can resolve a code to the same on-chain object and inspect its core relationships and publication history. A rights holder who controls a namespace can use this bridge to direct others to the object it treats as its canonical on-chain work.

A Miso Link mapping is an assertion by the SuiNS namespace controller, not a registration with CISAC, IFPI, or GS1. The link can be reassigned or expire with its parent domain, and resolving it returns an address without checking the target's object type or rights claims. Readers should validate the target and the authority behind any claim before relying on it.

## Immutable core, optional extensions

Each object is created and shared in one transaction: `new` returns it with its admin capability and emits a creation event, and `share` makes it a shared object. Its embedded relationships are fixed from creation. The admin capability still grants `uid_mut` access to attach or change dynamic fields after publication. This is how [metadata extensions](/move/music-protocol/extensions/) add titles, credits, lyrics, artwork, and classifications without expanding or upgrading the core object.

The admin capability controls the object's extension surface. [Shares](#share-types) express fractional economic ownership; owning shares does not grant the admin capability. Treat an extension value as a statement made under that capability and apply the extension's own trust rules.

Core offers one `CompositionRegistry` and one `RecordingRegistry` per package publication, shared at package initialization with no public constructor. Composition and recording IDs derive from the registry and their unique share types. A release gets a fresh ID, so two releases of the same track list are distinct objects.

The following pages explain those design choices in more detail: [Party](/move/party-protocol/), [Composition](/move/music-protocol/composition/), [Recording](/move/music-protocol/recording/), and [Release](/move/music-protocol/release/).

## Parties and Attribution

The separate [Party protocol](/move/party-protocol/) represents the people and groups credited on works. Music credit extensions reference Party IDs, while Party extensions add a display name, biographies, and genres. A Party identity complements the composition, recording, and release model; it is not a fourth music-object type in `miso_music`.

## Where money flows

Core contains no royalty ledger, payout balance, composition commission rate, or release split. The [royalty-pool](/move/framework/royalty-pool/) package stakes a work's shares and distributes a payout currency to registered stakes. The [recording-license](/move/framework/recording-license/) package expresses a composition's standing recording terms and holds its cut of recording shares. The [release-license](/move/framework/release-license/) package fixes a release's per-track splits and forwards its revenue to each track's pool. [Royalty grants](/move/framework/royalty-grant/) and [advances](/move/framework/royalty-advance/) assign part of a stake's royalties to someone else for a term or until an amount is repaid. A sales or streaming package routes revenue into the appropriate pools. [Framework](/move/framework/#how-revenue-moves) traces the full path. Read the specific package's terms before assuming a revenue path is active.

These pages describe `miso_music` at commit [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), the source recorded as published on Sui mainnet. See [Move Integration](/move/music-protocol/integrating/) for the deployment record.

Source: pinned [music-protocol README](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md) and its [`composition`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/composition.move), [`recording`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/recording.move), and [`release`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/release.move) modules.
