---
title: Record
description: Issue numbered, capped editions of a release as Pressings, and create one numbered Record per sale through authorized Distributors.
---

This page is for developers who issue editions of a release, write a Distributor that sells them, or read Records a listener holds. It explains how `record` derives a `Pressing` for each edition of a [Release](/move/music-protocol/release/), how each Pressing numbers and caps its Records, and which packages may create them.

## Editions and Records

Suppose the release admin of *The Bodyguard* soundtrack offers a first edition of 500 Records. That edition is one `Pressing`, derived from the Release. Each sale creates one `Record`, numbered 1 to 500 within the edition. If a second edition follows, it is a separate Pressing with its own cap, and its numbering starts again at 1.

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

A Pressing belongs to one release and one `edition`. `supply` counts the Records created so far and `max_supply` is the edition's lifetime cap. `distributors` holds the witness types allowed to create Records, one per sales mechanism. A Pressing has `key` but not `store`, and its module offers no transfer, so it can only be shared with `share`. Unrelated editions are unrelated objects and sell concurrently; sales within one edition serialize on its Pressing.

```move
public struct Record has key, store {
    id: UID,
    release_id: ID,
    pressing_id: ID,
    edition: u16,
    number: u32,
}
```

A Record copies its lineage from the Pressing and adds its number. It stores no purchase data: no currency, price, time, buyer, or recipient. The buyer is the sender of the transaction that emitted its `RecordCreatedEvent`, and the current owner is whoever holds it. A Distributor reports sale details such as the currency and price in its own event, as [`record_sale`](/move/framework/record-sale/) does with `RecordSoldEvent<Currency>`.

**Access never depends on what was spent.** Gate a feature on a Record's `pressing_id` or `edition`, not on a price. To offer a tier, make it its own Pressing or edition.

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

- **The release admin decides.** `release.uid_mut(release_cap)` checks the core cap, and the Pressing is claimed from the Release's UID. A Pressing does not check the release's [Release License](/move/framework/release-license/); a Distributor such as [`record_sale`](/move/framework/record-sale/) does that at sale time.
- **Editions are sequential.** Edition numbers are `u16` values from 1 through 65,535. Edition `n > 1` requires the claim for edition `n - 1` on the same Release. It does not require the previous edition to have sold out or been shared, so editions 1 and 2 can be created in one transaction.
- **Each edition exists once.** Claiming an edition twice aborts in `sui::derived_object`.
- **The cap is fixed.** `max_supply` is a positive `u32` with no setter. A different cap needs a new edition.

`new` returns the Pressing unshared with no distributors, alongside a `PressingAdminCap`. The cap is `key, store`, derived from the Pressing at `derive_admin_cap_address`, and gates `authorize_distributor`, `revoke_distributor`, and `uid_mut`, which extensions such as `record_sale`'s price use to store state on the Pressing. The release admin authorizes a Distributor, configures it, and calls `share` in the same transaction.

## Supply

Every new Record asks the Pressing for the next number. The check, a package-internal function:

```move
public(package) fun issue_number<Distributor: drop>(self: &mut Pressing): u32 {
    assert!(self.is_distributor_authorized<Distributor>(), EDistributorNotAuthorized);
    assert!(self.supply < self.max_supply, EMaxSupplyReached);
    self.supply = self.supply + 1;
    self.supply
}
```

`max_supply` caps lifetime issuance across every Distributor and currency. A Record's `number` equals the Pressing's `supply` after it is created, so numbers run 1, 2, 3 with no gaps: a creation that aborts rolls back with its transaction and uses no number. Destroying a Record does not lower `supply`, and replacing a Distributor does not reset it.

## Distributors

A Distributor is a package that decides when and for how much a Record may be created. The Pressing authorizes it by the type of a witness value, and the Distributor passes an instance of that type to `record::new`:

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

`record::new` is public, so the witness value is the whole authorization. Whoever can construct an authorized `Distributor` can create Records without paying anything. Two consequences for a Distributor's author:

- **Keep the witness private.** Construct it only inside the function that has validated the sale, as `record_sale` does. A witness with a public constructor lets anyone create Records.
- **Make the package immutable before any Pressing authorizes it.** An upgrade could add code that constructs the same witness without the sale checks.

The Distributor validates payment and sale state; `record` sees no payment and records none. `new` returns the Record rather than transferring it, so the Distributor or the buyer's transaction delivers it, for example as a gift to another address or to a listener's [Player](/move/framework/player/).

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

The Distributor is the event's type parameter, not a payload field. A new Pressing has supply 0 and no distributors, and `number` in each `RecordCreatedEvent` is the Pressing's supply after that Record, so an indexer can rebuild every Pressing and Record from events. `RecordDestroyedEvent` joins to `RecordCreatedEvent` by `record_id` and does not change supply. Sharing emits nothing, and distributor events fire only when the set changes. No `record` event carries a price or currency; read those from the Distributor's own event.

## Deployment

The package's [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/Published.toml) records two generations:

- **Mainnet** `published-at = "0xec8159f9edca64a8788e17e8bddbf54aa4c980bfa23f32bda3589e0212347024"`, recorded after the last change to the package's sources and manifest, so it corresponds to the source on this page.
- **Testnet** `published-at = "0xf51af0e4a29d764a6880db65d99aaa7d1802774f7be18e7220a05a2d673b4743"`, recorded before later source changes, including the removal of purchase data from `Record`, so it predates this source.

The README makes no statement about an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), so its Pressings derive only from Releases of that core package. A Distributor works only with Pressings of the `record` package it links. The 40 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/README.md), modules [`pressing`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/sources/pressing.move) and [`record`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/sources/record.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/record/tests).
