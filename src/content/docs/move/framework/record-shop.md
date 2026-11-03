---
title: Record Shop
description: Sell a release's Records at a fixed or minimum price per currency, only while its release license is authorized, forwarding every payment to the tracks' royalty pools.
---

This page is for developers who sell Records of a release or build the purchase flow for one. It explains how `record_shop` prices a [Pressing](/move/framework/record/), what a buyer must pass, and exactly where the payment goes.

## Pricing a Pressing

Suppose the release admin of *The Bodyguard* soundtrack has created edition 1 as a Pressing and wants to sell it for exactly 1 SUI, and also for at least 5 units of a stablecoin. `record_shop` stores one `Pricing` per currency on the Pressing itself:

```move
public struct PricingKey<phantom Currency>() has copy, drop, store;
```

```move
public enum Pricing has copy, drop, store {
    Fixed(u64),
    Floor(u64),
}
```

A Pressing is on sale in `Currency` while it holds a pricing under `PricingKey<Currency>()`. There is no shop, listing, or registry object: the pricing is a dynamic field on the Pressing it prices, written through the Pressing's cap-gated `uid_mut`. Every currency's sales draw on the same edition `max_supply` and the same numbering.

| Pricing | Accepts | Price 0 means |
| --- | --- | --- |
| `fixed(value)` | Exactly `value`; more or less aborts | Free, paid with a zero `Balance<Currency>` |
| `floor(value)` | `value` or more; the whole payment is kept | Pay what you want, including nothing |

A Floor overpayment is not refunded; the whole amount is forwarded. Frontends should say so before the buyer signs. A free or pay-what-you-want pricing lets any address take Records up to `max_supply` for the cost of gas, and this package has no per-buyer limit.

## Setting Up a Sale

Each step needs a cap. The release admin's steps (1 and 3 to 6) can run in one programmable transaction, and the license must exist before step 5:

1. The release admin creates the release's [Release License](/move/framework/release-license/) with one split per track and shares it.
2. Each track's recording admin authorizes the release on that license. This can happen before or after pricing, but nothing sells until every track has authorized.
3. The release admin creates the Pressing with `pressing::new`, which returns its `PressingAdminCap`.
4. Authorize the shop's witness on it: `authorize_distributor<record_shop::witness::Witness>`.
5. Call `set_pricing<Currency>(pressing, pressing_cap, release, pricing)` for each currency, with `fixed` or `floor`.
6. Call `share` on the Pressing.

`set_pricing` checks the `PressingAdminCap` first, then that the Release is the Pressing's, then that the Release has a license (`release_license::has_license`). It adds or replaces the currency's pricing; setting the current value again changes nothing and emits nothing. `clear_pricing<Currency>(pressing, pressing_cap)` stops sales in that currency, and is silent when none is set. `has_pricing<Currency>` and `pricing<Currency>` read the current pricing.

## Buying a Record

A buyer passes the shared Pressing, its Release, the release's `ReleaseLicense`, a `Balance<Currency>`, and the `Clock`. The complete function:

```move
public fun purchase<Currency>(
    pressing: &mut Pressing,
    release: &Release,
    license: &ReleaseLicense,
    payment: Balance<Currency>,
    clock: &Clock,
): Record {
    assert!(object::id(release) == pressing.release_id(), EWrongRelease);
    assert!(license.is_authorized(), ENotAuthorized);
    let paid_value = payment.value();
    match (pricing<Currency>(pressing)) {
        Pricing::Fixed(value) => assert!(paid_value == *value, EWrongPayment),
        Pricing::Floor(value) => assert!(paid_value >= *value, EWrongPayment),
    };
    let record = record::press<witness::Witness, Currency>(
        pressing,
        witness::new(),
        paid_value,
        clock,
    );
    release_license::forward(license, release, payment);
    record
}
```

The function shows the order of a sale:

- **The release must be fully licensed.** `is_authorized` is true only once every track's recording admin has authorized the release. An `Authorized` license cannot be revoked and its splits cannot change, so a release that is on sale stays sellable.
- **The payment is the price the buyer signed.** The `Balance` amount is fixed in the transaction, so a repricing between signing and execution makes the purchase abort rather than charge more. A transaction that sizes its payment from `pricing()` at execution time accepts whatever the current price is.
- **The Record stores the amount paid.** `purchase_price` is `paid_value`, including any Floor overpayment, and `purchase_currency` is `Currency`.
- **The Record is returned.** The transaction must transfer it or otherwise use it, for example `transfer::public_transfer(record, recipient)`, which allows buying it as a gift or sending it to a listener's [Player](/move/framework/miso-player/).

The Pressing enforces the Distributor check and the supply cap inside `record::press`, before any payment moves. If any later step aborts, the whole transaction rolls back, including the Record's number.

## Where the Money Goes

`purchase` forwards the entire `Balance` with `release_license::forward`. No part stays in the shop, the Pressing, or the Record, and Miso takes no fee in this package.

```text
payment ─→ release_license::forward ─→ track i's recording pool address   (payment × splits[i] ÷ 10,000, rounded down)
                                    └─→ the license's address               (rounding remainder)
```

1. Each track's share is sent to the canonical address of that recording's [royalty pool](/move/framework/royalty-pool/) in `Currency`. A track whose split is 0 receives nothing.
2. The rounding remainder goes to the license's address. Anyone can call `release_license::redeem_and_forward` later to pay it out by the splits.
3. Funds at a pool address wait until that pool exists and has registered stakes. A settle folds them in, and the recording's share holders claim pro rata.
4. If the recording has a [Recording License](/move/framework/recording-license/), the composition's cut is one of those stakes. Anyone can call `recording_license::sweep` to move it to the composition's pool, whose share holders claim after it settles.

A zero payment forwards nothing. See [How Revenue Moves](/move/framework/#how-revenue-moves) for the whole path.

## The Witness

The authorized Distributor type is exactly `record_shop::witness::Witness`:

```move
public struct Witness() has drop;
```

Its only constructor is `public(package)`, and the package calls it only inside `purchase`, after the release, license, and payment checks. The repository's privacy fixtures are two external packages that try to pack `Witness()` and call `witness::new()`; the package's `make verify` checks that both fail to compile.

**The package must be immutable before any Pressing authorizes its Witness.** An upgrade could construct the same witness without the sale checks. Before authorizing it, confirm that the `UpgradeCap` of the `record_shop` package you link has been consumed with `package::make_immutable`.

`PressingAdminCap` and `ReleaseAdminCap` must stay address-owned or in trusted custody. The `PressingAdminCap` holder can reprice, stop sales, or authorize another Distributor on the Pressing; revoking the Witness stops new sales but does not affect Records already sold.

## Failure Cases

| Situation | Result |
| --- | --- |
| A Release other than the Pressing's | `purchase` and `set_pricing` abort with `EWrongRelease` (0). |
| A Fixed payment other than the price, or a Floor payment below it | `purchase` aborts with `EWrongPayment` (1). |
| `set_pricing` for a Release with no license | Aborts with `ENoLicense` (2). |
| A license that is not `Authorized` | `purchase` aborts with `ENotAuthorized` (3). |
| A currency the Pressing is not priced in | `purchase` and `pricing` abort with `ENoPricing` (4). |
| Another Pressing's `PressingAdminCap` | `set_pricing` and `clear_pricing` abort in `record` with `pressing::EUnauthorized` (0). |
| A Pressing that has not authorized, or has revoked, the Witness | `purchase` aborts in `record` with `pressing::EDistributorNotAuthorized` (3). |
| A sold-out Pressing | `purchase` aborts in `record` with `pressing::EMaxSupplyReached` (4). |
| An authorized license for another Release | `purchase` aborts in `release_license::forward` with `EWrongRelease` (2). |

## Events

| Event | Fields |
| --- | --- |
| `PricingSetEvent<Currency>` | `pressing_id`, `pricing` (the full `Pricing` value) |
| `PricingClearedEvent<Currency>` | `pressing_id` |

A sale emits no `record_shop` event. `record` emits `RecordPurchasedEvent<record_shop::witness::Witness, Currency>` for the new Record, and `release_license` emits [`ReleaseRevenueForwardedEvent<Currency>`](/move/framework/release-license/#events) when the payment pays any track.

## Deployment

The package's [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/Published.toml) records testnet and mainnet generations, but both were recorded before later changes to the package's sources and manifest and to `record` and `release_license`, so neither matches the source on this page. The README makes no statement about an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and links `record` and `release_license` by local path; it can sell only Pressings of the `record` package it links. The 36 unit tests pass locally; funds arriving at pool addresses need an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/README.md), modules [`shop`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/sources/shop.move) and [`witness`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/sources/witness.move), [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/tests/shop_tests.move), and [security notes](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop/SECURITY.md).
