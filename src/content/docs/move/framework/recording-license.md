---
title: Recording License
description: A composition's standing license to record it, paid as a stake of the recording's shares and swept into the composition's pool.
---

This page is for developers who let recordings license a composition on-chain. It explains how a composition admin publishes standing terms, what a recording admin pays to accept them, and how the composition's cut reaches its shareholders.

## A Standing Offer to Record

A core `Recording` can point to any composition, but that link grants no license. With `recording_license`, the composition admin for "I Will Always Love You" can publish a standing policy once. Any recording admin, such as the admin of Whitney Houston's master, can then license a recording of the song without the composition admin's involvement, the way anyone can record a published song.

```move
public struct RecordingLicensePolicy<phantom CompositionShare> has key {
    id: UID,
    composition_id: ID,
    rate: BPS,
}
```

The policy is derived from the composition, so each composition has at most one. `rate` is in basis points, up to 10,000. `new_policy(composition, cap, rate)` creates it unshared, and `share_policy` shares it. The policy is permanent; `set_rate(policy, cap, rate)` changes the rate for future licenses only. A composition without a policy has not consented to this licensing method, although recordings of it can still exist on-chain.

## Paying the Composition's Cut

The license mints nothing. The recording admin pays the composition's cut in the recording's own shares: exactly `rate` of the recording's fixed supply. The license holds that cut as a [royalty pool](/move/framework/royalty-pool/) stake, which makes the composition a holder of the recording.

```move
public struct RecordingLicense<phantom RecordingShare, phantom CompositionShare> has key {
    id: UID,
    recording_id: ID,
    composition_id: ID,
    stake: Option<RoyaltyPoolStake<RecordingShare>>,
}
```

The license is derived from the recording, so a recording can be licensed once in this package generation. The type parameters carry the authorization: the core allows one composition per share type and one admin cap per composition, so a policy or pool for another work does not type-check.

The opening checks of `issue` (excerpt; the rest creates the stake, marks the recording on the policy, and emits `RecordingLicenseIssuedEvent`):

```move
public fun issue<RecordingShare, CompositionShare>(
    policy: &mut RecordingLicensePolicy<CompositionShare>,
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    currency: &Currency<RecordingShare>,
    rate: BPS,
    shares: Balance<RecordingShare>,
    ctx: &mut TxContext,
): RecordingLicense<RecordingShare, CompositionShare> {
    let license_uid = derived_object::claim(recording.uid_mut(cap), RecordingLicenseKey());
    let composition_id = recording.composition_id();
    assert!(policy.composition_id == composition_id, EWrongPolicy);
    assert!(policy.rate == rate, EWrongRate);
    let supply = currency.total_supply().destroy_or!(abort ENoSupply);
    assert!(shares.value() == policy.rate.apply(supply), EWrongShares);
```

The recording admin passes the rate they agreed to. If the composition admin changes the rate concurrently, the transaction aborts instead of applying a rate nobody saw, and the recording admin can resubmit at the new public rate. Core recordings have 100,000,000 shares at six decimals (10^14 base units), so the cut is exact at every rate. A zero rate licenses the recording with no stake. Clients should pass the rate shown to the user, never a rate read inside the transaction.

## Revenue Path

```text
Recording revenue → recording pool → composition's stake (held by the license)
                                          ↓ sweep
                     composition pool → composition-share holders
```

1. **Register** the stake in the recording's pool for a currency: `register<RecordingShare, CompositionShare, Currency>(license, recording_pool, composition_pool, root, clock)`. The composition's pool in the same currency is passed read-only as proof that the composition accepts that currency, so currencies are mutual opt-in.
2. **Sweep** the stake's royalties: `sweep(license, composition, recording_pool, root, clock)` settles the recording pool, claims the stake's royalties, and sends them to the composition pool's canonical address. Anyone can call it.
3. **Settle** the composition pool with `royalty_pool::settle` to credit composition-share holders.

Register the stake **before** sharing the recording's pool. Until the stake is registered, the composition's portion goes to the recording's other stakes, and funds waiting at the pool address go to whichever stakes are registered at the first settle. Likewise, until the composition opens a pool in a currency, its cut of the recording's revenue in that currency goes to the other stakes, with no back pay. Create the composition's pools when the composition is created.

## Setup in One Transaction

`new_policy`, `issue`, and the pool constructors return their objects unshared, so a recording can be set up before any revenue reaches it:

1. `issue` the license, passing the recording share's shared `Currency`.
2. For each payout currency, call `royalty_pool::new_for_recording`, then `register` the composition's stake, passing the composition's pool in that currency.
3. Wrap every other share as a `RoyaltyPoolStake`, register it in each pool, and send it to its holder.
4. Call `royalty_pool::share` on each pool and `share` on the license.

The contracts do not enforce this order; publishing tools do.

## What the Rate Covers

The rate is the composition's whole share of the recording's revenue, including what legacy licensing splits into mechanical and performance royalties. Because pools pay registered stakes only, the composition earns at least `rate`: exactly `rate` when every other recording share is staked, and more while some are not. Sync, broadcast, and live performance are separate and are not paid through recording pools. Do not take this cut on revenue where the composition is already paid separately, for example by an external streaming service that pays collecting societies.

## Trust and Migration

The composition admin can `withdraw(license, cap)` the stake from any license of the composition, including its unclaimed royalties. This is the migration path to a future pool type, and it makes the composition admin cap trust-bearing for composition shareholders: whoever holds it can direct the stake. Put the cap in a multisig or governance object to spread that trust. A withdrawn stake leaves the recording licensed and listed on the policy.

A license is permanent within this package generation. A future generation has different key types, so a recording could take a second license there, and `has_license` sees only its own generation.

## Failure Cases

| Situation | Result |
| --- | --- |
| A policy from another composition | `issue` aborts with `EWrongPolicy` (0). |
| `shares` not exactly `rate` of the supply | `issue` aborts with `EWrongShares` (1). |
| `register` or `withdraw` when the license holds no stake | Aborts with `ENoStake` (2). |
| The recording share's supply is unknown | `issue` aborts with `ENoSupply` (3). |
| `sweep` with another composition | Aborts with `EWrongComposition` (4). |
| A rate other than the policy's current rate | `issue` aborts with `EWrongRate` (5). |
| A second policy, or a second license for the same recording | Aborts with `derived_object::EObjectAlreadyExists`. |
| `register` for a stake already registered in that pool | Aborts with `royalty_pool::EStakeAlreadyRegistered`. |

`sweep` returns 0 without aborting when the license has no stake or the stake is not registered in that currency's pool.

## Events

| Event | Fields |
| --- | --- |
| `RecordingLicensePolicyCreatedEvent` | `policy_id`, `composition_id`, `rate_bps` |
| `RecordingLicensePolicyRateSetEvent` | `policy_id`, `composition_id`, `rate_bps`, only when the rate changes |
| `RecordingLicenseIssuedEvent` | `license_id`, `recording_id`, `composition_id`, `rate_bps`, `shares`, `stake_id` (`none` for a zero cut) |
| `RecordingLicenseStakeWithdrawnEvent` | `recording_id`, `composition_id`, `stake_id` |
| `RecordingLicenseRoyaltySweptEvent<Currency>` | `recording_id`, `composition_id`, `stake_id`, `value` |

Stake registration and claims emit the `royalty_pool` events, keyed by the same `stake_id`.

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` the package records no deployed generation, and it depends on the current `royalty_pool` source and on `miso_music` at `bc547c79`. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments) before building against a network.

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license/sources/recording_license.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license/tests/recording_license_tests.move).
