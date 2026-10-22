---
title: Composition
description: The written work, its on-chain identity, shares, and extension surface.
---

A composition represents the underlying music and, where present, lyrics. It is the work associated with publishing, separate from any particular [recording](/protocol/recording/) of it. The core `Composition<CompositionShare>` object is deliberately small: it contains an ID and is parameterized by that work's unique share coin type. Titles, writers, lyrics, and other descriptive details live in extension packages.

## Create and publish

First publish a fresh [composition share template](/protocol/shares/#create-a-works-coin) and initialize its currency. With its shared `Currency<CompositionShare>`, owned `TreasuryCap<CompositionShare>`, and the shared `CompositionRegistry`, a calling Move module can create and publish the work:

```move
use sui::coin::{Self, Coin, TreasuryCap};
use sui::coin_registry::Currency;
use miso_music::composition::{Self, CompositionAdminCap, CompositionRegistry};

public fun create_composition<CompositionShare: key>(
    registry: &mut CompositionRegistry,
    currency: &mut Currency<CompositionShare>,
    treasury_cap: TreasuryCap<CompositionShare>,
    ctx: &mut TxContext,
): (CompositionAdminCap<CompositionShare>, Coin<CompositionShare>) {
    let predicted_id = composition::derive_address<CompositionShare>(registry);
    let (composition, admin_cap, shares) =
        composition::new(registry, currency, treasury_cap);
    assert!(object::id(&composition).to_address() == predicted_id, 0);

    composition.publish(&admin_cap);
    (admin_cap, coin::from_balance(shares, ctx))
}
```

This function is an excerpt for a module that already depends on `miso_music`; the template publication and currency initialization happen earlier. `new` validates the share currency, mints and fixes its supply, and returns the full balance. The function returns both assets so the caller can transfer, allocate, or custody them. `publish` shares the composition and emits `CompositionPublishedEvent` with the composition and admin capability IDs. The derived address can be calculated before creation; it does not prove the work already exists.

If `new` aborts, check that the currency has the template's exact type and metadata, locked metadata, zero prior supply, and its matching treasury cap. The [share coin requirements](/protocol/shares/#create-a-works-coin) list those checks.

## Control and extensions

The admin capability authorizes `composition::uid_mut`, which extension packages use to attach dynamic fields. Holding composition [shares](/protocol/shares/) does not grant that capability. The core does not assign writers, set publishing terms, or open a royalty pool; an integration must use the relevant extension and payment packages for those behaviors.

One composition can have multiple recordings. A recording stores the composition ID when it is created, but that relationship alone does not prove permission to record or distribute the work. See [Recording](/protocol/recording/) and [Recording Licenses](/packages/recording-license/).

Source: pinned [composition module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/composition.move) and [production constructor test](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/tests/production_constructor_tests.move).
