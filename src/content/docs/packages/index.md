---
title: Overview
description: How the core protocol, data-model extensions, and business-logic framework fit together.
---

Miso separates music and party identities, optional data, and business rules into small Sui Move packages. This lets products share the same composition, recording, release, and party identities while choosing the data and workflows they need.

| Layer | Responsibility | Start Here |
| --- | --- | --- |
| Protocol: Party | Entity identities, names, and capability-controlled administration | [Party](/protocol/party/) |
| Protocol: Music | Core identity, share types, composition relationships, and release consent | [Protocol Overview](/protocol/overview/) |
| Protocol Extensions | Optional data on compositions, recordings, releases, and parties | [Protocol Extensions](/packages/protocol-extensions/) |
| Framework | Business rules and workflows for royalties, licensing, administration, payments, and commerce | [Framework](/packages/framework/) |

The core also depends on [`share`](https://github.com/misofm/share) to validate each work's canonical share type and fix its supply. This supports the core's ownership model.

## Protocol Extensions

<span id="metadata-extensions"></span>

[`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions) extends Composition, Recording, and Release. [`party-protocol-extensions`](https://github.com/misofm/party-protocol-extensions) adds optional group relations and profile data to Party identities. Each state-attaching extension adds one data concern around its core object. Browse the [extension inventory](/packages/protocol-extensions/#extension-inventory) by object.

## Framework

Framework packages define what applications can do with those objects: agree recording terms, distribute royalties, manage administrative capabilities, or sell and stream music. Start with [Royalty Pools](/packages/royalty-pool/) or [Recording Licenses](/packages/recording-license/), or browse the [Framework overview](/packages/framework/) for the other packages.

## Identifier Resolution

[`@misofm/link`](https://github.com/misofm/link) is a TypeScript Sui client extension, not a Move package. It uses SuiNS leaf subnames to map ISWC codes to composition IDs, ISRC codes to recording IDs, and UPC/GTIN codes to release IDs. It also supports IPI and ISNI codes for party identities. The namespace controller can register, reassign, or remove a link; `resolve` returns the target address without fetching or type-checking the object. See [Miso Link](/protocol/overview/#miso-link) for the trust boundary.

## Compatibility and Licensing

Each repository has its own `Move.toml`, source revision, license, and published package IDs. Read the dependency pins and relevant `Published.toml` records before composing packages. The core is Apache-2.0; other packages may use FSL-1.1-ALv2. Follow each repository's own terms and the [source excerpt licensing guidance](/licensing/).
