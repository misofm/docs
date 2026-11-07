---
title: Recording Revenue Share
description: A recording gives its composition a permanent share at the composition's published rate, swept into the composition's pool.
---

`recording_revenue_share` routes part of a recording's revenue to its composition. The composition admin publishes a rate, a recording admin accepts it by giving shares, and the composition's stake pays into its pool.

## Published Terms, Voluntary Shares

A core `Recording` can point to any composition, and that link moves no money. The composition admin for "I Will Always Love You" publishes terms once, with a rate. The admin of any recording of the song, such as Whitney Houston's master, can then share revenue at that rate without the composition admin.

```move
public struct RecordingRevenueShareTerms<phantom CompositionShare> has key {
    id: UID,
    composition_id: ID,
    rate: BPS,
}
```

Terms are derived from the composition, so each composition has at most one. `rate` is in basis points, up to 10,000. `new_terms(composition, cap, rate)` creates them unshared. `share_terms` shares them (aliased `terms.share()`). Terms are permanent. `set_rate(terms, cap, rate)` changes the rate for future revenue shares only and emits nothing when unchanged. A composition without terms takes no part in revenue sharing, though recordings of it can exist on-chain. Platforms decide what to display.

This is a voluntary revenue share between two works, not a copyright license. It does not replace mechanical, performance, or any other royalties owed under a territory's law, or any legal obligation of either party.

## Giving the Composition Its Share

Nothing is minted. The recording admin gives the composition exactly `rate` of the recording's fixed share supply. The revenue share holds them as a [royalty pool](/move/framework/royalty-pool/) stake, making the composition a holder of the recording.

```move
public struct RecordingRevenueShare<phantom RecordingShare, phantom CompositionShare> has key {
    id: UID,
    recording_id: ID,
    composition_id: ID,
    stake: Option<RoyaltyPoolStake<RecordingShare>>,
}
```

The revenue share is derived from the recording, so a recording can share revenue with its composition once per package generation. The type parameters carry authorization: core allows one composition per share type and one admin cap per composition, so another work's terms, revenue share, or pool does not type-check.

Opening checks of `new` (excerpt; the rest creates the stake for a nonzero cut, marks the recording on the terms, and emits `RecordingRevenueShareCreatedEvent`):

```move
public fun new<RecordingShare, CompositionShare>(
    terms: &mut RecordingRevenueShareTerms<CompositionShare>,
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    currency: &Currency<RecordingShare>,
    rate: BPS,
    shares: Balance<RecordingShare>,
    ctx: &mut TxContext,
): RecordingRevenueShare<RecordingShare, CompositionShare> {
    let revenue_share_uid = derived_object::claim(
        recording.uid_mut(cap),
        RecordingRevenueShareKey(),
    );
    let composition_id = recording.composition_id();
    assert!(terms.composition_id == composition_id, EWrongTerms);
    assert!(terms.rate == rate, EWrongRate);
    let supply = currency.total_supply().destroy_or!(abort ENoSupply);
    assert!(shares.value() == terms.rate.apply(supply), EWrongShares);
```

The recording admin passes the rate they agreed to. If the composition admin changes the rate concurrently, the transaction aborts instead of applying an unseen rate. Resubmit at the new public rate. Clients pass the rate shown to the user, never one read inside the transaction. The supply comes from the recording share's shared `Currency`; burn-only supplies are accepted. Core recordings have 100,000,000 shares at six decimals (10^14 base units), so the cut is exact at every rate. A zero rate takes a zero cut and creates no stake. At 100% the admin gives the whole supply.

`new` writes a `RevenueShareRecordingKey(recording_id)` marker on the terms. Listing the terms' dynamic fields lists the recordings sharing revenue with the composition. One composition's revenue shares are sequenced with each other and with `set_rate`.

Pools pay registered stakes only, so the composition earns at least `rate` of the recording's pool revenue: exactly `rate` when every other recording share is staked, more otherwise.

## Revenue Path

```text
Recording revenue → recording pool → composition's stake (held by the revenue share)
                                          ↓ sweep
                     composition pool → composition-share holders
```

1. **Register** the stake in the recording's pool for a currency: `register<RecordingShare, CompositionShare, Currency>(revenue_share, recording_pool, composition_pool, root, clock)`. The composition's pool in that currency is passed read-only as proof it accepts the currency, so currencies are mutual opt-in.
2. **Sweep**: `sweep(revenue_share, composition, recording_pool, root, clock)` settles the recording pool, claims the stake's royalties, and sends them to the composition pool's canonical address. Anyone can call it.
3. **Settle** the composition pool with `royalty_pool::settle` to credit composition-share holders. Swept funds wait at the pool's address until it has registered stakes.

Start of `sweep`'s body (excerpt; the rest sends a nonzero claim to the composition pool's canonical address and emits `RecordingRevenueShareSweptEvent`):

```move
    assert!(object::id(composition) == self.composition_id, EWrongComposition);
    if (self.stake.is_none()) return 0;
    let stake = self.stake.borrow_mut();
    if (!stake.has_registration(object::id(recording_pool))) return 0;
    recording_pool.settle(root, clock);
    let royalty = recording_pool.claim_royalties(stake);
```

Register the stake **before** sharing the recording's pool. Until registered, the composition's portion goes to the recording's other stakes, and funds waiting at the pool address go to whichever stakes are registered at the first settle. Likewise, until the composition opens a pool in a currency, its share of revenue in that currency goes to the other stakes, with no back pay. Opening a pool is a permanent opt-in to that currency. Create the composition's pools with the composition, and a new currency's pool before recordings earn in it.

## Setup in One Transaction

`new_terms`, `new`, and the pool constructors return objects unshared, so you can set up a recording before any revenue arrives. Whoever owns both works can create the composition, its terms, and the recording with its revenue share in one transaction, sharing everything at the end:

1. `new` the revenue share, passing the recording share's shared `Currency`.
2. For each payout currency, call `royalty_pool::new_for_recording`, then `register` the composition's stake, passing the composition's pool in that currency.
3. Wrap every other share as a `RoyaltyPoolStake`, register it in each pool, and send it to its holder.
4. Call `royalty_pool::share` on each pool and `share` on the revenue share.

The contracts do not enforce this order. Publishing tools do.

## Trust and Migration

The composition admin can `withdraw(revenue_share, cap)` the stake, including unclaimed royalties, from any revenue share of the composition. This is the migration path to a future pool type. The composition admin cap is therefore trust-bearing for composition shareholders: whoever holds it directs the stake. Put it in a multisig or governance object to spread that trust.

Withdrawal is final. The recording keeps its revenue share and stays listed on the terms, but nothing puts a stake back, so it earns nothing and the recording cannot create another in this generation. A future generation has different key types, so a recording could create a second revenue share there. `has_revenue_share` sees only its own generation.

## Views

| Function | Returns |
| --- | --- |
| `derive_address<RecordingShare>(recording)` | The revenue share's address for a recording. |
| `has_revenue_share<RecordingShare>(recording)` | Whether the recording has a revenue share in this generation. |
| `recording_id`, `composition_id`, `stake` | The revenue share's fields; `stake` returns `&Option<RoyaltyPoolStake<RecordingShare>>`. |
| `derive_terms_address<CompositionShare>(composition)` | The terms' address for a composition. |
| `has_terms<CompositionShare>(composition)` | Whether the composition has published terms. |
| `recording_revenue_share_terms_rate`, `recording_revenue_share_terms_composition_id` | The terms' rate and composition (aliased `terms.rate()` and `terms.composition_id()`). |
| `recording_revenue_share_terms_has_recording(terms, recording_id)` | Whether a recording shares revenue under the terms (aliased `terms.has_recording(recording_id)`). |

## Failure Cases

| Situation | Result |
| --- | --- |
| `new` with terms from another composition | `EWrongTerms` (0) |
| `new` with `shares` not exactly `rate` of the supply | `EWrongShares` (1) |
| `register` or `withdraw` when the revenue share holds no stake | `ENoStake` (2) |
| `new` when the recording share's supply is unknown | `ENoSupply` (3) |
| `sweep` with another composition | `EWrongComposition` (4) |
| `new` with a rate other than the terms' current rate | `EWrongRate` (5) |
| A second set of terms for a composition, or a second revenue share for a recording | `derived_object::EObjectAlreadyExists` |
| `register` for a stake already registered in that pool | `royalty_pool::EStakeAlreadyRegistered` (1) |

`sweep` returns 0 without aborting when the revenue share has no stake, the stake is not registered in that currency's pool, or there is nothing to claim.

## Events

| Event | Fields |
| --- | --- |
| `RecordingRevenueShareTermsCreatedEvent` | `terms_id`, `composition_id`, `rate_bps` |
| `RecordingRevenueShareTermsRateSetEvent` | `terms_id`, `composition_id`, `rate_bps`, only when the rate changes |
| `RecordingRevenueShareCreatedEvent` | `revenue_share_id`, `recording_id`, `composition_id`, `rate_bps`, `shares`, `stake_id` (`none` for a zero cut) |
| `RecordingRevenueShareStakeWithdrawnEvent` | `recording_id`, `composition_id`, `stake_id` |
| `RecordingRevenueShareSweptEvent<Currency>` | `recording_id`, `composition_id`, `stake_id`, `value` |

The stake emits `royalty_pool` events keyed by the same `stake_id`: `RoyaltyPoolStakeCreatedEvent` from `new` for a nonzero cut, `RoyaltyPoolStakeRegisteredEvent` from `register`, `RoyaltyClaimedEvent` from a `sweep` claiming a nonzero amount. The settle inside `register` and `sweep` emits `RoyaltyDepositedEvent` when it folds funds. Sharing and a zero `sweep` emit nothing here.

## Deployment

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `bps` at `4ca1972a`. `royalty_pool` is a local-path dependency. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share/Published.toml) records one generation:

- **Mainnet** `published-at = "0x7209708976e58d654ec45aad7b25de9cc649735a1e67d73d71e41d345a431566"`, published in transaction `5XFhPYiYD4VoYj9bDpa23uvYBKdYxJ8bGZY3x71L5g4m` and recorded after the last source and dependency-pin change, so it matches this source. It links the mainnet [`royalty_pool`](/move/framework/royalty-pool/#deployment) generation at `0x155434bddf7ccc477e3a03676900b49b295a031230b5e19021cfa5b092a8bcbf`, and its stake registers only in pools of that package.

No testnet generation is recorded. The README states no audit status. The 31 unit tests pass locally with Sui 1.82.2. The test VM does not settle accumulator funds, so arrival and settlement of swept funds at the composition pool need a network test. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share/sources/recording_revenue_share.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_revenue_share/tests/recording_revenue_share_tests.move).
