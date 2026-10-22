---
title: Release
description: An ordered grouping of recordings, with consent tied to its exact identity.
---

A release groups [recordings](/protocol/recording/) into an ordered track list, such as a single, EP, album, or compilation. The same recording may appear on multiple releases. In the core, `Release` stores its ID and ordered recording IDs; titles, artwork, prices, and revenue splits belong to extensions.

## Identity

A release contains **1 to 1,000 distinct recordings**. Its ID derives from the shared `ReleaseRegistry`, the ordered recording IDs, and a **32-byte salt**. `release::derive_address` lets an integration calculate the ID before creation. Changing the order or salt produces a different target identity. The identity digest uses `blake2b256(bcs(recording_ids) || bcs(salt))`, whose derived address under the registry becomes the release ID.

## Release Consent

Before assembling a release, obtain consent from the admin of every recording in its exact track list and order:

1. Choose the ordered recording IDs and a 32-byte salt.
2. Call `release::derive_address` with the registry, IDs, and salt to predict the release ID.
3. Each recording admin calls `release::consent(&recording, &recording_cap, release_id)` and supplies the resulting `ReleaseConsent` to the assembly transaction.
4. Call `release::new(&mut registry, consents, salt)`, then `release.publish(&release_cap)` in the same transaction.

The constructor consumes the consents, rejects duplicate recordings, and checks that every consent targets the derived release ID. A consent has `store` and `drop`, so an extension can wrap it for offers or escrow; it has no `copy`. Publication emits `ReleasePublishedEvent` with the release ID, admin capability ID, ordered recording IDs, and salt. Join each recording ID to its `RecordingPublishedEvent` to find the composition.

Consent covers **membership and order**. It does not approve track revenue splits, artwork, titles, or sale terms. A sales or distribution package must gather approval for its own terms. The `ReleaseAdminCap` authorizes extension writes through `release::uid_mut`; it does not replace consent from recording admins.

Source: [release module](https://github.com/misofm/music-protocol/blob/main/sources/release.move) and [protocol README](https://github.com/misofm/music-protocol/blob/main/README.md#release-consent).
