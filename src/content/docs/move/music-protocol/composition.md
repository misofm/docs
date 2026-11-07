---
title: Composition
description: The underlying song as an object with its own identity, share type, and admin cap.
---

A composition is the underlying music and any lyrics, the work associated with publishing. It gives that work an identity independent of any [recording](/move/music-protocol/recording/).

In the [overview's example](/move/music-protocol/), “I Will Always Love You” is one composition. Dolly Parton's original and Whitney Houston's cover are separate masters of it. Both refer to the composition without sharing recording ownership, credits, or commercial terms.

## One identity for the work

`Composition<CompositionShare>` holds only an object ID. Its type parameter names the work's unique [share type](#composition-shares). Titles, writers, and lyrics stay outside the core: retitling or correcting a credit must not create a different work.

```move
public struct Composition<phantom CompositionShare> has key {
    id: UID,
}
```

`phantom CompositionShare` ties the object to a share type without storing a balance.

Within a package's registry, the composition ID derives from its share type, so the work and its shares have a verifiable association. A derived address predicts where the object belongs. Only the published object and its history show that it exists.

## Composition Shares

Each composition has a unique `CompositionShare` type and a fixed supply of **100,000,000 shares with six decimals**, held as `Coin<CompositionShare>` or `Balance<CompositionShare>`. Two compositions can share a name and symbol, but their types differ by package address, so their shares stay distinct.

Constants:

```move
const SHARE_DECIMALS: u8 = 6;
const SHARE_SYMBOL: vector<u8> = b"CSHARE";
const SHARE_NAME: vector<u8> = b"Composition Share";
const SHARE_SUPPLY: u64 = 100_000_000_000_000;
```

At creation, core validates the currency, mints the full supply, and consumes the minting authority. The creator receives the initial balance. Allocations divide that supply and never mint more. Allocation agreements and custody belong to applications and extensions.

Composition shares join a funded [royalty pool](/move/framework/royalty-pool/) through registered stakes. The recording link routes no recording royalties to them. A [recording revenue share](/move/framework/recording-revenue-share/) or other agreement does.

## One composition, many recordings

A composition keeps no list of its recordings. Each recording stores the composition's ID, so new studio versions, live takes, and covers refer to the work without changing it.

The reference says which work was recorded, not that recording it was permitted. Permission comes from an agreement outside core. A [recording revenue share](/move/framework/recording-revenue-share/) is a voluntary payment to holders, not a copyright license.

## Administration and shares

`CompositionAdminCap` controls the extension surface: titles, credits, lyrics, and other data. It is a transferable bearer object, so custody decides who holds the authority.

Mutable UID access requires the matching cap:

```move
public fun uid_mut<CompositionShare>(
    self: &mut Composition<CompositionShare>,
    _: &CompositionAdminCap<CompositionShare>,
): &mut UID {
    &mut self.id
}
```

The cap's type supplies the authorization. There is one composition per share type in the registry, and the cap's ID derives from the composition, so each composition has exactly one admin cap. Extensions attach typed dynamic fields through this UID. The admin also presents the cap to publish [revenue share terms](/move/framework/recording-revenue-share/) or create [royalty pools](/move/framework/royalty-pool/).

Shares and the cap are independent: shares grant no admin capability, and the cap implies no shares. [Royalty pools](/move/framework/royalty-pool/) and other economic packages define payouts.

## A small core, richer extensions

`composition::new` emits `CompositionCreatedEvent` with the composition and admin cap IDs. The creating transaction calls `composition.share()` to share it. `share` takes no capability and emits nothing. Identity and share type stay fixed. Authorized [extensions](/move/framework/#composition-extensions) hold descriptive and economic data. Apply each extension's rules to its metadata and rights claims.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

Source: [composition module](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/composition.move) and [protocol design](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md).
