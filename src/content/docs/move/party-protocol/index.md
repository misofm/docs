---
title: Party
description: A reusable identity with a stable ID, a name, and capability-controlled administration.
---

A Party identifies an entity that can be credited across works: a person, band, label, or organization. A songwriter's Party ID can be reused in composition, recording, and release credits. Music objects identify works; the Party identifies who is being credited.

Party lives in the separate [`miso_party` package](https://github.com/misofm/party-protocol). Core does not classify it as an individual or a group, prescribe a member collection, or impose a membership policy.

## Identity and Administration

The complete core object is small:

```move
public struct Party has key {
    id: UID,
    name: String,
}
```

An administrator can change the name without changing the ID used by credits. Names are unverified claims. The protocol does not establish a real-world identity or guarantee that two Parties with the same name represent the same entity.

`PartyAdminCap` is a transferable bearer capability tied to a specific Party ID. The public authorization check lets extensions verify that capability with immutable references:

```move
public fun authorize(self: &Party, cap: &PartyAdminCap) {
    assert!(cap.party_id == object::id(self), EUnauthorized);
}
```

Extensions that attach data to the Party use `party::uid_mut(cap)`, which runs the same check before exposing mutable UID access. An extension that owns a separate object can use `authorize` without mutating the Party.

Crediting a Party does not itself transfer shares, grant a music object's admin capability, or prove a rights agreement. Those relationships have their own rules.

## Optional Group Relations

A band can use the optional [`party_group` extension](/move/party-protocol/extensions/#group-relations) to maintain consent-based membership. Another application can use a different relationship model around the same Party identity. Neither requires a group field or `PartyKind` in core.

The group extension owns its storage, limits, invitations, acceptance, exit, and removal rules. Its Group object is separate from the Party. Choosing that extension commits an application to its specific direct-membership policy; core remains independent of that choice.

## Profiles and Attribution

[Party extensions](/move/party-protocol/extensions/) add biographies, roles, genres, images, and external links. Music credit extensions refer to Party IDs so attribution can follow the same identity across a catalog.

Profiles and credit records are claims by the relevant administrators. Applications choose which identities and assertions they trust. Capability custody and operational workflows belong to [Framework](/move/framework/) packages.

## Source Generation

These excerpts describe the identity-only source generation pinned below. It removes the former core kind and membership APIs and changes the constructor and creation event. Published historical generations retain their previous behavior; match package IDs, generated bindings, and event decoding to the generation being used.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/party-protocol/blob/c7c457d40bb96db9044cea55fd71532e192ab6b8/LICENSE).

Source: pinned [Party module](https://github.com/misofm/party-protocol/blob/c7c457d40bb96db9044cea55fd71532e192ab6b8/sources/party.move) and [README](https://github.com/misofm/party-protocol/blob/c7c457d40bb96db9044cea55fd71532e192ab6b8/README.md).
