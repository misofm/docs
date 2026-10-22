---
title: Shares
description: Fixed-supply composition and recording share types, and how holders receive royalties.
---

Every composition and recording has its **own share type**: `CompositionShare` or `RecordingShare`. Each type represents one work. The core mints exactly **100,000,000 shares with six decimals** (`100_000_000_000_000` base units) and fixes the supply when it creates that work. It returns the whole minted balance to the creator. Shares can then be transferred or placed in stakes according to an agreement.

Shares are held as typed `Coin<T>` / `Balance<T>` values, with their currency setup and fixed supply checked by [`misofm/share`](https://github.com/misofm/share). The work's share type is a type parameter of its core object, so code cannot accidentally substitute recording shares for composition shares.

## One share type per work

Each work uses a fresh copy of the relevant share template. Composition shares use the name `Composition Share` and symbol `CSHARE`; recording shares use `Recording Share` and `RSHARE`. The names and symbols are shared conventions, but the package addresses differ, giving each work a distinct share type.

The protocol ties that share type to one work and validates its currency when the work is created. It requires the canonical metadata, zero prior supply, and an unregulated currency, then consumes the minting authority and fixes the full supply. The resulting work object therefore establishes that its share currency passed those checks. Later allocations divide the existing supply rather than creating more shares.

The composition contract fixes its currency conventions in constants:

```move
const SHARE_DECIMALS: u8 = 6;
const SHARE_SYMBOL: vector<u8> = b"CSHARE";
const SHARE_NAME: vector<u8> = b"Composition Share";
const SHARE_SUPPLY: u64 = 100_000_000_000_000;
```

The recording contract uses the same decimals and supply with `RSHARE` and `Recording Share`. At six decimals, `100_000_000_000_000` base units represent 100 million shares; the supply is defined by the protocol rather than by each application.

This keeps the core independent of any particular allocation agreement. The creator receives the initial balance; extensions and applications decide how it is split, held, or staked.

## From shares to payments

Shares accrue royalties **only when a revenue path pays a corresponding pool and the holder registers a stake there**. In [`royalty_pool`](https://github.com/misofm/royalty-pool), `RoyaltyPool<Share, Currency>` receives a payout `Currency` for holders of that `Share` type. A composition or recording can have one canonical pool per payout currency. Holders wrap share balances in `Stake<Share>`, register them, and claim accrued royalties. The pool distributes among **registered** shares; unstaked shares do not accrue there.

A composition's share holders do not automatically receive a cut of all recordings that reference it. The [recording-license package](/packages/recording-license/) can place an agreed cut of recording shares in a stake owned for the composition, then route that stake's recording royalties to the composition pool. This is an extension policy, not an automatic consequence of the core relationship.

## Ownership and administration

The `CompositionAdminCap` and `RecordingAdminCap` are separate bearer objects. They authorize extension writes and are separate from shares. A holder can own shares without administrative control, or hold a cap without owning shares.

Source: [composition constants](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/composition.move), [recording constants](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/recording.move), [music-protocol share type design](https://github.com/misofm/music-protocol/blob/main/README.md#share-coins), [share package](https://github.com/misofm/share), and [royalty-pool package](https://github.com/misofm/royalty-pool).
