---
title: Composition Credits
description: Credit each Party that wrote, arranged, adapted, or translated a composition, with a display name and roles.
---

This page is for developers who display or set a composition's writing credits. It explains how `composition_credits` stores one credit per [Party](/move/party-protocol/) on a [Composition](/move/music-protocol/composition/), which roles a credit can carry, and the rules for adding and removing one.

## Crediting a Writer

Dolly Parton wrote "I Will Always Love You". Suppose the composition's admin records that by crediting her Party as `Songwriter` with the display name `Dolly Parton`. The composition then holds a credit keyed by her Party ID:

```move
public struct CompositionCredits has store {
    credits: VecMap<ID, Credit<CompositionPartyRole>>,
}

public struct CompositionCreditsKey() has copy, drop, store;
```

The record is one dynamic field on the composition under `CompositionCreditsKey()`. It maps each credited Party ID to its credit, in the order the credits were added, with at most one credit per Party and at most 50 per composition. The first `add_credit` attaches the record and the `remove_credit` that empties it detaches it, so `has_credits(composition)` is true exactly when at least one credit exists.

Each credit is a [`credit`](/move/framework/credit/) `Credit<Role>`: a display name of 1 to 200 bytes and one or more distinct roles. The display name is stored on the credit itself; it is not read from the Party, so it can differ from the Party's [name](/move/framework/party-name/).

## Roles

```move
public enum CompositionPartyRole has copy, drop, store {
    Adapter,
    Arranger,
    Composer,
    Lyricist,
    Songwriter,
    Translator,
}
```

The enum is closed, and each role is built with its constructor, such as `composition_party_role::new_songwriter_role()`. A credit can combine roles, such as `Composer` and `Lyricist`. Because `credit::new` rejects duplicate roles, a credit holds one to six of them. There is no publisher role: these are writing credits, and publishing interests are not recorded here. Roles are unit variants, so each is encoded as its variant index in the declaration order above.

Recordings keep their own performance and production credits in [`recording_credits`](/move/framework/recording-credits/); a recording does not inherit the composition's credits.

## Adding and Removing Credits

The composition admin builds the credit and adds it in one programmable transaction:

1. Build each role with its `composition_party_role::new_*_role()` constructor.
2. Call `credit::new(display_name, roles)`.
3. Call `add_credit(composition, cap, party, credit)` with the composition's admin cap and the credited Party.

```move
public fun add_credit<CompositionShare>(
    composition: &mut Composition<CompositionShare>,
    cap: &CompositionAdminCap<CompositionShare>,
    party: &Party,
    credit: Credit<CompositionPartyRole>,
) {
    let composition_id = object::id(composition);
    let party_id = object::id(party);
    let display_name = *credit.display_name();
    let roles = *credit.roles();
    let uid = composition.uid_mut(cap);
    if (!df::exists(uid, CompositionCreditsKey())) {
        df::add(uid, CompositionCreditsKey(), CompositionCredits { credits: vec_map::empty() });
    };
    let record: &mut CompositionCredits = df::borrow_mut(uid, CompositionCreditsKey());
    assert!(record.credits.length() < MAX_CREDITS, ETooManyCredits);
    assert!(!record.credits.contains(&party_id), EPartyAlreadyCredited);
    record.credits.insert(party_id, credit);
    emit(CompositionCreditAddedEvent { composition_id, party_id, display_name, roles });
}
```

- **Only the composition's admin writes.** `uid_mut(cap)` accepts only the `CompositionAdminCap` of the composition's share type; a cap for another composition does not type-check.
- **The Party must exist, but it is not asked.** `add_credit` takes `&Party` and keys the credit by its object ID, so the Party has to exist. The credited Party's admin does not sign. A credit is the composition admin's attribution, not the Party's acknowledgement. It confers no shares or royalties; no economics read it.
- **Capacity is checked before duplicates.** At 50 credits, re-crediting a Party already present reports `ETooManyCredits`.

There is no update function. To change a credit, call `remove_credit(composition, cap, party_id)` and then `add_credit` with the new credit, in the same transaction so readers never see the Party uncredited. The re-added credit moves to the end of the order. No write is a silent no-op: crediting a Party twice, even with an identical credit, and removing an uncredited Party both abort.

## Reading Credits

`has_credits(composition)` and `credits(composition)` are permissionless. `credits` returns the `&VecMap<ID, Credit<CompositionPartyRole>>` in insertion order and aborts when no record is attached, so check `has_credits` first. Read each credit's `display_name()` and `roles()` from the [`credit`](/move/framework/credit/) library.

## Failure Cases

| Situation | Result |
| --- | --- |
| `add_credit` with 50 credits already held | Aborts with `ETooManyCredits` (0). |
| Crediting a Party that already has a credit | `add_credit` aborts with `EPartyAlreadyCredited` (1). |
| `credits` or `remove_credit` with no record attached | Aborts with `ENoCredits` (2). |
| Removing a Party that has no credit | `remove_credit` aborts with `EPartyNotFound` (3). |
| An invalid display name, no roles, or a duplicate role | `credit::new` aborts; see [`credit`](/move/framework/credit/). |
| A cap for a different composition | Does not type-check: the cap's share type must match the composition's. |

`add_credit` and `remove_credit` check the cap before any stored state.

## Events

| Event | Fields |
| --- | --- |
| `CompositionCreditAddedEvent` | `composition_id`, `party_id`, `display_name`, `roles` (in stored order) |
| `CompositionCreditRemovedEvent` | `composition_id`, `party_id` |

Every successful write emits exactly one event. Replaying them in order rebuilds the credit list and its order; the record exists while any replayed credit remains.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/Published.toml) records a mainnet generation, `published-at = "0xe6f27140ed9512299942c388c83b1eadbaca9298bbd152100a81baac441120aa"`, recorded after the last change to the package's sources, so it is the generation this page describes. Its testnet entry, `published-at = "0xac64c8a52fd7adb31e89eeda184ba8313c8c4dc43d1a98c64717565273c828fe"`, was recorded for an earlier generation and predates this source. The package README makes no statement about an audit. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), and depends on `credit` by local path. The 13 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/README.md), modules [`composition_credits`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/sources/composition_credits.move) and [`composition_party_role`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/sources/composition_party_role.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_credits/tests).
