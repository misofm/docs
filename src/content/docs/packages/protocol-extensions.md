---
title: Overview
description: Optional typed data for compositions, recordings, releases, and parties.
---

Protocol Extensions enrich existing protocol objects with optional typed data. The core objects retain their identities and core relationships; extensions add descriptive fields such as lyrics, credits, artwork, or a Party biography.

Music-object extensions live in [`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions). Party profile and presentation packages live in [`party-protocol-extensions`](https://github.com/misofm/party-protocol-extensions).

## Extension Inventory

| Object | Data Model | Packages |
| --- | --- | --- |
| Composition | Titles, songwriting and publishing credits, lyrics | [Composition Extensions](/packages/protocol-extensions/composition/) |
| Recording | Version labels, performance credits, advisory status, genres, languages | [Recording Extensions](/packages/protocol-extensions/recording/) |
| Release | Titles, artwork, top-line credits, descriptions, genres, release kind | [Release Extensions](/packages/protocol-extensions/release/) |
| Party | Profiles, roles, genres, tags, imagery, external links | [Party Extensions](/packages/protocol-extensions/party/) |

## How Extensions Fit the Core

State-attaching extensions write typed dynamic fields through the object's admin-gated `uid_mut` surface. Reads are permissionless. Each extension owns its field keys, validation, and update rules. Changing one descriptive attribute can therefore leave unrelated data and the core object's identity intact.

Some Party packages construct typed link payloads rather than attaching fields themselves. The [Party extensions page](/packages/protocol-extensions/party/) distinguishes those helpers from the packages that require an admin capability.

Extensions describe objects. [Framework packages](/packages/framework/) define policies and workflows such as recording licenses, royalty distribution, and capability custody. A title or profile field alone does not establish an economic agreement or verify a real-world claim.

## Compatibility and Licensing

Each package has its own dependency pins and published identity. Select compatible source and deployed revisions when combining extensions with their protocol objects or framework packages. Both extension repositories use FSL-1.1-ALv2; follow the applicable source license when reusing code, including excerpts.

Sources: [Music Protocol Extensions](https://github.com/misofm/music-protocol-extensions/blob/main/README.md) and [Party Extensions](https://github.com/misofm/party-protocol-extensions/blob/625b17935dfe818907f44a2dcb4b109e4d43a9f6/README.md).
