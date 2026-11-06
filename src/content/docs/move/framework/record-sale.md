---
title: Record Sale
description: Sell a Pressing's Records at one fixed price in one currency, set once with the sale's authorization, only while its release license is authorized, forwarding every payment to the tracks' royalty pools.
---

This page is for developers who sell Records of a release or build the purchase flow for one. It explains how `record_sale` authorizes and prices a [Pressing](/move/framework/record/), what a buyer must pass, how tips work, and exactly where the payment goes.

## One Price, Set Once

Suppose the release admin of *The Bodyguard* soundtrack has created edition 1 as a Pressing and wants to sell it for exactly 1 SUI. `record_sale` stores that price on the Pressing itself, as one dynamic field:

```move
public struct Price has copy, drop, store {
    currency: TypeName,
    value: u64,
}

public struct PriceKey() has copy, drop, store;
```

A Pressing is on sale while `record_sale::witness::Witness` is an authorized Distributor on it and it holds a `Price` under `PriceKey()`. There is no global sale, listing, or registry object, and the Release is not stored; the price lives on the Pressing it prices.

The key is not currency-typed, so a Pressing has **one price in one currency, forever**. There is no way to change the price, remove it, or add a second currency. A price of 0 is free. There is no floor or pay-what-you-want mode; a buyer who wants to pay more sends a [tip](#tips) beside the purchase. A different price or currency is a different Pressing or edition, which also follows `record`'s rule that access never depends on what was spent.

Every sale draws on the Pressing's `max_supply`, shared with every other Distributor on that Pressing. Destroying a Record does not restore capacity.

## Authorizing a Sale

`authorize` makes `record_sale` a Distributor on the Pressing and writes its price in the same call:

```move
public fun authorize<Currency>(
    pressing: &mut Pressing,
    cap: &PressingAdminCap,
    release: &Release,
    price: u64,
) {
    pressing.authorize_distributor<Witness>(cap);
    let pressing_release_id = pressing.release_id();
    let uid = pressing.uid_mut(cap);
    assert!(object::id(release) == pressing_release_id, EWrongRelease);
    assert!(release_license::has_license(release), ENoLicense);
    assert!(!df::exists(uid, PriceKey()), EPriceExists);
    df::add(
        uid,
        PriceKey(),
        Price { currency: type_name::with_defining_ids<Currency>(), value: price },
    );
    emit(SaleAuthorizedEvent<Currency> { pressing_id: uid.to_inner(), price });
}
```

The function shows the setup rules:

- **The `PressingAdminCap` is checked first.** `authorize_distributor` aborts in `record` for another Pressing's cap before any other check.
- **The Release must be the Pressing's and must be licensed.** `has_license` is true once the release admin has created the Release's [Release License](/move/framework/release-license/). The license need not be `Authorized` yet; tracks can authorize it before or after the sale is set up.
- **The price is written once.** Calling `authorize` again while the Witness is authorized aborts in `record` with `EDistributorAlreadyAuthorized`. After a revoke, calling it again aborts with `EPriceExists`, in any currency, so a revoke cannot be used to reprice.

The release admin's steps can run in one programmable transaction. The sale is authorized before the Pressing is shared (excerpt from the package README; `splits` holds one basis-point split per track):

```move
let license = release_license::release_license::new(&mut release, &release_cap, splits);
license.share();
record_sale::sale::authorize<SUI>(
    &mut pressing,
    &pressing_cap,
    &release,
    1_000_000_000,
);
pressing.share();
```

Here `pressing` and `pressing_cap` come from `pressing::new` earlier in the same transaction. Each track's recording admin then authorizes the Release on the license, through `release_license::authorize`. Nothing sells until every track has done so.

**Authorize through `authorize`, not `authorize_distributor`.** The `Witness` type is public, so a `PressingAdminCap` holder can also authorize it directly with `pressing.authorize_distributor<Witness>(cap)`. That leaves the Pressing with no price: every purchase aborts with `ENoPrice`, and a later `authorize` aborts with `EDistributorAlreadyAuthorized`. To recover, call `revoke_distributor<Witness>` and then `authorize` in the same transaction.

### Stopping and Restoring a Sale

There is no pause and no price change. The only way to stop sales early is to remove the Witness with `pressing.revoke_distributor<Witness>(cap)` from `record`. Revoking stops new sales immediately and does not affect Records already sold. The price stays on the Pressing, so authorizing the Witness again with `authorize_distributor<Witness>` restores the sale at its original price. Sales otherwise end when the Pressing sells out.

## Buying a Record

A buyer passes the shared Pressing, its Release, the Release's `ReleaseLicense`, and a `Balance<Currency>`. The complete function:

```move
public fun purchase<Currency>(
    pressing: &mut Pressing,
    release: &Release,
    license: &ReleaseLicense,
    payment: Balance<Currency>,
): Record {
    assert!(object::id(release) == pressing.release_id(), EWrongRelease);
    assert!(license.is_authorized(), ENotAuthorized);
    let price = *borrow_price(pressing);
    assert!(price.currency == type_name::with_defining_ids<Currency>(), EWrongCurrency);
    assert!(payment.value() == price.value, EWrongPayment);
    let record = record::new(pressing, witness::new());
    emit(RecordSoldEvent<Currency> {
        record_id: object::id(&record),
        pressing_id: object::id(pressing),
        price: price.value,
    });
    release_license::forward(license, release, payment);
    record
}
```

The function shows the order of a sale:

1. **The Release must be the Pressing's, and its license `Authorized`.** `is_authorized` is true only once every track's recording admin has authorized the Release. An `Authorized` license cannot be revoked and its splits cannot change, so licensing cannot stop a release that is on sale.
2. **The payment must be exactly the price, in its currency.** Underpayment, overpayment, and any other currency abort. A free sale is paid with a zero `Balance`, such as `balance::zero<SUI>()`. Because the price never changes, the price a buyer reads before signing is the price the transaction pays.
3. **The Record is created through the Witness.** `record::new` checks that the Pressing still authorizes the Witness and has supply left, before any payment moves.
4. **The whole payment is forwarded**, as described in [Where the Money Goes](#where-the-money-goes).
5. **The Record is returned.** The transaction must transfer it or otherwise use it, for example `transfer::public_transfer(record, recipient)`, which allows buying it as a gift or sending it to a listener's [Player](/move/framework/player/).

The sale takes no shared input besides the Pressing, which it mutates, and the Release and license, which it only reads. If any later command in the transaction aborts, everything rolls back, including the Record's number and the forwarded funds.

The returned Record stores no sale data. The currency and price are in the sale's `RecordSoldEvent<Currency>`, and the buyer is that transaction's sender.

## Tips

Pay what you want is a price, often 0, plus a tip. The client adds the tip to the same programmable transaction with `release_license::forward`, which pays the same pools by the same splits (excerpt from the package README):

```move
let record = record_sale::sale::purchase(&mut pressing, &release, &license, price_payment);
release_license::release_license::forward(&license, &release, tip);
```

`record_sale` never takes more than the price and does not see the tip. The tip appears only in `release_license`'s `ReleaseRevenueForwardedEvent<Currency>`, and nothing on-chain depends on it. A forwarded tip is not refundable at the contract layer, so frontends should show its amount before the buyer signs.

A free sale lets any address take Records up to `max_supply` for the cost of gas and storage. This package has no per-buyer limit; gate claims with a separate Distributor if that matters.

## Where the Money Goes

`purchase` forwards the entire `Balance` with `release_license::forward`. No part stays in `record_sale`, the Pressing, or the Record, and Miso takes no fee in this package.

```text
payment ─→ release_license::forward ─→ track i's recording pool address   (payment × splits[i] ÷ 10,000, rounded down)
                                    └─→ the license's address               (rounding remainder)
```

1. Each track's share is sent to the canonical address of that recording's [royalty pool](/move/framework/royalty-pool/) in `Currency`. A track whose share rounds to 0 receives nothing.
2. The rounding remainder goes to the license's address. Anyone can call `release_license::redeem_and_forward` later to pay it out by the splits.
3. Funds at a pool address wait until that pool exists and has registered stakes. A settle folds them in, and the recording's share holders claim pro rata.
4. If the recording has a [Recording Revenue Share](/move/framework/recording-revenue-share/), the composition's cut is one of those stakes. Anyone can call `recording_revenue_share::sweep` to move it to the composition's pool, whose share holders claim after it settles.

A zero payment forwards nothing and emits no `ReleaseRevenueForwardedEvent`. The package links one exact version of `release_license`, so a later change to that package cannot redirect this package's proceeds. See [How Revenue Moves](/move/framework/#how-revenue-moves) for the whole path.

## The Witness

The authorized Distributor type is exactly `record_sale::witness::Witness`:

```move
public struct Witness() has drop;

// === Package Functions ===

public(package) fun new(): Witness {
    Witness()
}
```

Its only constructor is `public(package)`, and the package calls it only inside `purchase`, after the release, license, price, currency, and payment checks. The repository's privacy fixtures are two external packages that try to pack `Witness()` and call `witness::new()`; the package's `make verify` runs the tests and then `scripts/check-witness-privacy.sh`, which checks that both fail to compile with the expected visibility errors.

**The package must be immutable before any Pressing authorizes its Witness.** An upgrade could construct the same witness without the price and payment checks. Before authorizing it, confirm that the `UpgradeCap` of the `record_sale` package you link has been consumed with `package::make_immutable`.

`PressingAdminCap` and `ReleaseAdminCap` must stay address-owned or in trusted custody; never share or freeze either, which would make its authority public. The `PressingAdminCap` holder cannot reprice a sale, but can revoke the Witness or authorize another Distributor on the same Pressing.

## Views

| Function | Returns |
| --- | --- |
| `has_price(pressing)` | Whether the Pressing holds a `record_sale` price |
| `price(pressing)` | The price's `value`; aborts with `ENoPrice` when there is none |
| `currency(pressing)` | The price's currency as a `TypeName`; aborts with `ENoPrice` when there is none |

A price is independent of whether the Pressing is sold out or still authorizes the Witness. Check `pressing.is_distributor_authorized<Witness>()` and the Pressing's `supply` and `max_supply` as well before offering a purchase.

## Failure Cases

| Situation | Result |
| --- | --- |
| A Release other than the Pressing's | `purchase` and `authorize` abort with `EWrongRelease` (0). |
| A payment other than exactly the price, including any payment to a free sale | `purchase` aborts with `EWrongPayment` (1). |
| `authorize` for a Release with no license | Aborts with `ENoLicense` (2). |
| A license that is not `Authorized` | `purchase` aborts with `ENotAuthorized` (3). |
| A Pressing with no price | `purchase`, `price`, and `currency` abort with `ENoPrice` (4). |
| `authorize` after a revoke, in any currency | Aborts with `EPriceExists` (5). |
| A payment in a currency other than the price's | `purchase` aborts with `EWrongCurrency` (6). |
| Another Pressing's `PressingAdminCap` | `authorize` aborts in `record` with `pressing::EUnauthorized` (0), before any other check. |
| `authorize` while the Witness is authorized | Aborts in `record` with `pressing::EDistributorAlreadyAuthorized` (6). |
| A Pressing that has revoked, or never authorized, the Witness | `purchase` aborts in `record` with `pressing::EDistributorNotAuthorized` (3). |
| A sold-out Pressing | `purchase` aborts in `record` with `pressing::EMaxSupplyReached` (4). |
| An `Authorized` license for another Release | `purchase` aborts in `release_license::forward` with `EWrongRelease` (2). |

`purchase` checks in the order shown in its excerpt, so a sold-out Pressing with a wrong payment aborts with `EWrongPayment`.

## Events

| Event | Fields |
| --- | --- |
| `SaleAuthorizedEvent<Currency>` | `pressing_id`, `price` |
| `RecordSoldEvent<Currency>` | `record_id`, `pressing_id`, `price` |

The currency is each event's type parameter. `SaleAuthorizedEvent` carries the full price, so an indexer can track every Pressing's price from events without reading the dynamic field. A sale changes no `record_sale` state; besides `RecordSoldEvent`, `record` emits `RecordCreatedEvent<record_sale::witness::Witness>` for the new Record, carrying its Release and edition, and `release_license` emits [`ReleaseRevenueForwardedEvent<Currency>`](/move/framework/release-license/#events) when the payment pays any track. Revoking and restoring the Witness emit `record`'s distributor events, not a `record_sale` event.

## Deployment

The package's [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/Published.toml) records two generations:

- **Mainnet** `published-at = "0xdaa3e0c73a3be3c98e28738d44b172b2520fe7041f5c6e65d8c3e8aa77f4d569"`, recorded after the last change to the package's sources and manifest and to `record` and `release_license`, so it corresponds to the source on this page.
- **Testnet** `published-at = "0x6eb622211786516988c6ee8e7c0403b4ef64a8c004d654494122e29c103060e1"`, recorded before later source changes, so it predates this source.

The README makes no statement about an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and links `record` and `release_license` by local path; it can sell only Pressings of the `record` package it links. The 26 unit tests pass locally, including a complete sale that checks the forwarded amounts, and both privacy fixtures fail to compile as expected. The package has no localnet test, so funds arriving at pool addresses are not checked against a validator. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/README.md), modules [`sale`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/sources/sale.move) and [`witness`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/sources/witness.move), [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/tests/sale_tests.move), [architecture](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/docs/ARCHITECTURE.md), and [security notes](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/SECURITY.md).
