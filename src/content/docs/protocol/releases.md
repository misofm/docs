---
title: Release consent
description: How recording admins authorize an exact release membership and order.
---

A `Release` is an ordered vector of recording IDs. It may include **1 to 1,000 distinct recordings**. Its ID is derived under the shared `ReleaseRegistry` from the ordered IDs and a **32-byte salt**. The creator can calculate this ID before creating the release and ask each recording admin for consent to that exact target.

1. Choose the ordered recording IDs and a 32-byte salt.
2. Call `release::derive_address` with the registry, IDs, and salt to predict the release ID.
3. Each recording admin calls `release::consent(&recording, &recording_cap, release_id)` and supplies the resulting `ReleaseConsent` to the assembly transaction.
4. Call `release::new(&mut registry, consents, salt)`, then `release.publish(&release_cap)` in the same transaction.

The constructor consumes the consents, rejects duplicates, and checks that every consent targets its derived release ID. A consent has `store` and `drop`, allowing an extension to wrap it for offers or escrow. It has no `copy`.

Consent covers **membership and order**. It does not commit to track revenue splits, artwork, titles, or sale terms. A pressing or other sales package that splits release revenue must collect its own consent for those terms. Applications should not present release consent as agreement to an economic split.

The release event contains its ID, admin cap ID, ordered recording IDs, and salt. Join each recording ID to its `RecordingPublishedEvent` to find the composition. The identity digest uses `blake2b256(bcs(recording_ids) || bcs(salt))`; the release ID is the derived address of that digest under `ReleaseRegistry`.

Source: [release module](https://github.com/misofm/music-protocol/blob/main/sources/release.move) and [protocol README](https://github.com/misofm/music-protocol/blob/main/README.md#release-consent).
