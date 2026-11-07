---
title: Party
description: A Party is a stable ID with one admin capability. Names, profiles, and groups are extensions.
---

A Party is a creditable identity (person, band, label, organization) with a stable ID and one admin capability. Use it to say who is credited on a work.

In the [overview's example](/move/music-protocol/), Dolly Parton is one Party, credited as writer of "I Will Always Love You" and as artist on her recording. Whitney Houston is another, credited on hers. Music objects identify works. A Party identifies who is credited.

Party lives in the separate [`miso_party` package](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Core does not classify a Party as individual or group, prescribe members, or store display data.

## Identity and Administration

The complete core object is an ID:

```move
public struct Party has key {
    id: UID,
}
```

Name, biography, genres, and group memberships are optional [extensions](/move/framework/#party-extensions). Renaming changes an extension field, never the ID credits refer to.

`party::new(ctx)` returns the Party and its admin capability and emits `PartyCreatedEvent` with both IDs. `Party` has only `key` and no transfer function, so the creating transaction must call `party.share()`. `share` takes no capability and emits nothing.

```move
public struct PartyAdminCap has key, store {
    id: UID,
    party_id: ID,
}
```

`PartyAdminCap` is a transferable bearer object bound to one Party ID. Its ID is derived from the Party, so each Party has exactly one admin cap. Whoever holds it administers the Party.

One check gates all administration:

```move
public fun uid_mut(self: &mut Party, cap: &PartyAdminCap): &mut UID {
    assert!(cap.party_id == object::id(self), EUnauthorized);
    &mut self.id
}
```

Extensions attach typed dynamic fields through this UID, so a mismatched cap aborts with `EUnauthorized` (0) before any extension logic runs. An extension that keeps state outside the Party checks a cap with `cap.party_id()`. The public `authorize` of earlier generations no longer exists.

Holding the cap does not transfer shares, grant a music object's admin capability, or prove a rights agreement.

## Names Are Claims

The display name lives in the [`party_name` extension](/move/framework/party-name/). A name is an unverified claim by the Party's administrator. The protocol proves no real-world identity, and two Parties with the same name need not be the same entity.

## Optional Group Membership

The optional [`party_group` extension](/move/framework/party-group/) gives a band consent-based membership. The group Party and the member Party each store their own half of the relationship. There is no Group object, and neither side writes to the other's Party. Applications can use a different relationship model around the same Party. Core needs no group field or kind.

## Profiles and Attribution

[Party extensions](/move/framework/#party-extensions) add a display name, a profile card (biographies, country, languages), and genre tags. Music credit extensions refer to Party IDs, so attribution follows one identity across a catalog.

Profiles and credit records are claims by their administrators. Applications choose which to trust. Capability custody and operational workflows belong to [Framework](/move/framework/#actions-and-plugins) packages.

## Events and Errors

| Event | Fields |
| --- | --- |
| `PartyCreatedEvent` | `party_id`, `party_admin_cap_id`; emitted by `new`, while `share` emits nothing |

| Code | Constant | Meaning |
| --- | --- | --- |
| 0 | `EUnauthorized` | The capability does not match the Party |

## Source Generation and Deployment

Excerpts are from `miso_party` at commit [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Its [`Published.toml`](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/Published.toml) records this source as published on Sui mainnet at `0xb11906f9134cc6a0035febbe807465dbf125ddd4c1258cc1e64c78a1506c8e81`, and the Framework packages pin the same commit. `sui move test` at this commit passes 4 tests.

This generation breaks compatibility with earlier ones. It removes `PartyKind`, the core group and invitation APIs, the `name` field with `set_name` and `PartyNameSetEvent`, and the public `authorize`. `new` takes no kind or name, `share` no longer takes the cap, and `PartyCreatedEvent` no longer carries `is_group` or `name`. Earlier generations keep their layouts and behavior. The testnet entry in the same `Published.toml` records a September 2026 generation from before these changes. Match package IDs, generated bindings, and event decoding to your generation.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/LICENSE).

Source: pinned [Party module](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/sources/party.move), [README](https://github.com/misofm/party-protocol/blob/b16e05982844453b286937cc085d573a92d7cea4/README.md), and [tests](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4/tests).
