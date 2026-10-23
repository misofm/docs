---
title: Party
description: A reusable identity for people and groups, with capability-controlled administration and consent-based membership.
---

A Party identifies a person or group that can be credited across works. A songwriter, performer, band, or label can have a Party ID reused in composition, recording, and release credits. The music objects identify the works; the Party identifies who is being credited.

Party lives in the separate [`miso_party` package](https://github.com/misofm/party-protocol). It complements the music protocol's Composition, Recording, and Release objects.

## Identity and Administration

The core object holds an ID, a kind, and a name:

```move
public struct Party has key {
    id: UID,
    kind: PartyKind,
    name: String,
}
```

Names can change under the Party's administrator without changing the ID used by credits. A name is a claim made under that administrator's authority; the protocol does not verify a real-world identity or guarantee that two parties with the same name represent the same person.

`PartyAdminCap` is a transferable bearer capability tied to a specific Party ID. Core mutations and extension writes require that matching capability. The internal authorization check makes the binding explicit:

```move
fun authorize(self: &Party, cap: &PartyAdminCap) {
    assert!(cap.party_id == object::id(self), EUnauthorized);
}
```

Crediting a Party does not itself transfer shares, grant a music object's admin capability, or prove a rights agreement. Those relationships have their own rules.

## Individuals and Groups

The kind distinguishes an individual from a group of Party IDs:

```move
public enum PartyKind has drop, store {
    Individual,
    Group(VecSet<ID>),
}
```

A band can be represented by a group, with its individual members represented by their own Parties. In this source revision, group membership is limited to individual Parties and a group can have at most 200 members.

Membership requires consent from both sides: a group administrator invites an individual, and that individual's administrator accepts. The individual can decline an invitation or leave a group; the group administrator can revoke a pending invitation or remove a member. Merely writing another Party's ID into unrelated metadata cannot create protocol membership.

## Profiles and Attribution

[Party extensions](/packages/protocol-extensions/party/) add biographies, roles, genres, images, and external links around the stable identity. Composition, recording, and release credit extensions refer to Party IDs so that attribution can follow the same identity across a catalog.

Those profiles and credit records are claims by the relevant administrators. Applications choose which identities and assertions they trust. Administrative workflows and capability custody belong to [Framework](/packages/framework/) packages.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/party-protocol/blob/342fcce18e02ad006e2a334e7e66fae421745434/LICENSE).

Source: pinned [Party module](https://github.com/misofm/party-protocol/blob/342fcce18e02ad006e2a334e7e66fae421745434/sources/party.move) and [README](https://github.com/misofm/party-protocol/blob/342fcce18e02ad006e2a334e7e66fae421745434/README.md).
