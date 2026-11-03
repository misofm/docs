---
title: Extensions
description: How optional names, profiles, genres, and group membership attach to a Party identity, and which package adds what.
---

This page is for developers who display or edit information about a Party. It explains how extensions attach data to a [Party](/move/party-protocol/) and lists each Party extension, each with its own page.

Each package is its own directory in [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0). At that commit the extensions pin `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), where core `Party` is identity only: an object ID and capability-controlled administration, with no name or other display data. Renaming a Party or rewriting its biography changes an extension's field, not the Party ID that credits refer to.

## How Party Extensions Work

Each extension owns one slice of data, stored as a dynamic field under a key type private to its package. Writes go through `party.uid_mut(cap)`, which requires the matching `PartyAdminCap`; a wrong cap aborts with `miso_party::party::EUnauthorized` before any other change. Reads are permissionless. Every actual change emits an event carrying the full new value, so an indexer can rebuild each field from events alone.

| Package | Adds |
| --- | --- |
| [`party_name`](/move/party-protocol/extensions/party-name/) | Display name, one non-empty `String` |
| [`party_profile`](/move/party-protocol/extensions/party-profile/) | Profile card: short and long biographies, country, and languages, replaced as a whole |
| [`party_genre`](/move/party-protocol/extensions/party-genre/) | Genre tags, one dynamic field per genre from the shared [`genre`](/move/framework/genre/) vocabulary |
| [`party_group`](/move/party-protocol/extensions/party-group/) | Optional two-sided group membership with owned invite objects |

The name is separate from the profile so that a rename touches and emits only the name. The roles, tags, media, and call-to-action extensions in earlier generations were removed before the mainnet publish while the project reconsiders whether that data belongs on-chain. Platform links were removed pending a redesign.

## Group Membership in Brief

A band is a Party, and so is each of its members. With [`party_group`](/move/party-protocol/extensions/party-group/), the group Party stores its consent to each member and each member Party stores its consent to the group. Each half is written by that Party's own admin on its own Party, and a Party is a member only when both halves exist. There is no Group object. The group admin's `add_member` sends an invite object to the member Party's address, and the member's admin joins with it in a later transaction. Membership is direct, nonrecursive, and grants no capability or music rights.

## Claims, Not Proof

Names, biographies, genres, and memberships are claims by the relevant administrators. A stored name does not establish a real-world identity, and two Parties with the same name are not the same entity. The genre vocabulary is open: anyone can register a genre name, so a genre tag shows that the name is registered and well formed, not that it is curated. Applications choose which identities and assertions they trust, and treat stored text as untrusted input.

## Workflows Around a Party

Extensions store data; they do not custody capabilities or move value. [`party_wallet`](/move/framework/party-wallet/) is an Action that receives objects and coins sent to a Party's address and returns them to the caller, and [`vault`](/move/framework/vault/) holds capabilities. Never send a Party's only `PartyAdminCap` to that Party's own address: receiving it would require the same cap.

## Compatibility and Licensing

Each directory is a separate Move package with its own published identity. Check its `Move.toml` and `Published.toml` before combining packages; each package page states which recorded deployment matches its source. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Package source is © Miso Labs, Inc. and licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense excerpts on the package pages.

Source: [Framework README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/README.md) and [Party roadmap](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/ROADMAP.md) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`.
