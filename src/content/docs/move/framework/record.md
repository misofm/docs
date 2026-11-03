---
title: Record
description: Issue numbered, capped editions of a release as Pressings, and press one numbered Record per purchase through authorized Distributors.
---

This page is for developers who issue editions of a release, write a Distributor that sells them, or read Records a listener holds. It explains how `record` derives a `Pressing` for each edition of a [Release](/move/music-protocol/release/), how each Pressing numbers and caps its Records, and which packages may press them.

## Editions and Records

Suppose the release admin of *The Bodyguard* soundtrack offers a first edition of 500 Records. That edition is one `Pressing`, derived from the Release. Each purchase presses one `Record`, numbered 1 to 500 within the edition. If a second edition follows, it is a separate Pressing with its own cap, and its numbering starts again at 1.

```move
public struct Pressing has key {
    id: UID,
    release_id: ID,
    edition: u16,
    supply: u32,
    max_supply: u32,
    distributors: VecSet<TypeName>,
}
```

A Pressing belongs to one release and one `edition`. `supply` counts the Records pressed so far and `max_supply` is the edition's lifetime cap. `distributors` holds the witness types allowed to press, one per sales mechanism. A Pressing has `key` but not `store`, and its module offers no transfer, so it can only be shared with `share`. Unrelated editions are unrelated objects and sell concurrently; presses within one edition serialize on its Pressing.

```move
public struct Record has key, store {
    id: UID,
    release_id: ID,
    pressing_id: ID,
    edition: u16,
    number: u32,
    purchase_currency: TypeName,
    purchase_price: u64,
    purchased_at_ms: u64,
}
```

A Record copies its lineage from the Pressing and stores its purchase provenance: the currency type, the price actually paid (0 for a free Record), and the `Clock` time. It does not store the buyer or any recipient. The buyer is the sender of the transaction that emitted its `RecordPurchasedEvent`, and the current owner is whoever holds it.

Both objects are derived, so their IDs follow from their parents without a registry:

```text
Release
└── PressingKey(edition) → Pressing
    └── RecordKey(number) → Record
```

`pressing::derive_address(release, edition)` and `record::derive_address(pressing, number)` compute them. There is no singleton object, table, or package initializer.

## Creating an Edition

The release admin creates a Pressing with the Release's `ReleaseAdminCap`:

```move
public fun new(
    release: &mut Release,
    release_cap: &ReleaseAdminCap,
    edition: u16,
    max_supply: u32,
): (Pressing, PressingAdminCap) {
    assert!(edition > 0, EZeroEdition);
    assert!(max_supply > 0, EZeroMaxSupply);
    let release_id = object::id(release);
    let release_uid = release.uid_mut(release_cap);
    assert!(
        edition == 1 || derived_object::exists(release_uid, PressingKey(edition - 1)),
        EPreviousEditionNotFound,
    );
    let mut id = derived_object::claim(release_uid, PressingKey(edition));
    let pressing_id = id.to_inner();
    let admin_cap = PressingAdminCap {
        id: derived_object::claim(&mut id, PressingAdminCapKey()),
        pressing_id,
    };
    emit(PressingCreatedEvent {
        pressing_id,
        pressing_admin_cap_id: object::id(&admin_cap),
        release_id,
        edition,
        max_supply,
    });
    let pressing = Pressing {
        id,
        release_id,
        edition,
        supply: 0,
        max_supply,
        distributors: vec_set::empty(),
    };
    (pressing, admin_cap)
}
```

The function shows four rules:

- **The release admin decides.** `release.uid_mut(release_cap)` checks the core cap, and the Pressing is claimed from the Release's UID. A Pressing does not check the release's [Release License](/move/framework/release-license/); a Distributor such as [`record_shop`](/move/framework/record-shop/) does that at sale time.
- **Editions are sequential.** Edition numbers are `u16` values from 1 through 65,535. Edition `n > 1` requires the claim for edition `n - 1` on the same Release. It does not require the previous edition to have sold out or been shared, so editions 1 and 2 can be created in one transaction.
- **Each edition exists once.** Claiming an edition twice aborts in `sui::derived_object`.
- **The cap is fixed.** `max_supply` is a positive `u32` with no setter. A different cap needs a new edition.

`new` returns the Pressing unshared with no distributors, alongside a `PressingAdminCap`. The cap is `key, store`, derived from the Pressing at `derive_admin_cap_address`, and gates `authorize_distributor`, `revoke_distributor`, and `uid_mut`, which extensions such as `record_shop`'s pricing use to store state on the Pressing. The release admin authorizes a Distributor, configures it, and calls `share` in the same transaction.

## Supply

Every press asks the Pressing for the next number. The check, a package-internal function:

```move
public(package) fun issue_number<Distributor: drop>(self: &mut Pressing): u32 {
    assert!(self.is_distributor_authorized<Distributor>(), EDistributorNotAuthorized);
    assert!(self.supply < self.max_supply, EMaxSupplyReached);
    self.supply = self.supply + 1;
    self.supply
}
```

`max_supply` caps lifetime issuance across every Distributor and currency. A Record's `number` equals the Pressing's `supply` after its press, so numbers run 1, 2, 3 with no gaps: a press that aborts rolls back with its transaction and uses no number. Destroying a Record does not lower `supply`, and replacing a Distributor does not reset it.

## Distributors

A Distributor is a package that decides when and for how much a Record may be pressed. The Pressing authorizes it by the type of a witness value, and the Distributor passes an instance of that type to `press`:

```move
public fun authorize_distributor<Distributor: drop>(self: &mut Pressing, cap: &PressingAdminCap) {
    self.authorize(cap);
    let distributor = type_name::with_defining_ids<Distributor>();
    assert!(!self.distributors.contains(&distributor), EDistributorAlreadyAuthorized);
    self.distributors.insert(distributor);
    emit(PressingDistributorAuthorizedEvent<Distributor> { pressing_id: cap.pressing_id });
}
```

`revoke_distributor` is the mirror image and aborts if the type is not authorized. A Pressing can authorize several Distributors at once. To migrate, authorize the replacement before revoking the old type; the edition keeps its Pressing ID and its numbering.

```move
public fun press<Distributor: drop, Currency>(
    pressing: &mut Pressing,
    _: Distributor,
    purchase_price: u64,
    clock: &Clock,
): Record {
    let number = pressing.issue_number<Distributor>();
    let pressing_id = object::id(pressing);
    let release_id = pressing.release_id();
    let edition = pressing.edition();
    let record = Record {
        id: derived_object::claim(pressing.package_uid_mut(), RecordKey(number)),
        release_id,
        pressing_id,
        edition,
        number,
        purchase_currency: type_name::with_defining_ids<Currency>(),
        purchase_price,
        purchased_at_ms: clock.timestamp_ms(),
    };
    emit(RecordPurchasedEvent<Distributor, Currency> {
        record_id: object::id(&record),
        pressing_id,
        release_id,
        edition,
        number,
        purchase_price,
        purchased_at_ms: record.purchased_at_ms,
    });
    record
}
```

`press` is public, so the witness value is the whole authorization. Whoever can construct an authorized `Distributor` can press Records at any price. Two consequences for a Distributor's author:

- **Keep the witness private.** Construct it only inside the function that has validated the sale, as `record_shop` does. A witness with a public constructor lets anyone press.
- **Make the package immutable before any Pressing authorizes it.** An upgrade could add code that constructs the same witness without the sale checks.

`record` trusts the Distributor for `Currency` and `purchase_price`; it records them as given. `press` returns the Record rather than transferring it, so the Distributor or the buyer's transaction delivers it, for example as a gift to another address.

## Owning and Extending a Record

`Record` has `key, store`, so its holder uses Sui's own operations: `transfer::public_transfer`, wrapping, sharing, or freezing. This package adds no transfer wrapper and no ownership checks.

**An `&Record` is not proof of ownership.** A shared or frozen Record is readable by anyone, so a policy that gates on holding a Record must establish how the Record is owned.

`uid_mut(record)` is open to whoever can pass the Record mutably, so extensions can attach data to it. Sharing a Record makes that access public. Anyone holding a Record can call `destroy`, which deletes it and emits `RecordDestroyedEvent`; detach any extensions first, or their dynamic fields become unreachable.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another release's `ReleaseAdminCap` | `new` aborts in the core with `release::EUnauthorized` (0). |
| Edition 0 | `new` aborts with `EZeroEdition` (1). |
| A `max_supply` of 0 | `new` aborts with `EZeroMaxSupply` (2). |
| Skipping an edition | `new` aborts with `EPreviousEditionNotFound` (5). |
| Creating an edition that exists | `new` aborts with `derived_object::EObjectAlreadyExists`. |
| Another Pressing's `PressingAdminCap` | `authorize_distributor`, `revoke_distributor`, and `uid_mut` abort with `EUnauthorized` (0). |
| Authorizing an authorized Distributor | Aborts with `EDistributorAlreadyAuthorized` (6). |
| Revoking a Distributor that is not authorized | Aborts with `EDistributorNotAuthorized` (3). |
| Pressing with a Distributor that is not authorized | `press` aborts with `EDistributorNotAuthorized` (3). |
| Pressing when `supply` has reached `max_supply` | `press` aborts with `EMaxSupplyReached` (4). |

`new` checks the edition and `max_supply` before the release cap.

## Events

| Event | Fields |
| --- | --- |
| `PressingCreatedEvent` | `pressing_id`, `pressing_admin_cap_id`, `release_id`, `edition`, `max_supply` |
| `PressingDistributorAuthorizedEvent<Distributor>` | `pressing_id` |
| `PressingDistributorRevokedEvent<Distributor>` | `pressing_id` |
| `RecordPurchasedEvent<Distributor, Currency>` | `record_id`, `pressing_id`, `release_id`, `edition`, `number`, `purchase_price`, `purchased_at_ms` |
| `RecordDestroyedEvent` | `record_id` |

The Distributor and currency are the event's type parameters, not payload fields. A new Pressing has supply 0 and no distributors, and `number` in each purchase event is the Pressing's supply after that press, so an indexer can rebuild every Pressing and Record from events. Sharing emits nothing.

## Deployment

The package's [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/Published.toml) records a mainnet publication at `published-at = "0xd77ce80f79ba3b3723931e6a5e6f6901105b23555a9f3c641dfda3c0123d210d"`. It was recorded after the last change to the package's sources and manifest, so it matches the source on this page. The recorded testnet entry predates those changes. The README makes no statement about an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), so its Pressings derive only from Releases of that core package. A Distributor works only with Pressings of the `record` package it links. The 42 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/README.md), modules [`pressing`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/sources/pressing.move) and [`record`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/sources/record.move), and [tests](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record/tests).
