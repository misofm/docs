---
title: Overview
description: How the core protocols, extensions, and framework fit together.
---

Miso splits music and party identities, optional data, and business rules into small Sui Move packages. Products share the same identities and pick only the data and workflows they need.

| Layer | Responsibility | Start Here |
| --- | --- | --- |
| Protocol: Party | Entity identities and capability-controlled administration | [Party](/move/party-protocol/) |
| Protocol: Music | Core identity, share types, composition relationships, and ordered releases | [Protocol Overview](/move/music-protocol/) |
| Framework | Optional data extensions for works and Parties, royalty pools, recording revenue shares, release licenses, grants and advances, Record sales, the Player, and shared libraries | [Framework](/move/framework/) |

The core depends on [`share`](https://github.com/unconfirmedlabs/share) to validate each work's canonical share type and fix its supply.

## Framework

Every package in [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7) has its own page under Framework.

- **Extensions** attach optional data: titles, credits, lyrics, and genres on compositions, recordings, and releases, and a name, profile, genres, and group membership on a Party.
- **Other packages** act on the objects: share a recording's revenue with its composition, license releases, distribute royalties, advance money against them, sell Records, hold capabilities.

Start with the [Framework overview](/move/framework/), which lists [extensions](/move/framework/#how-extensions-work) by object and traces a sale from release to shareholders. Then read [Royalty Pool](/move/framework/royalty-pool/), [Recording Revenue Share](/move/framework/recording-revenue-share/), [Release License](/move/framework/release-license/), [Royalty Grant](/move/framework/royalty-grant/), and [Royalty Advance](/move/framework/royalty-advance/).

## Identifier Resolution

[`@misofm/link`](https://github.com/misofm/link) is a TypeScript Sui client extension, not a Move package. It uses SuiNS leaf subnames to map ISWC codes to composition IDs, ISRC to recording IDs, and UPC/GTIN to release IDs. IPI and ISNI codes map to party identities. The namespace controller can register, reassign, or remove a link. `resolve` returns the target address without fetching or type-checking the object. See [Miso Link](/move/music-protocol/#miso-link) for the trust boundary.

## Compatibility and Licensing

Each package has its own `Move.toml`, source revision, license, and published package IDs. Read dependency pins and `Published.toml` records before composing packages. The core is Apache-2.0. Other packages may use FSL-1.1-ALv2. Follow each repository's terms and the [source excerpt licensing guidance](/licensing/).
