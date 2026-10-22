---
title: Share tokens
description: Fixed-supply composition and recording coins, and how holders receive royalties.
---

Every composition and recording has its **own Sui coin type**: `CompositionShare` or `RecordingShare`. Each type represents one work. The core mints exactly **100,000,000 shares with six decimals** (`100_000_000_000_000` base units) and fixes the supply when it creates that work. It returns the whole minted balance to the creator. Shares can then be transferred or placed in stakes according to an agreement.

These are ordinary typed `Coin<T>` / `Balance<T>` values, with their currency setup and fixed supply checked by [`misofm/share`](https://github.com/misofm/share). The work's share coin type is a type parameter of its core object, so code cannot accidentally use a recording's share coin as that composition's share coin.

## Create a work's coin

The [core repository's templates](https://github.com/misofm/music-protocol/tree/main/templates) contain one small package for composition shares and one for recording shares. Publish unchanged template bytecode for each work, initialize its currency using the one-time ticket, then pass the currency and treasury cap to `composition::new` or `recording::new`. The constructor consumes the treasury cap, validates the canonical metadata, mints the supply, and fixes it. Its returned balance is the initial allocation; the core does not decide who ultimately holds it.

Both currencies use 6 decimals. Composition shares use `CSHARE`; recording shares use `RSHARE`. The shared names and symbols do not make the coins interchangeable: their package addresses, and therefore their type identities, differ.

## From shares to payments

A share coin represents a claim **only when a revenue path pays a corresponding pool and the holder registers a stake there**. In [`royalty_pool`](https://github.com/misofm/royalty-pool), `RoyaltyPool<Share, Currency>` receives a payout `Currency` for holders of that `Share` type. A composition or recording can have one canonical pool per payout currency. Holders wrap share balances in `Stake<Share>`, register them, and claim accrued royalties. The pool distributes among **registered** shares; unstaked shares do not accrue there.

A composition's share holders do not automatically receive a cut of all recordings that reference it. The [recording-license package](/docs/packages/recording-license/) can place an agreed cut of recording shares in a stake owned for the composition, then route that stake's recording royalties to the composition pool. This is an extension policy, not an automatic consequence of the core relationship.

The `CompositionAdminCap` and `RecordingAdminCap` are separate bearer objects. They authorize extension writes but are not share coins. A holder can own shares without administrative control, or hold a cap without owning shares.

Source: [music-protocol share coin design](https://github.com/misofm/music-protocol/blob/main/README.md#share-coins), [share package](https://github.com/misofm/share), and [royalty-pool package](https://github.com/misofm/royalty-pool).
