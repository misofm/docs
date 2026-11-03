---
title: Royalty Pool
description: Distribute a payout currency to registered holders of shares in a composition or recording.
---

This page is for developers who route revenue to a work's shareholders. It explains how `royalty_pool` turns a work's fixed-supply shares into a claim on one payout currency, the order in which to set a pool up, and where funds can wait or be lost.

## One Pool per Work and Currency

Whitney Houston's recording of "I Will Always Love You" has its own `RecordingShare` type. To pay its holders in a currency, the recording admin creates the recording's pool for that currency. Every revenue stream for the recording in that currency (sales, streams, merchandise) pays holders through the same pool.

```move
public struct RoyaltyPool<phantom Share, phantom Currency> has key {
    id: UID,
    balance: Balance<Currency>,
    staked_shares: u64,
    cumulative_royalty_per_share: u256,
    carry: u128,
    last_settled_at_ms: u64,
}
```

`Share` is the work's own share type and `Currency` is the payout currency. The pool keeps a cumulative royalty-per-share index rather than a list of holders, so neither a deposit nor a claim loops over holders. `carry` holds rounding remainders so that no deposited value is lost.

The pool's ID is derived from the work, so each work has at most one canonical pool per currency in this package generation. Creation takes the work and its admin cap:

```move
public fun new_for_composition<CompositionShare, Currency>(
    composition: &mut Composition<CompositionShare>,
    cap: &CompositionAdminCap<CompositionShare>,
): RoyaltyPool<CompositionShare, Currency> {
    new(composition.uid_mut(cap))
}
```

`new_for_recording` is the same for a `Recording` and its `RecordingAdminCap`. Passing the work fixes `Share` to that work's share type, and the derivation key is private to the package, so no other package can create a pool at these addresses. Creating a second pool for the same work and currency aborts with `derived_object::EObjectAlreadyExists`. Both return the pool **unshared**.

## Stakes

Shares are ordinary coins and can move freely, so the pool cannot pay holders it does not know about. A holder wraps a positive `Balance<Share>` in a stake and registers that stake with the pool:

```move
public struct RoyaltyPoolStake<phantom Share> has key, store {
    id: UID,
    balance: Balance<Share>,
    registrations: VecMap<ID, u256>,
}
```

`royalty_pool_stake::new(balance, ctx)` creates a stake, and `royalty_pool_stake::destroy` returns the balance once every registration is removed. `registrations` maps each pool ID to that registration's accounting debt, so one stake can register in the pools of several currencies for the same work, but only once in each.

**Only registered stakes earn.** Each deposit is divided among the shares registered when it is folded in. Unregistered shares earn nothing, and their portion goes to the registered stakes, so revenue is never stranded. This applies to every holder, including a stake held by a [recording license](/move/framework/recording-license/).

A stake is a bearer claim: anyone with `&mut RoyaltyPoolStake` can claim its royalties. Keep stakes address-owned, or wrap them in a module that gates access, as a [royalty grant](/move/framework/royalty-grant/) does. A shared or carelessly wrapped stake can be drained.

## Setting Up a Pool

These steps run in one programmable transaction, so no revenue can arrive between them:

1. Call `royalty_pool::new_for_recording` or `royalty_pool::new_for_composition` for each payout currency the work will accept.
2. Wrap the work's shares with `royalty_pool_stake::new` and call `royalty_pool::register_stake` for every known holder, including any license stake.
3. Call `royalty_pool::share` on each pool.
4. Send each stake to its holder.

Funds sent to the pool's address before step 3 are settled to the stakes registered at the first settle, not to whoever registers first afterwards. The contracts do not enforce this order; Miso's publishing tools do. Revenue is paid to the canonical address returned by `derive_recording_pool_address<RecordingShare, Currency>(recording)` or `derive_composition_pool_address<CompositionShare, Currency>(composition)`. `derive_release_recording_pool_addresses<Currency>(release)` returns one recording-pool address per track, in track-list order.

## Depositing, Settling, and Claiming

Revenue reaches a pool in one of two ways:

- `deposit(pool, balance)` folds a `Balance<Currency>` in directly. It aborts with `ENoStakedShares` while no shares are registered; a zero deposit is a no-op.
- Funds sent to the pool's address wait there until someone calls `settle(pool, root, clock)`, passing the system `AccumulatorRoot` at `0xacc` and the `Clock` at `0x6`. `receive_coins` turns `Coin<Currency>` objects sent to the address into funds that a later `settle` can fold in.

The start of `settle` (excerpt; the rest folds the redeemed funds into the index and returns their value):

```move
public fun settle<Share, Currency>(
    self: &mut RoyaltyPool<Share, Currency>,
    root: &AccumulatorRoot,
    clock: &Clock,
): u64 {
    let now = clock.timestamp_ms();
    if (now == self.last_settled_at_ms) return 0;
    self.last_settled_at_ms = now;
    if (self.staked_shares == 0) return 0;
    let funds = hikida::redeem_settled_balance<Currency>(&mut self.id, root);
```

`settle` redeems at most once per clock timestamp. A second accumulator withdrawal from the same address in the same consensus commit would fail the whole transaction, so this guard keeps a frequent settler from breaking other callers' registrations. While no shares are registered, funds stay at the address and go to the stakes registered at the next settle. A funded `settle` needs the network's `enable_object_funds_withdraw` protocol feature.

`register_stake` and `unregister_stake` settle first, so waiting funds go to the stakes that were registered while they arrived. `claim_royalties(pool, stake)` returns the stake's royalties as a `Balance<Currency>` but does not settle; call `settle` first to include the latest funds. `unregister_stake` returns everything the stake can still claim, so no separate claim is needed before leaving.

## Failure Cases

| Situation | Result |
| --- | --- |
| `deposit` of a positive amount while no shares are registered | Aborts with `ENoStakedShares` (0). |
| Registering a stake that is already registered in this pool | Aborts with `EStakeAlreadyRegistered` (1). |
| Claiming or unregistering a stake that is not registered in this pool | Aborts with `ERegistrationNotFound` (2). |
| `royalty_pool_stake::new` with a zero balance | Aborts with `EZeroBalance` (0). |
| `royalty_pool_stake::destroy` while registered anywhere | Aborts with `EPoolsRegistered` (1). |
| Coins in another currency, or funds sent to an ID that is not a work | Unrecoverable. `settle` and `receive_coins` handle only the pool's own `Currency`. |

## Events

| Event | Fields |
| --- | --- |
| `RoyaltyPoolCreatedEvent<Share, Currency>` | `pool_id`, `work_id` |
| `RoyaltyPoolStakeRegisteredEvent<Currency>` | `pool_id`, `stake_id`, `shares`, `staked_shares` |
| `RoyaltyDepositedEvent<Currency>` | `pool_id`, `value`, `balance`, `cumulative_royalty_per_share` |
| `RoyaltyClaimedEvent<Currency>` | `pool_id`, `stake_id`, `value`, `balance` |
| `RoyaltyPoolStakeUnregisteredEvent<Currency>` | `pool_id`, `stake_id`, `shares`, `value`, `balance`, `staked_shares` |
| `RoyaltyPoolStakeCreatedEvent<Share>` / `RoyaltyPoolStakeDestroyedEvent<Share>` | `stake_id`, `shares` |

A positive `settle` emits `RoyaltyDepositedEvent`, including the settle inside a registration change. Claims emit only for positive amounts. The README shows how an indexer rebuilds every pool and stake from these events alone.

## What a Pool Does Not Do

Pool accounting does not make sales or streams pay into the pool. A [release license](/move/framework/release-license/), a store such as `record_shop`, or another payer must send revenue to the canonical address in the pool's currency. Nor does a pool decide who holds shares: the work's creator receives the full supply, and allocation is up to the product.

The recorded mainnet deployment of this package predates the module rename: its modules are `royalty_pool::pool` and `royalty_pool::stake`, its stake type is `Stake<Share>`, and some event names differ. Use the API of the generation deployed on your network; see [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool/README.md), [`royalty_pool` module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool/sources/royalty_pool.move), [`royalty_pool_stake` module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool/sources/royalty_pool_stake.move), and [tests](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool/tests).
