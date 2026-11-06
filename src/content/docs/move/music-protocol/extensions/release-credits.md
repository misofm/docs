---
title: Release Credits
description: Bill each credited Party on a Release as a primary or featured artist.
---

This page is for developers who display or set a release's artist billing. It explains how `release_credits` stores one credit per [Party](/move/party-protocol/) on a [Release](/move/music-protocol/release/), what a credit holds, and the rules for adding and removing one.

## Top-Line Billing

Suppose the release admin of *The Bodyguard* soundtrack bills Whitney Houston's Party as its primary artist. The release stores that billing as a credit keyed by her Party ID:

```move
public struct ReleaseCredits has store {
    credits: VecMap<ID, Credit<ReleasePartyRole>>,
}

public struct ReleaseCreditsKey() has copy, drop, store;
```

The record is one dynamic field on the release under `ReleaseCreditsKey()`. It maps each credited Party ID to its credit, in the order the credits were added, with at most one credit per Party and at most 50 per release. The record is attached by the first `add_credit` and removed by the `remove_credit` that empties it, so `has_credits(release)` is true exactly when at least one credit exists.

A credit is a [`credit`](/move/framework/credit/) `Credit<Role>`: a display name of 1 to 200 bytes and a list of distinct roles. Here the role type is the package's own enum, and a release credit carries exactly one role:

```move
public enum ReleasePartyRole has copy, drop, store {
    Primary,
    Featured,
}
```

The display name is the billing name on this release. It is stored with the credit and can differ from the Party's [`party_name`](/move/party-protocol/extensions/party-name/), so a release keeps the name it was billed under after the Party is renamed.

Release billing is a display claim. No economics read it, and it is separate from the performers and producers that [`recording_credits`](/move/music-protocol/extensions/recording-credits/) records on each recording.

## Adding a Credit

The `ReleaseAdminCap` holder builds the credit and adds it in one programmable transaction:

1. Call `release_party_role::new_primary_role()` or `new_featured_role()`.
2. Call `credit::new(display_name, vector[role])`.
3. Call `release_credits::add_credit(release, cap, party, credit)` with the shared Party.

```move
public fun add_credit(
    release: &mut Release,
    cap: &ReleaseAdminCap,
    party: &Party,
    credit: Credit<ReleasePartyRole>,
) {
    assert!(credit.roles().length() == CREDIT_ROLE_COUNT, EInvalidCreditRoleCount);
    let release_id = object::id(release);
    let party_id = object::id(party);
    let display_name = *credit.display_name();
    let role = credit.roles()[0];
    let uid = release.uid_mut(cap);
    if (!df::exists(uid, ReleaseCreditsKey())) {
        df::add(uid, ReleaseCreditsKey(), ReleaseCredits { credits: vec_map::empty() });
    };
    let record: &mut ReleaseCredits = df::borrow_mut(uid, ReleaseCreditsKey());
    assert!(record.credits.length() < MAX_CREDITS, ETooManyCredits);
    assert!(!record.credits.contains(&party_id), EPartyAlreadyCredited);
    record.credits.insert(party_id, credit);
    emit(ReleaseCreditAddedEvent { release_id, party_id, display_name, role });
}
```

The function shows the guard order: the role count is checked before the cap, then the stored record. Passing `&Party` proves the Party exists, but **the credited Party's admin takes no part**. A release admin can bill any Party without its consent, so applications choose which billings to trust.

The capacity check runs before the duplicate check, so adding a Party already credited on a full release aborts with `ETooManyCredits`.

## Changing or Removing a Credit

`remove_credit(release, cap, party_id)` removes one Party's credit by ID; removing the last credit removes the record. There is no update function, and no write is a silent no-op: crediting a Party again, even with an identical credit, aborts.

To change a Party's role or billing name, remove its credit and add a new one in the same transaction. The new credit moves to the end of the order, so re-add the credits after it as well if the order matters.

`credits(release)` returns the `&VecMap<ID, Credit<ReleasePartyRole>>` and aborts with `ENoCredits` when nothing is credited.

## Failure Cases

| Situation | Result |
| --- | --- |
| A credit with more than one role | `add_credit` aborts with `EInvalidCreditRoleCount` (4) before the cap is checked. |
| Another release's admin cap | `add_credit` and `remove_credit` abort with `miso_music::release::EUnauthorized` (0). |
| A release that already has 50 credits | `add_credit` aborts with `ETooManyCredits` (0). |
| A Party already credited | `add_credit` aborts with `EPartyAlreadyCredited` (1). |
| No credits on the release | `remove_credit` and `credits` abort with `ENoCredits` (2). |
| A Party that is not credited | `remove_credit` aborts with `EPartyNotFound` (3). |

An empty or over-long display name, no roles, or a repeated role abort earlier, in `credit::new`; see [Credit](/move/framework/credit/).

## Events

| Event | Fields |
| --- | --- |
| `ReleaseCreditAddedEvent` | `release_id`, `party_id`, `display_name`, `role` |
| `ReleaseCreditRemovedEvent` | `release_id`, `party_id` |

The credit order and `has_credits` follow from replaying these events in order.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/Published.toml) records a mainnet publication at `0x56a93c545cb2eb67c739a0db7181d7bba70c5e2999ec5ce30787a880079b2919`. It was recorded after the last change to this package's source and manifest and to its local dependency `credit`, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). The 22 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/README.md), modules [`release_credits`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/sources/release_credits.move) and [`release_party_role`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/sources/release_party_role.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_credits/tests).
