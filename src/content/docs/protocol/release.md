---
title: Release
description: An ordered grouping of recordings, with consent tied to its exact identity.
---

A release groups [recordings](/protocol/recording/) into an ordered track list, such as a single, EP, album, or compilation. The same recording may appear on multiple releases. In the core, `Release` stores its ID and ordered recording IDs; it does not store titles, artwork, prices, or revenue splits.

## Identity and publication

A release contains **1 to 1,000 distinct recordings**. Its ID derives from the shared `ReleaseRegistry`, the ordered recording IDs, and a **32-byte salt**. `release::derive_address` lets an integration calculate the ID before publication. Changing the order or salt produces a different target identity.

Each recording admin supplies [Release Consent](/protocol/releases/) for that exact ID. `release::new` consumes the ordered consents and salt, checks that there are no duplicate recordings and that every consent names the derived release ID, and returns the release and its `ReleaseAdminCap`. Call `release::publish` with that cap in the same transaction. The publication event includes the release ID, admin capability ID, ordered recording IDs, and salt.

## What a release means

The release fixes catalog membership and order. Consent to that membership does not approve a sale price, artwork, distribution agreement, or revenue split. A sales or other commercial package must gather approval for its own terms. The release admin capability authorizes extension writes through `release::uid_mut`; it does not stand in for recording admin consent.

Source: [release module](https://github.com/misofm/music-protocol/blob/main/sources/release.move).
