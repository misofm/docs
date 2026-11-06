---
title: Party
description: A reusable identity with a stable ID and capability-controlled administration, with names and profiles left to extensions.
---

This page is for developers who credit people, bands, labels, or organizations on music works. It explains what a core Party is, how its admin capability works, and where names, profiles, and group membership live.

A Party identifies an entity that can be credited across works. In the [overview's example](/move/music-protocol/), Dolly Parton can be one Party, credited as the writer of "I Will Always Love You" and as the artist on her recording of it, while Whitney Houston is another Party, credited on hers. Music objects identify works; the Party identifies who is being credited.

Party lives in the separate [`miso_party` package](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Core does not classify a Party as an individual or a group, prescribe a member collection, or store any display data.

## Identity and Administration

The complete core object is an ID:

```move
public struct Party has key {
    id: UID,
}
```

A Party's name, biography, genres, and group memberships are optional [extensions](/move/framework/#party-extensions). Renaming a Party changes an extension field, never the ID that credits refer to.

`party::new(ctx)` returns the Party and its admin capability and emits `PartyCreatedEvent` with both IDs. `Party` has only `key` and its module offers no transfer, so the creating transaction must call `party.share()`. `share` takes no capability and emits nothing.

```move
public struct PartyAdminCap has key, store {
    id: UID,
    party_id: ID,
}
```

`PartyAdminCap` is a transferable bearer object bound to one Party ID. Its ID is derived from the Party, so each Party has exactly one admin cap, and whoever holds it administers the Party.

All administration goes through one check:

```move
public fun uid_mut(self: &mut Party, cap: &PartyAdminCap): &mut UID {
    assert!(cap.party_id == object::id(self), EUnauthorized);
    &mut self.id
}
```

Extensions attach their typed dynamic fields through this UID, so a mismatched cap aborts with `EUnauthorized` (0) before any extension logic runs. An extension that keeps its own state outside the Party can check a cap against that state with `cap.party_id()`, without the Party. The public `authorize` function of earlier generations no longer exists.

Holding the cap does not transfer shares, grant a music object's admin capability, or prove a rights agreement. Those relationships have their own rules.

## Names Are Claims

The display name lives in the [`party_name` extension](/move/framework/party-name/). A name is an unverified claim by the Party's administrator. The protocol does not establish a real-world identity or guarantee that two Parties with the same name represent the same entity.

## Optional Group Membership

A band can use the optional [`party_group` extension](/move/framework/party-group/) for consent-based membership. The group Party and the member Party each store their own half of the relationship, so there is no separate Group object and neither side writes to the other's Party. Another application can use a different relationship model around the same Party identity. Neither requires a group field or a kind in core.

## Profiles and Attribution

[Party extensions](/move/framework/#party-extensions) add a display name, a profile card with biographies, country, and languages, and genre tags. Music credit extensions refer to Party IDs, so attribution follows the same identity across a catalog.

Profiles and credit records are claims by the relevant administrators. Applications choose which identities and assertions they trust. Capability custody and operational workflows belong to [Framework](/move/framework/#actions-and-plugins) packages.

## Events and Errors

| Event | Fields |
| --- | --- |
| `PartyCreatedEvent` | `party_id`, `party_admin_cap_id`; emitted by `new`, while `share` emits nothing |

| Code | Constant | Meaning |
| --- | --- | --- |
| 0 | `EUnauthorized` | The capability does not match the Party |

## Source Generation and Deployment

The excerpts are from `miso_party` at commit [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Its [`Published.toml`](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/Published.toml) records this source as published on Sui mainnet at `0xb11906f9134cc6a0035febbe807465dbf125ddd4c1258cc1e64c78a1506c8e81`, and the Framework packages pin the same commit. `sui move test` at this commit passes 4 tests.

This generation breaks compatibility with earlier ones. It removes `PartyKind`, the core group and invitation APIs, the `name` field with `set_name` and `PartyNameSetEvent`, and the public `authorize`. `new` takes no kind or name, `share` no longer takes the cap, and `PartyCreatedEvent` no longer carries `is_group` or `name`. Earlier published generations keep their layouts and behavior; the testnet entry in the same `Published.toml` records a September 2026 generation from before these changes. Match package IDs, generated bindings, and event decoding to the generation you use.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/LICENSE).

Source: pinned [Party module](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/sources/party.move), [README](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/README.md), and [tests](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4/tests).
