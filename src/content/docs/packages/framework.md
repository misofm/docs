---
title: Framework
description: Reusable Move packages for business rules, payments, administration, and commerce around Miso music objects.
---

The Miso Framework is the collection of reusable Move packages that define business logic around the music protocol: how recording terms are agreed, royalties are distributed, capabilities are held, and music is sold or streamed.

The [protocol](/protocol/overview/) supplies stable identities and relationships. [Protocol Extensions](/packages/protocol-extensions/) enrich their data model. Framework packages use those objects to define particular policies and workflows. Products choose the packages they need; a core relationship alone does not activate an economic arrangement.

For example, a recording can point to a composition in core, carry artist credits through an extension, and participate in a licensing and royalty arrangement through framework packages. Those are separate responsibilities even when a product combines them in one user flow.

## Rights and Payments

| Package | Role |
| --- | --- |
| [`recording-license`](https://github.com/misofm/recording-license) | Optional standing policy and a recording-share stake representing the composition's agreed cut. [Read the guide](/packages/recording-license/). |
| [`royalty-pool`](https://github.com/misofm/royalty-pool) | One derived pool per work and payout currency; registered share stakes receive royalties. [Read the guide](/packages/royalty-pool/). |
| [`release-revenue-forwarder`](https://github.com/misofm/release-revenue-forwarder) | Release-to-recording payout forwarding. Check its pinned core version and split policy before use. |
| [`pay`](https://github.com/misofm/pay) | Typed payments to compositions, recordings, or releases with receipt events. |
| [`crank`](https://github.com/misofm/crank) | Processes record-sale revenue into claimable royalties. |
| [`streaming`](https://github.com/misofm/streaming) | Prepaid streaming and settlement contracts, with an SDK and example app. |

## Administration, Commerce, and Supporting Types

[Party identities](/protocol/party/) and their [profile extensions](/packages/protocol-extensions/party/) belong to the Protocol and Protocol Extensions sections. The framework builds workflows around those identities.

| Package | Role |
| --- | --- |
| [`credit`](https://github.com/misofm/credit) | Shared credit data type used by attribution extensions. |
| [`vault`](https://github.com/misofm/vault), [`vault-plugins`](https://github.com/misofm/vault-plugins), and [`party-protocol-actions`](https://github.com/misofm/party-protocol-actions) | Capability custody and composed administrative workflows. |
| [`record`](https://github.com/misofm/record) and [`record-extensions`](https://github.com/misofm/record-extensions) | Numbered editions and purchased Records, plus first-party extensions. |
| [`record-shop`](https://github.com/misofm/record-shop) | Fixed or floor price Record listings and purchases. |
| [`release-track-data`](https://github.com/misofm/release-track-data) | Data aligned to a release's track list. |
| [`release-track-iterator`](https://github.com/misofm/release-track-iterator) | Iteration over the release track list for composition in Move. |
| [`genre`](https://github.com/misofm/genre) and [`cover-art`](https://github.com/misofm/cover-art) | Reusable genre vocabulary and artwork primitives. |

## Compatibility and Licensing

Each repository has its own dependency pins, license, and published package identities. This inventory does not imply that all main-branch revisions or deployed generations compose with one another. Verify the relevant revisions and network records before constructing transactions.

Several framework packages use FSL-1.1-ALv2. Follow each source repository's license; the docs' Apache license does not relicense copied contract source. See [Licensing](/licensing/).

Sources: the package repositories linked above.
