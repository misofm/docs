---
title: Party Name
description: Give a Party a display name, stored and renamed separately from its profile.
---

This page is for developers who show or set the name of a [Party](/move/party-protocol/). It explains how `party_name` stores a display name on a Party, how to set it when the Party is created, and what a name does and does not establish.

## A Name Beside the Identity

A core Party is only an ID. Suppose Whitney Houston's Party is created for crediting her recording of "I Will Always Love You". Credits refer to the Party ID; the name an application shows for that ID is a separate `String` stored on the Party:

```move
public struct PartyNameKey() has copy, drop, store;
```

Each Party has at most one name, under `PartyNameKey()`. The name is kept apart from the [`party_profile`](/move/framework/party-profile/) card, so a rename writes and emits only the name. Renaming never changes the Party ID that credits refer to.

## Setting the Name

The `PartyAdminCap` holder sets or replaces the name:

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

The empty check runs before the cap check. A name must be at least 1 byte; there is no on-chain maximum, because only the cap holder writes the name and pays for its storage. Apply display limits in the client. Setting the current name again writes nothing and emits nothing.

A Party has no name until `set_name` runs. To avoid a shared, nameless Party, set it in the creating transaction:

1. Call `party::new` to get the Party and its admin cap.
2. Call `party_name::set_name` on the Party.
3. Call `share` on the Party and keep or transfer the cap.

`PartyCreatedEvent` is then followed by `PartyNameSetEvent` in the same transaction.

`clear_name(party, cap)` removes the name and reclaims its storage; it is silent when no name is set. Read the name with `has_name(party)` and `name(party)`, which aborts when none is set.

## Names Are Claims

A name is an unverified claim by whoever holds the Party's admin cap. It does not establish a real-world identity, and two Parties with the same name are not the same entity. Treat the string as untrusted input when rendering it, and choose which Parties to trust by ID.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/Published.toml) records a mainnet publication at `0x6cb2b8eb21112289dece6de339e69b7846d795fca2a32e5c16ed016a694616f1`. It was recorded after the last change to this package's source and manifest, so the recorded generation matches this source. The package README does not mention an audit. The package pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), the first core generation without a name in the Party itself. The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/sources/party_name.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_name/tests/party_name_tests.move).
