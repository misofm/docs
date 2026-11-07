---
title: Party Name
description: Give a Party a display name, stored and renamed separately from its profile.
---

`party_name` stores a display name on a [Party](/move/party-protocol/). Use it to show or set the name credits resolve to; a name is a claim, not an identity.

## A Name Beside the Identity

A core Party is only an ID. Credits for Whitney Houston's "I Will Always Love You" refer to her Party ID. The displayed name is a separate `String` on the Party:

```move
public struct PartyNameKey() has copy, drop, store;
```

A Party has at most one name, under `PartyNameKey()`, separate from the [`party_profile`](/move/framework/party-profile/) card. A rename writes and emits only the name and never changes the Party ID.

## Setting the Name

The `PartyAdminCap` holder sets or replaces it:

```move
public fun set_name(party: &mut Party, cap: &PartyAdminCap, name: String) {
    assert!(!name.is_empty(), EEmptyName);
    let party_id = object::id(party);
    let uid = party.uid_mut(cap);
    if (df::exists(uid, PartyNameKey())) {
        let previous: &mut String = df::borrow_mut(uid, PartyNameKey());
        if (*previous == name) return;
        *previous = name;
    } else {
        df::add(uid, PartyNameKey(), name);
    };
    emit(PartyNameSetEvent { party_id, name });
}
```

The empty check runs before the cap check. A name is at least 1 byte. There is no on-chain maximum, because only the cap holder writes and pays for storage. Apply display limits in the client. Setting the current name writes and emits nothing.

A Party has no name until `set_name` runs. To avoid a shared, nameless Party, set it in the creating transaction:

1. Call `party::new` to get the Party and its admin cap.
2. Call `party_name::set_name` on the Party.
3. Call `share` on the Party and keep or transfer the cap.

`PartyCreatedEvent` is followed by `PartyNameSetEvent` in the same transaction.

`clear_name(party, cap)` removes the name and reclaims its storage; silent when none is set. Read with `has_name(party)` and `name(party)` (aborts when none is set).

## Names Are Claims

A name is an unverified claim by the admin cap holder. It proves no real-world identity, and two Parties with one name need not be the same entity. Treat the string as untrusted input when rendering. Trust Parties by ID.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty name | `set_name` aborts with `EEmptyName` (0) before the cap is checked. |
| Another Party's admin cap | `set_name` and `clear_name` abort with `miso_party::party::EUnauthorized` (0). |
| Reading a Party with no name | `name` aborts with `ENoName` (1). |

## Events

| Event | Fields |
| --- | --- |
| `PartyNameSetEvent` | `party_id`, `name`; only when the name changes |
| `PartyNameClearedEvent` | `party_id`; only when a name was removed |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/Published.toml) records a mainnet publication at `0x6cb2b8eb21112289dece6de339e69b7846d795fca2a32e5c16ed016a694616f1`, postdating the last source and manifest change, so it matches this source. The README mentions no audit. Pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), the first core generation without a name in the Party itself. The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/sources/party_name.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/tests/party_name_tests.move).
