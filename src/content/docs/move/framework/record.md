---
title: Record
description: Capped, numbered editions of a release (Pressings) and one numbered Record per sale.
---

`record` derives a `Pressing` per edition of a [Release](/move/music-protocol/release/), caps and numbers its Records, and lets only authorized Distributors create them. Use it to sell limited editions, write a Distributor, or read a listener's Records.

## Editions and Records

A first edition of 500 Records of *The Bodyguard* soundtrack is one `Pressing`. Each sale creates one `Record`, numbered 1 to 500. A second edition is a separate Pressing with its own cap, numbered from 1.

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

`supply` counts Records created. `max_supply` is the lifetime cap. `distributors` holds the witness types allowed to create Records, one per sales mechanism. A Pressing has `key` but not `store` and no transfer, so it can only be shared with `share`. Editions sell concurrently. Sales within one edition serialize on its Pressing.

```move
public struct Record has key, store {
    id: UID,
    release_id: ID,
    pressing_id: ID,
    edition: u16,
    number: u32,
}
```

A Record copies its lineage from the Pressing and adds its number. It stores no currency, price, time, buyer, or recipient. The buyer is the sender of the transaction that emitted its `RecordCreatedEvent`. The owner is its holder. A Distributor reports sale details in its own event, as [`record_sale`](/move/framework/record-sale/) does with `RecordSoldEvent<Currency>`.

**Access never depends on what was spent.** Gate on a Record's `pressing_id` or `edition`, not a price. Make each tier its own Pressing or edition.

IDs derive from parents, with no registry:

```text
Release
└── PressingKey(edition) → Pressing
    └── RecordKey(number) → Record
```

Compute them with `pressing::derive_address(release, edition)` and `record::derive_address(pressing, number)`. There is no singleton, table, or package initializer.

## Creating an Edition

The release admin creates a Pressing with the `ReleaseAdminCap`:

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

Rules:

- **The release admin decides.** `release.uid_mut(release_cap)` checks the core cap, and the Pressing is claimed from the Release's UID. A Pressing does not check the [Release License](/move/framework/release-license/). A Distributor such as [`record_sale`](/move/framework/record-sale/) does, at sale time.
- **Editions are sequential.** `u16`, 1 through 65,535. Edition `n > 1` requires the claim for edition `n - 1` on the same Release. The previous edition need not have sold out or been shared, so editions 1 and 2 can be created in one transaction.
- **Each edition exists once.** Claiming it twice aborts in `sui::derived_object`.
- **The cap is fixed.** `max_supply` is a positive `u32` with no setter. A different cap needs a new edition.

`new` returns the unshared Pressing with no distributors, plus a `PressingAdminCap` (`key, store`, derived from the Pressing at `derive_admin_cap_address`). The cap gates `authorize_distributor`, `revoke_distributor`, and `uid_mut`, which extensions such as `record_sale`'s price use to store state on the Pressing. In one transaction, authorize and configure a Distributor, then call `share`.

## Supply

Each new Record takes the next number from the Pressing (package-internal):

```move
public(package) fun issue_number<Distributor: drop>(self: &mut Pressing): u32 {
    assert!(self.is_distributor_authorized<Distributor>(), EDistributorNotAuthorized);
    assert!(self.supply < self.max_supply, EMaxSupplyReached);
    self.supply = self.supply + 1;
    self.supply
}
```

`max_supply` caps lifetime issuance across every Distributor and currency. A Record's `number` equals the Pressing's `supply` after creation, so numbers run 1, 2, 3 with no gaps. An aborted creation rolls back and uses no number. Destroying a Record or replacing a Distributor does not lower `supply`.

## Distributors

A Distributor is a package that decides when and for how much a Record is created. The Pressing authorizes it by witness type. The Distributor passes an instance to `record::new`:

```move
public fun authorize_distributor<Distributor: drop>(self: &mut Pressing, cap: &PressingAdminCap) {
    self.authorize(cap);
    let distributor = type_name::with_defining_ids<Distributor>();
    assert!(!self.distributors.contains(&distributor), EDistributorAlreadyAuthorized);
    self.distributors.insert(distributor);
    emit(PressingDistributorAuthorizedEvent<Distributor> { pressing_id: cap.pressing_id });
}
```

`revoke_distributor` mirrors it and aborts if the type is not authorized. A Pressing can authorize several Distributors. To migrate, authorize the replacement, then revoke the old type. The edition keeps its Pressing ID and numbering.

```move
public fun new<Distributor: drop>(pressing: &mut Pressing, _: Distributor): Record {
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
    };
    emit(RecordCreatedEvent<Distributor> {
        record_id: object::id(&record),
        pressing_id,
        release_id,
        edition,
        number,
    });
    record
}
```

`record::new` is public, so the witness is the whole authorization: whoever can construct an authorized `Distributor` can create Records without paying. Distributor authors:

- **Keep the witness private.** Construct it only inside the function that validated the sale, as `record_sale` does. A public constructor lets anyone create Records.
- **Make the package immutable before any Pressing authorizes it.** An upgrade could construct the witness without the sale checks.

The Distributor validates payment and sale state. `record` sees none. `new` returns the Record untransferred. The Distributor or the buyer's transaction delivers it, for example as a gift or to a listener's [Player](/move/framework/player/).

## Owning and Extending a Record

`Record` has `key, store`, so its holder uses Sui's own operations: `transfer::public_transfer`, wrapping, sharing, freezing. This package adds no transfer wrapper or ownership checks.

**An `&Record` is not proof of ownership.** Anyone can read a shared or frozen Record, so a policy that gates on holding one must establish how it is owned.

`uid_mut(record)` is open to whoever can pass the Record mutably, so extensions can attach data to it. Sharing a Record makes that access public. Any holder can call `destroy`, which deletes it and emits `RecordDestroyedEvent`. Detach extensions first, or their dynamic fields become unreachable.

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
| Creating a Record with a Distributor that is not authorized | `record::new` aborts with `EDistributorNotAuthorized` (3). |
| Creating a Record when `supply` has reached `max_supply` | `record::new` aborts with `EMaxSupplyReached` (4). |

`new` checks the edition and `max_supply` before the release cap.

## Events

| Event | Fields |
| --- | --- |
| `PressingCreatedEvent` | `pressing_id`, `pressing_admin_cap_id`, `release_id`, `edition`, `max_supply` |
| `PressingDistributorAuthorizedEvent<Distributor>` | `pressing_id` |
| `PressingDistributorRevokedEvent<Distributor>` | `pressing_id` |
| `RecordCreatedEvent<Distributor>` | `record_id`, `pressing_id`, `release_id`, `edition`, `number` |
| `RecordDestroyedEvent` | `record_id` |

- The Distributor is the event's type parameter, not a payload field.
- A new Pressing has supply 0 and no distributors. `RecordCreatedEvent.number` is the supply after that Record. Indexers rebuild every Pressing and Record from events.
- `RecordDestroyedEvent` joins to `RecordCreatedEvent` by `record_id` and does not change supply.
- Sharing emits nothing. Distributor events fire only when the set changes.
- Price and currency come from the Distributor's event, never a `record` event.

## Deployment

[`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/Published.toml) records two generations:

- **Mainnet** `published-at = "0xec8159f9edca64a8788e17e8bddbf54aa4c980bfa23f32bda3589e0212347024"`, recorded after the last source and manifest change, so it matches this page.
- **Testnet** `published-at = "0xf51af0e4a29d764a6880db65d99aaa7d1802774f7be18e7220a05a2d673b4743"`, recorded before later source changes, including removing purchase data from `Record`, so it predates this source.

The README makes no audit statement. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), so Pressings derive only from Releases of that core. A Distributor works only with Pressings of the `record` package it links. The 40 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/README.md), modules [`pressing`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/sources/pressing.move) and [`record`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/sources/record.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/tests).
