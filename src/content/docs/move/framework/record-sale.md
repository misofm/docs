---
title: Record Sale
description: Sell a Pressing's Records at one fixed price, forwarding payments to the tracks' royalty pools.
---

Sell Records of a [Pressing](/move/framework/record/) at a fixed price. `record_sale` authorizes and prices the Pressing, validates each purchase, and forwards the whole payment to the tracks' royalty pools.

## One Price, Set Once

*The Bodyguard* soundtrack's release admin sells edition 1 as a Pressing for exactly 1 SUI. `record_sale` stores the price as one dynamic field on the Pressing:

```move
public struct Price has copy, drop, store {
    currency: TypeName,
    value: u64,
}

public struct PriceKey() has copy, drop, store;
```

A Pressing is on sale while `record_sale::witness::Witness` is an authorized Distributor on it and it holds a `Price` under `PriceKey()`. There is no global sale, listing, or registry object.

The key is not currency-typed: a Pressing has **one price in one currency, forever**. You cannot change or remove the price or add a currency. A price of 0 is free. A buyer who wants to pay more sends a [tip](#tips). A different price or currency needs a different Pressing or edition, matching `record`'s rule that access never depends on what was spent.

Every sale draws on the Pressing's `max_supply`, shared with every other Distributor. Destroying a Record does not restore capacity.

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

- **The `PressingAdminCap` is checked first.** Another Pressing's cap aborts in `record` in `authorize_distributor`, before any other check.
- **The Release must be the Pressing's and licensed.** `has_license` is true once the release admin creates the Release's [Release License](/move/framework/release-license/). It need not be `Authorized` yet. Tracks can authorize before or after.
- **The price is written once.** While the Witness is authorized, `authorize` aborts in `record` with `EDistributorAlreadyAuthorized`. After a revoke it aborts with `EPriceExists` in any currency, so a revoke cannot reprice.

Run these steps in one programmable transaction, authorizing before sharing the Pressing (excerpt from the package README; `splits` holds one basis-point split per track):

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

`pressing` and `pressing_cap` come from `pressing::new` earlier in the transaction. Each track's recording admin then calls `release_license::authorize`. Nothing sells until every track has.

**Authorize through `authorize`, not `authorize_distributor`.** `Witness` is public, so a `PressingAdminCap` holder can call `pressing.authorize_distributor<Witness>(cap)` directly. That leaves no price: every purchase aborts with `ENoPrice` and a later `authorize` aborts with `EDistributorAlreadyAuthorized`. Recover with `revoke_distributor<Witness>` then `authorize` in one transaction.

### Stopping and Restoring a Sale

There is no pause and no price change. To stop sales early, call `record`'s `pressing.revoke_distributor<Witness>(cap)`. It stops new sales immediately and leaves sold Records untouched. The price stays on the Pressing, so `authorize_distributor<Witness>` restores the sale at the original price. Otherwise sales end at sell-out.

## Buying a Record

Pass the shared Pressing, its Release, the Release's `ReleaseLicense`, and a `Balance<Currency>`:

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

1. **The Release must be the Pressing's, and its license `Authorized`.** `is_authorized` is true only once every track's recording admin has authorized the Release. An `Authorized` license cannot be revoked and its splits cannot change, so licensing cannot stop a release on sale.
2. **The payment must be exactly the price, in its currency.** Underpayment, overpayment, and other currencies abort. Pay a free sale with a zero `Balance`, such as `balance::zero<SUI>()`. The price never changes, so the price a buyer reads is the price paid.
3. **The Record is created through the Witness.** `record::new` checks that the Pressing still authorizes the Witness and has supply left, before any payment moves.
4. **The whole payment is forwarded.** See [Where the Money Goes](#where-the-money-goes).
5. **The Record is returned.** Transfer or use it in the same transaction, for example `transfer::public_transfer(record, recipient)`, to gift it or send it to a listener's [Player](/move/framework/player/).

The sale mutates only the Pressing and reads the Release and license. If a later command aborts, everything rolls back, including the Record's number and the forwarded funds. The Record stores no sale data: currency and price are in `RecordSoldEvent<Currency>`, and the buyer is the transaction sender.

## Tips

Pay-what-you-want is a price, often 0, plus a tip. The client adds the tip to the same programmable transaction with `release_license::forward`, which pays the same pools by the same splits (excerpt from the package README):

```move
let record = record_sale::sale::purchase(&mut pressing, &release, &license, price_payment);
release_license::release_license::forward(&license, &release, tip);
```

`record_sale` never takes more than the price and does not see the tip. It appears only in `release_license`'s `ReleaseRevenueForwardedEvent<Currency>`, and nothing on-chain depends on it. A forwarded tip is not refundable at the contract layer, so frontends should show its amount before the buyer signs.

A free sale lets any address take Records up to `max_supply` for gas and storage. There is no per-buyer limit. Gate claims with a separate Distributor if that matters.

## Where the Money Goes

`purchase` forwards the entire `Balance` with `release_license::forward`. Nothing stays in `record_sale`, the Pressing, or the Record. Miso takes no fee here.

```text
payment ─→ release_license::forward ─→ track i's recording pool address   (payment × splits[i] ÷ 10,000, rounded down)
                                    └─→ the license's address               (rounding remainder)
```

1. Each track's share goes to the canonical address of that recording's [royalty pool](/move/framework/royalty-pool/) in `Currency`. A track whose share rounds to 0 receives nothing.
2. The rounding remainder goes to the license's address. Anyone can call `release_license::redeem_and_forward` later to pay it out by the splits.
3. Funds at a pool address wait until that pool exists and has registered stakes. A settle folds them in, and the recording's share holders claim pro rata.
4. With a [Recording Revenue Share](/move/framework/recording-revenue-share/), the composition's cut is one of those stakes. Anyone can call `recording_revenue_share::sweep` to move it to the composition's pool, whose holders claim after it settles.

A zero payment forwards nothing and emits no `ReleaseRevenueForwardedEvent`. The package links one exact version of `release_license`, so a later change there cannot redirect proceeds. See [How Revenue Moves](/move/framework/#how-revenue-moves) for the whole path.

## The Witness

The authorized Distributor type is exactly `record_sale::witness::Witness`:

```move
public struct Witness() has drop;

// === Package Functions ===

public(package) fun new(): Witness {
    Witness()
}
```

Its only constructor is `public(package)`, called only inside `purchase`, after the release, license, price, currency, and payment checks. Two external fixture packages try to pack `Witness()` and call `witness::new()`. `make verify` runs the tests, then `scripts/check-witness-privacy.sh`, which checks that both fail to compile with the expected visibility errors.

**The package must be immutable before any Pressing authorizes its Witness.** An upgrade could construct the witness without the price and payment checks. Before authorizing, confirm the linked `record_sale` package's `UpgradeCap` was consumed with `package::make_immutable`.

Keep `PressingAdminCap` and `ReleaseAdminCap` address-owned or in trusted custody. Never share or freeze either, which makes its authority public. The `PressingAdminCap` holder cannot reprice a sale but can revoke the Witness or authorize another Distributor.

## Views

| Function | Returns |
| --- | --- |
| `has_price(pressing)` | Whether the Pressing holds a `record_sale` price |
| `price(pressing)` | The price's `value`; aborts with `ENoPrice` when there is none |
| `currency(pressing)` | The price's currency as a `TypeName`; aborts with `ENoPrice` when there is none |

A price persists through sell-out and revocation. Before offering a purchase, also check `pressing.is_distributor_authorized<Witness>()`, `supply`, and `max_supply`.

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

`purchase` checks in the order of its excerpt, so a sold-out Pressing with a wrong payment aborts with `EWrongPayment`.

## Events

| Event | Fields |
| --- | --- |
| `SaleAuthorizedEvent<Currency>` | `pressing_id`, `price` |
| `RecordSoldEvent<Currency>` | `record_id`, `pressing_id`, `price` |

- The currency is each event's type parameter.
- `SaleAuthorizedEvent` carries the full price, so indexers need not read the dynamic field.
- A sale changes no `record_sale` state. Besides `RecordSoldEvent`, `record` emits `RecordCreatedEvent<record_sale::witness::Witness>` with the Release and edition, and `release_license` emits [`ReleaseRevenueForwardedEvent<Currency>`](/move/framework/release-license/#events) when the payment pays any track.
- Revoking and restoring the Witness emit `record`'s distributor events, not a `record_sale` event.

## Deployment

[`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/Published.toml) records two generations:

- **Mainnet** `published-at = "0xdaa3e0c73a3be3c98e28738d44b172b2520fe7041f5c6e65d8c3e8aa77f4d569"`, recorded after the last change to this package's sources and manifest and to `record` and `release_license`, so it matches this source.
- **Testnet** `published-at = "0x6eb622211786516988c6ee8e7c0403b4ef64a8c004d654494122e29c103060e1"`, recorded before later source changes, so it predates this source.

The README states no audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and links `record` and `release_license` by local path. It sells only Pressings of the `record` package it links. The 26 unit tests pass locally, including a complete sale that checks forwarded amounts, and both privacy fixtures fail to compile as expected. No localnet test checks funds arriving at pool addresses against a validator. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/README.md), modules [`sale`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/sources/sale.move) and [`witness`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/sources/witness.move), [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/tests/sale_tests.move), [architecture](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/docs/ARCHITECTURE.md), and [security notes](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record_sale/SECURITY.md).
