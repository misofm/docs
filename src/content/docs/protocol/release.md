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

For a **single-track release** where the caller has that recording's admin cap, the Move calls look like this:

```move
use miso_music::recording::{Recording, RecordingAdminCap};
use miso_music::release::{Self, ReleaseAdminCap, ReleaseRegistry};

public fun publish_single<RecordingShare>(
    registry: &mut ReleaseRegistry,
    recording: &Recording<RecordingShare>,
    recording_cap: &RecordingAdminCap<RecordingShare>,
    salt: vector<u8>,
): ReleaseAdminCap {
    let recording_ids = vector[object::id(recording)];
    let target = release::derive_address(registry, recording_ids, copy salt).to_id();
    let consent = release::consent(recording, recording_cap, target);
    let (release, release_cap) = release::new(registry, vector[consent], salt);
    release.publish(&release_cap);
    release_cap
}
```

Supply exactly 32 salt bytes. This example keeps derivation, consent, and publication in one call; a multi-admin release must collect the separate `ReleaseConsent` values before assembly. The returned release cap needs to be transferred or held by the calling application.

The constructor consumes the consents, rejects duplicate recordings, and checks that every consent targets the derived release ID. A consent has `store` and `drop`, so an extension can wrap it for offers or escrow; it has no `copy`. Publication emits `ReleasePublishedEvent` with the release ID, admin capability ID, ordered recording IDs, and salt. Join each recording ID to its `RecordingPublishedEvent` to find the composition.

Consent covers **membership and order**. It does not approve track revenue splits, artwork, titles, or sale terms. A sales or distribution package must gather approval for its own terms. The `ReleaseAdminCap` authorizes extension writes through `release::uid_mut`; it does not replace consent from recording admins.

Source: pinned [release module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/release.move), [end-to-end test](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/tests/release_e2e_tests.move), and [protocol README](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/README.md#release-consent).
