---
title: Extensions
description: Optional names, profiles, genres, and group membership attached to a Party identity.
---

This page is for developers who display or edit information about a Party. It lists the optional extensions that attach data to a [Party](/move/party-protocol/) and explains how two-sided group membership works.

Each package is its own directory in [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0). At that commit the extensions pin `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), where core `Party` is identity only: an object ID and capability-controlled administration, with no name or other display data. Renaming a Party or rewriting its biography changes an extension's field, not the Party ID that credits refer to.

## How Party Extensions Work

Each extension owns one slice of data, stored as a dynamic field under a key type private to its package. Writes go through `party.uid_mut(cap)`, which requires the matching `PartyAdminCap`; a wrong cap aborts with `miso_party::party::EUnauthorized` before any other change. Reads are permissionless. Every actual change emits an event carrying the full new value, so an indexer can rebuild each field from events alone.

| Package | Adds |
| --- | --- |
| [`party_name`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_name) | Display name, one `String` of at least 1 byte |
| [`party_profile`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_profile) | Profile card: short and long biographies, country, and languages |
| [`party_genre`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre) | Genre tags, one dynamic field per genre, proven at write time against the [`genre`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/genre) vocabulary |
| [`party_group`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_group) | Optional two-sided group membership with owned invite objects |

The name is separate from the profile so that a rename touches and emits only the name. The roles, tags, media, and call-to-action extensions in earlier generations were removed before the mainnet publish while the project reconsiders whether that data belongs on-chain. Platform links were removed pending a redesign.

## Profile Data

`party_profile` replaces the whole card in one call:

```move
public struct Profile has drop, store {
    bio_short: String,
    bio_long: Option<String>,
    country: Option<CountryCode>,
    languages: vector<LanguageCode>,
}
```

`set_profile(party, cap, bio_short, bio_long, country, languages)` validates every field before authorization and overwrites any existing card. `bio_short` is required and 1–300 bytes; `bio_long` is 1–8,192 bytes when present; up to 10 languages, with no duplicates. `CountryCode` and `LanguageCode` are validated code types, so a stored value is always a real code. `clear_profile` removes the field and reclaims its storage.

## Group Membership

A band is a Party, and so is each of its members. `party_group` records membership without a Group object and without either side writing to the other's Party:

```move
public struct PartyGroupInvite has key {
    id: UID,
    group_id: ID,
}

public struct PartyMemberKey(ID) has copy, drop, store;

public struct PartyGroupMembershipKey(ID) has copy, drop, store;
```

Membership has two halves. The group Party stores `PartyMemberKey(member_id)`, which is the group's consent, and the member Party stores `PartyGroupMembershipKey(group_id)`, which is the member's consent. Each half is written by that Party's own admin on its own Party. A Party is a member only when both halves exist; `is_member(group, member)` checks both.

1. The group admin calls `add_member(group, cap, member, ctx)`. This writes the group's half and transfers a new `PartyGroupInvite` to the member Party's address.
2. The member's admin calls `join(member, cap, group, invite)`, which receives and deletes the invite and writes the member's half, or `decline(member, cap, invite)`, which receives and deletes it.
3. Either side can end the relationship on its own half: the group with `remove_member`, the member with `leave`.

| Group half | Member half | State |
| --- | --- | --- |
| present | absent | Invited |
| present | present | Member |
| absent | present | Removed; the member keeps its half until it calls `leave` |
| absent | absent | None |

A member finds pending invites by listing the objects its Party address owns, filtered by type `PartyGroupInvite`. Listing a Party's dynamic fields by `PartyMemberKey` or `PartyGroupMembershipKey` answers "whom has this group added?" and "which groups has this Party joined?" with plain RPC. A single half is only a hint. Confirm with `is_member`.

Membership is direct and nonrecursive, and it grants no capability or music rights. Any Party may be a member, including one that is itself a group; a Party cannot add itself. There is no member limit. Applications must not infer authority from nested groups.

| Situation | Result |
| --- | --- |
| Adding a member the group has already added | `EMemberAlreadyAdded` (0) |
| Removing a member the group has not added | `EMemberNotFound` (1) |
| Joining a group the member has already joined | `EMembershipAlreadyAdded` (2) |
| Leaving a group the member has not joined | `EMembershipNotFound` (3) |
| Joining after the group revoked the invite | `EInviteNotFound` (4); clean up with `decline` |
| An invite for a different group | `EWrongInvite` (5) |
| Re-adding a removed member that has not left | `EMembershipStillPresent` (6) |

## Claims, Not Proof

Names, biographies, genres, and memberships are claims by the relevant administrators. A stored name does not establish a real-world identity, and two Parties with the same name are not the same entity. Applications choose which identities and assertions they trust, and treat stored text as untrusted input.

## Workflows Around a Party

Extensions store data; they do not custody capabilities or move value. [`party_wallet`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet) is an Action that receives objects and coins sent to a Party's address and returns them to the caller, and [`vault`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/vault) holds capabilities. Both are described in [Framework](/move/framework/#actions-and-libraries). Never send a Party's only `PartyAdminCap` to that Party's own address: receiving it would require the same cap.

## Compatibility and Licensing

Each directory is a separate Move package with its own published identity. Check its `Move.toml` and `Published.toml` before combining packages; see [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

The excerpts above are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: pinned [group module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_group/sources/party_group.move) and [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_group/README.md), [profile module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_profile/sources/party_profile.move) and [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_profile/README.md), and the [Party roadmap](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/ROADMAP.md).
