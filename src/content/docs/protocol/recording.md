---
title: Recording
description: A particular master, its composition relationship, shares, and permissions.
---

A recording represents a particular fixed performance and production of a [composition](/protocol/composition/): a master. A studio version, live take, or cover can each be a separate recording of the same composition. The core `Recording<RecordingShare>` stores its own ID and an immutable `composition_id`. It does not contain audio, credits, version metadata, or license terms; those belong to extensions.

## Create and publish

Each recording uses its own [recording share coin](/protocol/shares/#create-a-works-coin). Once its currency is initialized, a Move module can create a recording from an immutable composition reference:

```move
use sui::coin::{Self, Coin, TreasuryCap};
use sui::coin_registry::Currency;
use miso_music::composition::Composition;
use miso_music::recording::{Self, RecordingAdminCap, RecordingRegistry};

public fun create_recording<RecordingShare: key, CompositionShare>(
    registry: &mut RecordingRegistry,
    currency: &mut Currency<RecordingShare>,
    treasury_cap: TreasuryCap<RecordingShare>,
    composition: &Composition<CompositionShare>,
    ctx: &mut TxContext,
): (RecordingAdminCap<RecordingShare>, Coin<RecordingShare>) {
    let (recording, admin_cap, shares) =
        recording::new(registry, currency, treasury_cap, composition);
    assert!(recording.composition_id() == object::id(composition), 0);

    recording.publish(&admin_cap);
    (admin_cap, coin::from_balance(shares, ctx))
}
```

The composition is only borrowed, so creating another recording does not mutate it. The function returns the recording admin capability and the full fixed-supply share coin for the caller to route. `recording::derive_address<RecordingShare>` predicts the recording ID from the registry and share type, while `recording::composition_id` reads the immutable relationship. Publishing emits `RecordingPublishedEvent` with the recording, composition, and admin capability IDs.

If `new` aborts, check the recording template's exact type and metadata, locked metadata, zero prior supply, and matching treasury cap. It enforces the same [share coin requirements](/protocol/shares/#create-a-works-coin) as composition creation.

## Rights and release participation

The composition reference fixes a relationship, not a license. The core lets a caller create a recording that points to a composition without checking recording rights. An application that requires authorization should check a recognized [recording license](/packages/recording-license/) or another agreement.

The recording admin capability controls extension writes and can issue [Release Consent](/protocol/release/#release-consent) for a particular release. It is separate from [recording shares](/protocol/shares/), which express fractional economic ownership through the packages that receive and distribute revenue. A [release](/protocol/release/) can include the recording only with consent for its exact release ID.

Source: pinned [recording module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/recording.move) and [production constructor test](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/tests/production_constructor_tests.move).
