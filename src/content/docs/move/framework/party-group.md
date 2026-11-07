---
title: Party Group
description: Record consent-based group membership between Parties, with each side writing its own half.
---

`party_group` records which Parties belong to a band, collective, or other group. Each side writes its own half, so membership needs both Parties' consent. Read it over plain RPC.

## Two Halves of a Membership

A band is a [Party](/move/party-protocol/), and so is each member. Core Party has no group API and `party_group` adds no Group object. Membership is one dynamic field on each Party, plus an invite object:

```move
public struct PartyGroupInvite has key {
    id: UID,
    group_id: ID,
}

public struct PartyMemberKey(ID) has copy, drop, store;

public struct PartyGroupMembershipKey(ID) has copy, drop, store;
```

- The band's Party stores `PartyMemberKey(member_id)`: the group's consent.
- The member's Party stores `PartyGroupMembershipKey(group_id)`: the member's consent.

Each admin writes its own half on its own Party through `uid_mut(cap)`. Neither side writes to the other's Party or can force the relationship. A Party is a member only when both halves exist:

| Group half | Member half | State |
| --- | --- | --- |
| present | absent | Invited: an invite waits on the member Party. |
| present | present | Member: `is_member` is true. |
| absent | present | Removed: the member keeps its half until it calls `leave`. |
| absent | absent | None. |

`is_member(group, member)` checks both halves. `has_member(group, member_id)` and `has_group_membership(member, group_id)` each check one.

## Inviting a Member

Call `add_member` with the group's `PartyAdminCap` and the member Party:

```move
public fun add_member(group: &mut Party, cap: &PartyAdminCap, member: &Party, ctx: &mut TxContext) {
    let group_id = object::id(group);
    let member_id = object::id(member);
    let uid = group.uid_mut(cap);
    assert!(!df::exists(uid, PartyMemberKey(member_id)), EMemberAlreadyAdded);
    assert!(!has_group_membership(member, group_id), EMembershipStillPresent);
    df::add(uid, PartyMemberKey(member_id), true);
    let invite = PartyGroupInvite { id: object::new(ctx), group_id };
    let invite_id = object::id(&invite);
    transfer::transfer(invite, member_id.to_address());
    emit(PartyMemberAddedEvent { group_id, member_id, invite_id });
}
```

It writes the group's half and transfers a new `PartyGroupInvite` to the member Party's address, where only the member's admin can receive it.

- A removed member still holding its half must `leave` before it can be added again.
- A Party cannot add itself: the group is borrowed mutably, the member immutably.
- Invites are ordinary objects, not derived, so a member can be invited again after leaving.

## Joining, Declining, and Leaving

Answer the invite in a later transaction: a `Receiving` argument must name an object the Party already owns. Pass it to `join` with the member's `PartyAdminCap`:

```move
public fun join(
    member: &mut Party,
    cap: &PartyAdminCap,
    group: &Party,
    invite: Receiving<PartyGroupInvite>,
) {
    let member_id = object::id(member);
    let group_id = object::id(group);
    let uid = member.uid_mut(cap);
    let invite = transfer::receive(uid, invite);
    assert!(invite.group_id == group_id, EWrongInvite);
    assert!(has_member(group, member_id), EInviteNotFound);
    let PartyGroupInvite { id, group_id: _ } = invite;
    id.delete();
    assert!(!df::exists(uid, PartyGroupMembershipKey(group_id)), EMembershipAlreadyAdded);
    df::add(uid, PartyGroupMembershipKey(group_id), true);
    emit(PartyGroupJoinedEvent { group_id, member_id });
}
```

- **A revoked invite cannot be used.** If the group called `remove_member` first, `join` aborts with `EInviteNotFound` and the invite stays on the member Party. Clear it with `decline`.
- **`decline(member, cap, invite)`** receives and deletes any invite without checking the group's half. It writes nothing else.
- **Extra invites.** If the group removes and re-adds a member before it joins, the member holds two invites. The first `join` succeeds, a later one aborts with `EMembershipAlreadyAdded`, and `decline` clears the extra.

Either side ends the relationship on its own half: `remove_member(group, cap, member_id)` for the group, `leave(member, cap, group_id)` for the member. Neither needs the other Party.

## Finding Members and Invites

Plain RPC answers each question:

| Question | List | Filter |
| --- | --- | --- |
| Whom has this group added? | Dynamic fields of the group Party | Name type `PartyMemberKey`; the name holds the member Party ID |
| Which groups has this Party joined? | Dynamic fields of the member Party | Name type `PartyGroupMembershipKey`; the name holds the group Party ID |
| Which invites are pending? | Objects owned by the member Party's address | Type `PartyGroupInvite`; `invite.group_id()` names the group |

A single half is only a hint: the group lists an invited member before it joins, and a removed member still lists the group until it leaves. Confirm with `is_member`.

## What Membership Means

Membership is direct and nonrecursive. It grants no capability over either Party and no music rights or shares. Any Party may be a member, including a group. No member limit. Do not infer authority or membership through nested groups.

## Failure Cases

| Situation | Result |
| --- | --- |
| A cap for a Party other than the one being written | Every function aborts with `miso_party::party::EUnauthorized` (0) before any other check. |
| Adding a member the group has already added | `add_member` aborts with `EMemberAlreadyAdded` (0). |
| Re-adding a removed member that has not left | `add_member` aborts with `EMembershipStillPresent` (6). |
| Removing a member the group has not added | `remove_member` aborts with `EMemberNotFound` (1). |
| An invite from a different group than the one passed | `join` aborts with `EWrongInvite` (5). |
| Joining after the group revoked the invite | `join` aborts with `EInviteNotFound` (4); clean up with `decline`. |
| Joining a group the member has already joined | `join` aborts with `EMembershipAlreadyAdded` (2). |
| Leaving a group the member has not joined | `leave` aborts with `EMembershipNotFound` (3). |

## Events

| Event | Fields |
| --- | --- |
| `PartyMemberAddedEvent` | `group_id`, `member_id`, `invite_id` |
| `PartyMemberRemovedEvent` | `group_id`, `member_id` |
| `PartyGroupJoinedEvent` | `group_id`, `member_id` |
| `PartyGroupInviteDeclinedEvent` | `group_id`, `member_id`, `invite_id` |
| `PartyGroupLeftEvent` | `group_id`, `member_id` |

`group_id` and `member_id` are Party IDs. `invite_id` is the invite object's ID. Added and removed events track the group's half. Joined and left events track the member's. Apply in transaction order.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group/Published.toml) records a mainnet publication at `0xce13403dddb989f83670c25b478b15af91ae974b3b896602b3b01c4510a0d8e5`. Recorded after the last source and manifest change, so it matches this source. The README mentions no audit. The package pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). The 18 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group/sources/party_group.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_group/tests/party_group_tests.move).
