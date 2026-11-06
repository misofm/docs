---
title: Overview
description: How the core protocol, data-model extensions, and business-logic framework fit together.
---

Miso separates music and party identities, optional data, and business rules into small Sui Move packages. This lets products share the same composition, recording, release, and party identities while choosing the data and workflows they need.

| Layer | Responsibility | Start Here |
| --- | --- | --- |
| Protocol: Party | Entity identities and capability-controlled administration | [Party](/move/party-protocol/) |
| Protocol: Music | Core identity, share types, composition relationships, and ordered releases | [Protocol Overview](/move/music-protocol/) |
| Framework | Optional data extensions for works and Parties, royalty pools, recording revenue shares, release licenses, grants and advances, Record sales, the Player, and shared libraries | [Framework](/move/framework/) |

The core also depends on [`share`](https://github.com/unconfirmedlabs/share) to validate each work's canonical share type and fix its supply. This supports the core's ownership model.

## Framework

Every package in [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7) has its own page under Framework. Extensions add optional data to those objects: titles, credits, lyrics, and genres on compositions, recordings, and releases, and a name, profile, genres, and group membership on a Party. The other packages define what applications can do with the objects: share a recording's revenue with its composition, license releases, distribute royalties, advance money against them, sell Records, and hold capabilities. Start with the [Framework overview](/move/framework/), which lists the [extensions](/move/framework/#how-extensions-work) by object and traces a sale from a release to its shareholders, then read [Royalty Pool](/move/framework/royalty-pool/), [Recording Revenue Share](/move/framework/recording-revenue-share/), [Release License](/move/framework/release-license/), [Royalty Grant](/move/framework/royalty-grant/), and [Royalty Advance](/move/framework/royalty-advance/).

## Identifier Resolution

[`@misofm/link`](https://github.com/misofm/link) is a TypeScript Sui client extension, not a Move package. It uses SuiNS leaf subnames to map ISWC codes to composition IDs, ISRC codes to recording IDs, and UPC/GTIN codes to release IDs. It also supports IPI and ISNI codes for party identities. The namespace controller can register, reassign, or remove a link; `resolve` returns the target address without fetching or type-checking the object. See [Miso Link](/move/music-protocol/#miso-link) for the trust boundary.

## Compatibility and Licensing

Each package has its own `Move.toml`, source revision, license, and published package IDs. Read the dependency pins and relevant `Published.toml` records before composing packages. The core is Apache-2.0; other packages may use FSL-1.1-ALv2. Follow each repository's own terms and the [source excerpt licensing guidance](/licensing/).
