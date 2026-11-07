---
title: Royalty Advance
description: An escrowed advance offer. Accepting pays the rights holder and locks their stake in an active royalty grant.
---

`royalty_advance` escrows a payment in an offer. The rights holder accepts, is paid, and their stake locks in an active grant in one transaction. Use it to fund or accept an advance against future royalties.

## An Advance That Cannot Go Unpaid

A label advances money to the rights holder of Whitney Houston's master of "I Will Always Love You" and recoups it from royalties. With a plain [royalty grant](/move/framework/royalty-grant/), the label pays off-chain after activation, so the rights holder must trust it. With `royalty_advance`, the label escrows the payment first. On acceptance the rights holder is paid and their stake locks in an active grant, with the label as recipient, on the offered terms.

Every advance here is funded on-chain. Grants with no on-chain payment (off-chain advances, producer points, pledges) use `royalty_grant` directly.

```move
public struct RoyaltyAdvanceOffer<phantom Share, phantom Currency> has key {
    id: UID,
    payment: Balance<Currency>,
    provider: address,
    owner: address,
    shares: u64,
    terms: RoyaltyGrantTerms,
    expires_at_ms: u64,
}
```

- **`provider`** pays the advance, becomes the grant's recipient, and receives any refund. It must be able to receive both funds and a `key, store` capability, such as a wallet or a Party (a Party's admin takes both out with [`party_wallet`](/move/framework/party-wallet/)).
- **`owner`** is the rights holder. It receives the payment and becomes the grant's owner payout address.
- **`shares`** is the exact stake size the offer asks for, in base units of `Share`. With core's 100,000,000 shares at six decimals, a fifth of a recording is 20,000,000,000,000 base units.
- **`terms`** are the [grant terms](/move/framework/royalty-grant/#terms), built and checked with `royalty_grant::new_terms`. The payment's `Currency` is also the grant's `Currency`: the advance is repaid in the currency it was paid in, and the grant shares only royalties in that currency.

An offer never changes after creation. Acceptance or cancellation deletes it.

## Making an Offer

The provider, in one programmable transaction:

1. Build the terms with `royalty_grant::new_terms`.
2. Call `new(payment, provider, owner, shares, terms, expires_at_ms, clock, ctx)`. It checks the payment, shares, and expiry, emits `RoyaltyAdvanceOfferCreatedEvent`, and returns the offer with a `RoyaltyAdvanceOfferProviderCap`.
3. `transfer::public_transfer` the provider cap to the provider and call `share` on the offer.

The provider cap is `key, store`, carries `offer_id` (also `cap.offer_id()`), and lets its holder cancel. It derives from the offer at `derive_provider_cap_address(offer)`. Offer views: `provider`, `owner`, `payment_value`, `shares`, `terms`, `expires_at_ms`.

## Accepting

Before expiry, the rights holder calls `accept(offer, pool, stake, root, clock, ctx)` with the recording's pool in `Currency` and an unregistered stake of exactly `shares`. It returns the grant and its owner cap. Core of `accept` (excerpt; the rest emits `RoyaltyAdvanceOfferAcceptedEvent`, deletes the offer, and returns the grant with the owner cap):

```move
assert!(clock.timestamp_ms() < expires_at_ms, EExpired);
assert!(stake.value() == shares, EWrongShares);
let value = payment.value();
payment.send_funds(owner);
let (grant, owner_cap, recipient_cap) = royalty_grant::new_active(
    pool,
    stake,
    owner,
    provider,
    terms,
    root,
    clock,
    ctx,
);
transfer::public_transfer(recipient_cap, provider);
```

Design choices:

- **Payment and lock are one step.** The payment cannot reach the owner without the stake entering the grant, and the grant exists only on the offer's stored terms.
- **The grant is active at once.** `accept` uses [`royalty_grant::new_active`](/move/framework/royalty-grant/#activating), not `new`. The provider named its own address in the offer, so no pending step needs the recipient's signature. The term starts at acceptance.
- **The recipient cap goes to `provider`, never through the caller.** The accepting side cannot `waive` the grant it created.

The owner cap returns to the caller, as `royalty_grant::new` returns it, so whoever supplies the stake holds the right to reclaim it. In the same transaction, call `royalty_grant::share` on the grant and keep or transfer the owner cap, for example with `transfer::public_transfer`.

The stake must be unregistered, as in [`royalty_grant::new`](/move/framework/royalty-grant/#creating-a-grant): unregister it from each pool first, in the same transaction. `accept` registers it only in the `Currency` pool. The result is an ordinary grant: anyone sweeps it, and the owner cap's holder reclaims the stake once the grant is repaid or its term ends.

**Anyone holding a stake of the right size can accept.** The payment goes to the offer's `owner` and the recipient cap to `provider`, whoever calls. If a stranger accepts with their own stake, the owner is paid and takes on nothing. The stranger's stake is locked and the stranger holds its owner cap. The owner share of sweeps goes to the offer's `owner` until the cap's holder calls `royalty_grant::set_owner`. Accept only with a stake you mean to lock on the offer's terms.

## Cancelling

The provider cap's holder can cancel any time before acceptance. `cancel` consumes the cap:

```move
public fun cancel<Share, Currency>(
    self: RoyaltyAdvanceOffer<Share, Currency>,
    cap: RoyaltyAdvanceOfferProviderCap,
) {
    assert!(cap.offer_id == self.id.to_inner(), EUnauthorized);
    cap.destroy_provider_cap();
    refund(self);
}
```

Anyone can call `cancel_expired(offer, clock)` once `expires_at_ms` has passed, so expired offers never hold funds. Both refund through one private function:

```move
fun refund<Share, Currency>(self: RoyaltyAdvanceOffer<Share, Currency>) {
    let RoyaltyAdvanceOffer { id, payment, provider, .. } = self;
    let value = payment.value();
    payment.send_funds(provider);
    emit(RoyaltyAdvanceOfferCancelledEvent { offer_id: id.to_inner(), provider, value });
    id.delete();
}
```

The payment returns to the stored `provider` address, not the cap's holder. After an accept or `cancel_expired`, the provider cap points at a deleted offer. Delete it with `destroy_provider_cap`.

**The expiry is the provider's recovery bound.** Without the provider cap, the payment stays in the offer until accepted or expired, then anyone can call `cancel_expired`. Keep the cap in a wallet, Party, or [Vault](/move/framework/vault/), and prefer a short expiry.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty payment | `new` aborts with `EZeroPayment` (0). |
| Zero `shares` | `new` aborts with `EZeroShares` (1). |
| An expiry at or before now | `new` aborts with `EExpired` (2). |
| Accepting at or after `expires_at_ms` | `accept` aborts with `EExpired` (2). |
| A stake whose value is not exactly `shares` | `accept` aborts with `EWrongShares` (3). |
| A stake registered in any pool | `accept` aborts in `royalty_grant` with `EStakeRegistered` (4). |
| `cancel_expired` before `expires_at_ms` | Aborts with `ENotExpired` (4). |
| Another offer's provider cap | `cancel` aborts with `EUnauthorized` (5). |

Invalid terms never reach this package: `royalty_grant::new_terms` rejects them first.

## Events

| Event | Fields |
| --- | --- |
| `RoyaltyAdvanceOfferCreatedEvent<Share, Currency>` | `offer_id`, `provider`, `owner`, `value`, `shares`, `recipient_share_bps`, `repayment_value`, `duration_ms`, `expires_at_ms` |
| `RoyaltyAdvanceOfferAcceptedEvent` | `offer_id`, `grant_id`, `provider`, `owner`, `value`; emitted alongside `royalty_grant`'s `RoyaltyGrantCreatedEvent` and `RoyaltyGrantActivatedEvent` |
| `RoyaltyAdvanceOfferCancelledEvent` | `offer_id`, `provider`, `value`; from both `cancel` and `cancel_expired` |

`RoyaltyAdvanceOfferAcceptedEvent` marks a grant funded on-chain. Its `value` is the payment sent to `owner`. The cancelled event's `value` is the refund sent to `provider`.

## Deployment

`royalty_advance` depends on `royalty_grant` and `royalty_pool` from the same repository by local path, and uses `bps` only in test mode. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance/Published.toml) records one generation:

- **Mainnet** `published-at = "0x2709b6d67ca4155a9b1dc7ffff6f79e36f189fadde36b0c3cafbf4fc8a26a38c"`, recorded after the last change to this package, `royalty_grant`, and `royalty_pool`, so it matches this page. The mainnet generations of [`royalty_grant`](/move/framework/royalty-grant/#deployment) and `royalty_pool` were recorded before it, each after its package's last source change.

No Testnet generation is recorded. The README states the package has had no third-party audit and points to formal verification evidence in [`misofm/audits`](https://github.com/misofm/audits). The 15 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance/sources/royalty_advance.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_advance/tests/royalty_advance_tests.move).
