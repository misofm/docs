---
title: Royalty Pool
description: Pay a payout currency to registered holders of shares in a composition or recording.
---

`royalty_pool` turns a work's fixed-supply shares into a claim on one payout currency. Use it to route revenue to shareholders. Follow the setup order below, or funds can wait or be lost.

## One Pool per Work and Currency

Whitney Houston's recording of "I Will Always Love You" has its own `RecordingShare` type. Its admin creates one pool per payout currency. Every revenue stream in that currency (sales, streams, merchandise) pays holders through it.

```move
public struct RoyaltyPool<phantom Share, phantom Currency> has key {
    id: UID,
    balance: Balance<Currency>,
    staked_shares: u64,
    cumulative_royalty_per_share: u256,
    remainder: u128,
    last_settled_at_ms: u64,
}
```

`Share` is the work's share type, `Currency` the payout currency. The pool keeps a cumulative royalty-per-share index, not a holder list, so deposit and claim never loop over holders. `remainder` holds scaled amounts not yet in the index: each deposit's rounding and each unregistering stake's sub-base-unit leftover. A later deposit folds it in, so no value is lost. The invariant `balance · PRECISION == Σ(shares · index − debt) + remainder`, with `PRECISION = 10^18`, means the pool never owes more than it holds.

The pool's ID derives from the work: at most one canonical pool per work and currency in this package generation. Creation takes the work and its admin cap:

```move
public fun new_for_composition<CompositionShare, Currency>(
    composition: &mut Composition<CompositionShare>,
    cap: &CompositionAdminCap<CompositionShare>,
): RoyaltyPool<CompositionShare, Currency> {
    new(composition.uid_mut(cap))
}
```

`new_for_recording` does the same for a `Recording` and its `RecordingAdminCap`. Passing the work fixes `Share`. The derivation key is private, so no other package can create a pool at these addresses. A second pool for the same work and currency aborts with `derived_object::EObjectAlreadyExists`. Both return the pool **unshared**.

## Stakes

Shares are ordinary coins, so the pool cannot pay holders it does not know. A holder wraps a positive `Balance<Share>` in a stake and registers it:

```move
public struct RoyaltyPoolStake<phantom Share> has key, store {
    id: UID,
    balance: Balance<Share>,
    registrations: VecMap<ID, u256>,
}
```

`royalty_pool_stake::new(balance, ctx)` creates a stake. `royalty_pool_stake::destroy` returns the balance once every registration is removed. `registrations` maps each pool ID to its accounting debt. One stake can register once in each pool of a work, across currencies.

**Only registered stakes earn.** Each deposit splits among the shares registered when it is folded in. Unregistered shares earn nothing. Their portion goes to registered stakes, so revenue is never stranded. This includes the composition's stake held by a [recording revenue share](/move/framework/recording-revenue-share/).

A stake is a bearer claim: anyone with `&mut RoyaltyPoolStake` can claim its royalties. Keep stakes address-owned, or wrap them in a module that gates access, as a [royalty grant](/move/framework/royalty-grant/) does. A shared or carelessly wrapped stake can be drained.

## Setting Up a Pool

Run these steps in one programmable transaction so no revenue arrives between them:

1. Call `royalty_pool::new_for_recording` or `royalty_pool::new_for_composition` for each payout currency.
2. Wrap the work's shares with `royalty_pool_stake::new` and call `royalty_pool::register_stake` for every known holder, including the composition's stake from a recording revenue share.
3. Call `royalty_pool::share` on each pool.
4. Send each stake to its holder.

Funds sent to the pool's address before step 3 settle to the stakes registered at the first settle, not to whoever registers afterwards. The contracts do not enforce this order. Miso's publishing tools do. Pay revenue to `derive_recording_pool_address<RecordingShare, Currency>(recording)` or `derive_composition_pool_address<CompositionShare, Currency>(composition)`. `derive_release_recording_pool_addresses<Currency>(release)` returns one recording-pool address per track, in track-list order.

## Depositing, Settling, and Claiming

Revenue reaches a pool two ways:

- `deposit(pool, balance)` folds a `Balance<Currency>` in directly. It aborts with `ENoStakedShares` while no shares are registered. A zero deposit is a no-op.
- Funds sent to the pool's address wait until someone calls `settle(pool, root, clock)` with the system `AccumulatorRoot` at `0xacc` and the `Clock` at `0x6`. `receive_coins` turns `Coin<Currency>` objects sent to the address into funds a later `settle` can fold in.

Start of `settle` (excerpt; the rest folds the redeemed funds into the index and returns their value):

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

`settle` redeems at most once per clock timestamp. A second accumulator withdrawal from the same address in the same consensus commit fails the whole transaction with an uncatchable abort in `funds_accumulator::reserve_object_funds_for_withdrawal` (code 5). The guard stops a frequent settler from breaking other callers' registrations. While no shares are registered, funds stay at the address and go to the stakes registered at the next settle. A funded `settle` needs the `enable_object_funds_withdraw` protocol feature.

`register_stake` and `unregister_stake` settle first, so waiting funds go to the stakes registered when they arrived. `claim_royalties(pool, stake)` returns the stake's royalties as a `Balance<Currency>` without settling. Call `settle` first for the latest funds. `unregister_stake` returns everything the stake can still claim, so no prior claim is needed. Its sub-base-unit leftover stays in `remainder` for the next deposit.

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

A positive `settle`, including one inside a registration change, emits `RoyaltyDepositedEvent`. Claims emit only for positive amounts. The README shows how an indexer rebuilds every pool and stake from events.

## What a Pool Does Not Do

A pool does not make revenue arrive. A [release license](/move/framework/release-license/), a store such as [`record_sale`](/move/framework/record-sale/), or another payer must send it to the canonical address in the pool's currency. A pool does not decide who holds shares. The work's creator receives the full supply, and allocation is up to the product.

## Deployment

`royalty_pool` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `hikida` at `e245b09f`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/Published.toml) records two generations:

- **Mainnet** `published-at = "0x155434bddf7ccc477e3a03676900b49b295a031230b5e19021cfa5b092a8bcbf"`, published in transaction `4NeUGoycGYw5NSBW7G1KPUvxfGs9M5D71HxtLeUwpSWb` after the last source and dependency-pin change, so it matches this page. It replaced an earlier entry from before the module rename and the `carry` to `remainder` rename.
- **Testnet** `published-at = "0xd6d13d85d5748ce6faa6b2670e5b8039aa7bf8894735c9506ec78a578a7f9b31"`, recorded before later source changes, including renaming the modules to `royalty_pool` and `royalty_pool_stake`, so it predates this source.

Packages that hold stakes or take pool objects, such as [`recording_revenue_share`](/move/framework/recording-revenue-share/) and [`royalty_grant`](/move/framework/royalty-grant/), work only with pools of the `royalty_pool` package they link. The README states no audit status. The 59 unit tests pass locally with Sui 1.82.2. The unit-test VM does not settle accumulator funds, so test a funded `settle` and the same-commit guard on localnet or a network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/README.md), [`royalty_pool` module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/sources/royalty_pool.move), [`royalty_pool_stake` module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/sources/royalty_pool_stake.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_pool/tests).
