---
title: Royalty Advances
description: Escrow an advance in an on-chain offer; accepting it pays the rights holder and locks their stake in a royalty grant in one transaction.
---

This page is for developers who fund an advance against a rights holder's future royalties. It explains how `royalty_advance` escrows the payment in an offer, what accepting the offer does, and how either side gets out before acceptance.

## An Advance That Cannot Go Unpaid

Suppose a label wants to advance money to the rights holder of Whitney Houston's master of "I Will Always Love You" and recoup it from the recording's royalties. With a plain [royalty grant](/move/framework/royalty-grant/), the rights holder must create the grant before the label pays, and the label must trust that it will. With `royalty_advance`, the label puts the payment in an offer first. When the rights holder accepts, the payment goes to them and their stake is locked in a grant with the label as recipient, on the offered terms, in one transaction.

Every advance made through this package is funded on-chain; there is no way to create one without the payment. Grants with no on-chain payment, such as off-chain advances, producer points, and pledges, use `royalty_grant` directly.

```move
public struct RoyaltyAdvanceOffer<phantom Share, phantom Currency> has key {
    id: UID,
    payment: Balance<Currency>,
    provider: address,
    owner: address,
    shares: u64,
    terms: RoyaltyGrantTerms,
    offer_expires_at_ms: u64,
}
```

`provider` pays the advance and becomes the grant's recipient. `owner` is the rights holder, who receives the payment and the grant's owner cap. `shares` is the exact stake size the offer asks for, in base units of `Share`; with core's 100,000,000 shares at six decimals, a fifth of a recording is 20,000,000,000,000 base units. `terms` are the [grant terms](/move/framework/royalty-grant/#terms) built with `royalty_grant::new_terms`. The payment's `Currency` is also the grant's `Currency`, so the advance is repaid in the currency it was paid in.

## Making an Offer

The provider, in one programmable transaction:

1. Builds the terms with `royalty_grant::new_terms`.
2. Calls `new_offer(payment, provider, owner, shares, terms, offer_expires_at_ms, clock, ctx)`, which emits `RoyaltyAdvanceOfferCreatedEvent` and returns the offer with a `RoyaltyAdvanceOfferProviderCap`.
3. Transfers the provider cap to the provider and calls `share_offer`.

The provider cap carries the `offer_id` and lets its holder cancel. Its ID is derived from the offer, at `derive_offer_provider_cap_address(offer)`.

## Accepting

Before the offer expires, the rights holder calls `accept_offer` with the offer, the recording's pool in `Currency`, and an unregistered stake of exactly `shares`. The core of `accept_offer` (excerpt; the opening unpacks the offer, and the rest emits `RoyaltyAdvanceOfferAcceptedEvent`, deletes the offer, and returns the grant):

```move
assert!(clock.timestamp_ms() < offer_expires_at_ms, EOfferExpired);
assert!(stake.value() == shares, EWrongShares);
payment.send_funds(owner);
let (grant, owner_cap) = royalty_grant::new(
    pool,
    stake,
    owner,
    provider,
    terms,
    root,
    clock,
    ctx,
);
transfer::public_transfer(owner_cap, owner);
```

The excerpt shows that payment and lock are one step: the payment cannot reach the owner without the stake entering the grant, and the grant is created only on the terms stored in the offer. `royalty_grant::new` registers the stake in the pool and sends the recipient cap to the provider. The grant's term starts at acceptance. The caller then calls `royalty_grant::share` on the returned grant in the same transaction.

**The caps and payment follow the offer's addresses, not the caller.** Anyone holding a stake of the right size can call `accept_offer`, but the payment and owner cap go to `owner`, and the recipient cap goes to `provider`. Accept only with a stake you mean to lock for the offer's `owner`.

The stake must be unregistered for the same reason as in [`royalty_grant::new`](/move/framework/royalty-grant/#creating-a-grant): unregister it from each pool first, in the same transaction, then `register` the returned grant's stake in the other currency pools with `royalty_grant::register`. From then on it is an ordinary grant. Anyone sweeps it, and the owner cap's holder reclaims the stake once the grant is repaid or its term ends.

## Cancelling

- **`cancel_offer(offer, cap)`**: the provider cap's holder can cancel at any time before acceptance.
- **`cancel_expired_offer(offer, clock)`**: anyone can cancel once `offer_expires_at_ms` has passed, which keeps expired offers from holding funds.

Either refunds the payment to the stored `provider` address, not to whoever holds the cap, emits `RoyaltyAdvanceOfferCancelledEvent`, and deletes the offer. After acceptance or cancellation the provider cap points at a deleted offer; its holder should delete it with `destroy_offer_provider_cap`.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty payment | `new_offer` aborts with `EZeroPayment` (0). |
| Zero `shares` | `new_offer` aborts with `EZeroShares` (1). |
| An expiry at or before now | `new_offer` aborts with `EOfferExpired` (2). |
| Accepting at or after `offer_expires_at_ms` | `accept_offer` aborts with `EOfferExpired` (2). |
| A stake whose value is not exactly `shares` | `accept_offer` aborts with `EWrongShares` (3). |
| A stake registered in any pool | `accept_offer` aborts with `royalty_grant::EStakeRegistered`. |
| Cancelling an unexpired offer without the cap | `cancel_expired_offer` aborts with `EOfferNotExpired` (4). |
| Another offer's provider cap | `cancel_offer` aborts with `EUnauthorized` (5). |

Invalid terms never reach this package: `royalty_grant::new_terms` rejects them first.

## Events

| Event | Fields |
| --- | --- |
| `RoyaltyAdvanceOfferCreatedEvent<Share, Currency>` | `offer_id`, `provider`, `owner`, `value`, `shares`, `recipient_share_bps`, `repayment_value`, `duration_ms`, `offer_expires_at_ms` |
| `RoyaltyAdvanceOfferAcceptedEvent` | `offer_id`, `grant_id`; emitted alongside `royalty_grant`'s `RoyaltyGrantCreatedEvent` |
| `RoyaltyAdvanceOfferCancelledEvent` | `offer_id` |

`RoyaltyAdvanceOfferAcceptedEvent` is what tells an indexer that a grant was funded on-chain.

## Deployment

The package README states that it has not been audited, and at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` it records no deployed generation. It depends on `royalty_grant` and `royalty_pool` from the same repository by local path. The 15 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance/sources/royalty_advance.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance/tests/royalty_advance_tests.move).
