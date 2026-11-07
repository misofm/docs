---
title: Overview
description: Songs, masters, and releases as shared, typed on-chain objects.
---

The industry distinguishes the song, recordings of it, and releases that group those recordings:

- **Composition:** The music and any lyrics. The work associated with publishing.
- **Recording:** One fixed performance and production of that work, the master.
- **Release:** Recordings distributed together in order, such as a single, EP, or album.

For example, Dolly Parton wrote and recorded “I Will Always Love You” for [*Jolene*](https://www.dollyparton.com/news/i-will-always-love-you-duet-lulu-roman). Whitney Houston later recorded [her own version for *The Bodyguard* soundtrack](https://www.whitneyhouston.com/track/i-will-always-love-you/). In Miso, the song is one `Composition`. Parton's and Houston's masters are separate `Recording` objects pointing to it. *Jolene* and *The Bodyguard* soundtrack are separate `Release` objects listing their recording IDs.

The composition and each recording can have different contributors, owners, and licenses. [U.S. copyright guidance](https://www.copyright.gov/engage/musicians/) also treats musical works and sound recordings as separate works.

One recording can appear on many releases. A release groups a catalog for distribution. It creates no third class of rights.

<span id="why-shared-objects-matter"></span>

## Industry Identifiers

An [ISWC](https://www.iswc.org/iswc) identifies a musical work, an [ISRC](https://isrc.ifpi.org/) a recording, and a [UPC/GTIN](https://support.gs1.org/support/solutions/articles/43000734120-what-is-a-gs1-gtin-) a saleable product. Labels, publishers, societies, distributors, and services each keep their own records under those keys. The codes give no single rights record and no programmable link between song, master, and release.

- The [central ISWC registry](https://www.iswc.org/get-iswc) offers public title and creator lookup, but [ISWC does not indicate ownership shares](https://www.iswc.org/iswc).
- The [International ISRC Database](https://isrc.ifpi.org/faqs) is one of several recording lookups and may lack valid codes not submitted to SoundExchange. [ISRC does not establish rights status](https://isrc.ifpi.org/why-use-isrc/ownership).
- A [GTIN lookup](https://support.gs1.org/support/solutions/articles/43000734115-how-can-i-know-which-company-assigned-a-gs1-gtin-to-a-product-) identifies the assigning party and may return product details.

None is a complete shared record of rights and relationships.

## Access and Reconciliation

Manual lookup and software access differ.

- ISWC: the [public portal](https://www.iswc.org/sites/iswc/files/files/2024-08/Specification%20-%203rd%20Party%20access.pdf) supports individual searches. [CISAC's API](https://www.iswc.org/third-parties) requires onboarding, signed terms, a subscription key, and fees.
- ISRC: the [International ISRC Database](https://isrc.ifpi.org/get-isrc/assign-isrc-online) is free to search. [SoundExchange's ISRC API](https://www.soundexchange.com/service-provider/licensing-101/) requires an access request.
- GTIN: [Verified by GS1](https://www.gs1.org/docs/verified-by-gs1/public-verified-by-gs1-tou.pdf) offers 30 free searches per day. [Advanced API access](https://support.gs1.org/support/solutions/articles/43000734077-what-is-verified-by-gs1-) goes through a local GS1 member organization.

Records need reconciliation as data moves between parties. [The MLC's Matching Tool](https://help.themlc.com/en/support/what-is-the-matching-tool) shows why: a reported recording use must be matched to its musical work.

## Music's Shared Ledger

The [Miso Music Protocol](https://github.com/misofm/music-protocol) gives builders shared, typed `Composition`, `Recording`, and `Release` objects in Sui Move. The `miso_music` package fixes each object's identity and its relationships. An object ID resolves to on-chain core state. A recording keeps an immutable composition ID. A release keeps an ordered list of existing recording IDs. Integrations reading the same objects see the same core links and can verify the creating transaction.

The object is canonical for its own core state only. Core holds no complete rights or license record. Publication history does not prove real-world authorship, and optional metadata can conflict. Separate packages define licensing, payments, credits, artwork, and other details. Apply your own trust rules to those claims. The protocol code is licensed under [Apache License 2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

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

A recording's composition ID is a **relationship**, not proof of a license. Anyone can create a recording that points to any composition. Apps that need distribution permission must rely on an agreement they recognize. A [recording revenue share](/move/framework/recording-revenue-share/) is a voluntary share of the recording's revenue with its composition, not a copyright license. A release is also only a catalog relationship. Anyone can create one. A [release license](/move/framework/release-license/) records each recording admin's authorization and the release's revenue splits.

## Share Types

Each composition and recording has its own **share type**, tying shares to that work. Core fixes supply at **100,000,000 shares with six decimals**. Identity and share type stay associated through allocation, transfer, and staking.

Shares express fractional economic ownership. Admin capabilities separately control extension writes and the licenses a work grants. Shares alone pay nothing: payment packages must route revenue into funded pools, and holders must register stakes. See [Composition Shares](/move/music-protocol/composition/#composition-shares), [Recording Shares](/move/music-protocol/recording/#recording-shares), and [Royalty Pool](/move/framework/royalty-pool/) for the details.

## Miso Link

[Miso Link](https://github.com/misofm/link) maps industry codes to these objects through SuiNS. It normalizes an ISWC, ISRC, or UPC/GTIN into a leaf subname under a configured namespace and points that name to a Sui address: ISWC to a `Composition`, ISRC to a `Recording`, UPC/GTIN to a `Release`. Apps trusting the same namespace resolve a code to the same object. A rights holder who controls a namespace can use it to point others at the object it treats as canonical.

A mapping is an assertion by the SuiNS namespace controller, not a registration with CISAC, IFPI, or GS1. It can be reassigned or expire with its parent domain. Resolving returns an address without checking the target's object type or rights claims. Validate the target and the authority behind the claim before relying on it.

## Immutable core, optional extensions

`new` returns each object with its admin capability and emits a creation event. `share` makes it shared. Create and share in one transaction. Embedded relationships are fixed from creation. The admin capability still grants `uid_mut` access to attach or change dynamic fields later. This is how [metadata extensions](/move/framework/#how-extensions-work) add titles, credits, lyrics, artwork, and classifications without changing or upgrading the core object.

The admin capability controls the extension surface. [Shares](#share-types) are economic ownership. Owning shares does not grant the admin capability. Treat an extension value as a statement made under that capability, and apply the extension's trust rules.

Core has one `CompositionRegistry` and one `RecordingRegistry` per package publication, shared at initialization with no public constructor. Composition and recording IDs derive from the registry and their unique share types. A release gets a fresh ID, so two releases of the same track list are distinct objects.

Design details: [Party](/move/party-protocol/), [Composition](/move/music-protocol/composition/), [Recording](/move/music-protocol/recording/), and [Release](/move/music-protocol/release/).

## Parties and Attribution

The separate [Party protocol](/move/party-protocol/) represents the people and groups credited on works. Music credit extensions reference Party IDs. Party extensions add a display name, biographies, and genres. A Party is not a fourth music-object type in `miso_music`.

## Where money flows

Core has no royalty ledger, payout balance, composition commission rate, or release split.

- [`royalty-pool`](/move/framework/royalty-pool/) stakes a work's shares and distributes a payout currency to registered stakes.
- [`recording-revenue-share`](/move/framework/recording-revenue-share/) gives a recording's composition a fixed rate of its shares, held as the composition's stake.
- [`release-license`](/move/framework/release-license/) fixes a release's per-track splits and forwards revenue to each track's pool.
- [Royalty grants](/move/framework/royalty-grant/) and [advances](/move/framework/royalty-advance/) assign part of a stake's royalties to someone else for a term or until an amount is repaid.
- A sales or streaming package routes revenue into the right pools.

[Framework](/move/framework/#how-revenue-moves) traces the full path. Read a package's terms before assuming its revenue path is active.

These pages describe `miso_music` at commit [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), the source recorded as published on Sui mainnet. See [Move Integration](/move/music-protocol/integrating/) for the deployment record.

Source: pinned [music-protocol README](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md) and its [`composition`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/composition.move), [`recording`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/recording.move), and [`release`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/release.move) modules.
