---
title: Party
description: Optional group relations, profiles, roles, media, and links around a Party identity.
---

[Party](/protocol/party/) provides a stable identity, a name, and capability-controlled administration. [`party-protocol-extensions`](https://github.com/misofm/party-protocol-extensions) adds optional group relations, profile data, and presentation around that identity. Updating a biography or image does not create a new Party ID or change existing credits to that Party.

## Group Relations

`party_group` owns a shared Group derived from the Party identity. The extension keeps the association small and stores direct member and pending-invite sets on its own UID:

```move
public struct Group has key {
    id: UID,
    party_id: ID,
}
```

The parent Party records the derived claim. The extension owns both sets through the bounded `typed_set` primitive, so core Party does not prescribe their representation. In this extension generation, each set is limited to 200 IDs.

The Group administrator invites a Party, and that Party's administrator accepts or declines. A member can leave without the Group administrator's capability; the Group administrator can revoke an invitation or remove a member without the member's capability. These operations authorize the relevant Party through `party::authorize(cap)` and mutate the separate Group, rather than a foreign Party's UID.

Membership is direct and nonrecursive. Any Party can be a member except the Group's own owner Party, including a Party with its own Group. Applications must not infer transitive authority from nested groups. Event indexes provide member-side inbox and group discovery; this extension stores no mirrored membership fields on the member Party.

See the [package reference](https://github.com/misofm/party-protocol-extensions/blob/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_group/README.md) for the API, events, bounds, and source-generation migration notes.

## Profile Data

The profile extension keeps a coherent set of descriptive fields separate from the core Party:

```move
public struct Profile has store, drop {
    bio_short: String,
    bio_long: Option<String>,
    country: Option<CountryCode>,
    languages: vector<LanguageCode>,
}
```

The short biography is required when setting a profile; the long biography and country are optional. Country and language values use validated code types. The extension validates those fields before attaching the profile through `party::uid_mut(cap)`.

## State-Attaching Extensions

These packages write dynamic fields on a Party and require its matching `PartyAdminCap`. Reads are permissionless.

| Package | Adds |
| --- | --- |
| [`party_profile`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_profile) | Short and long biographies, country, and languages |
| [`party_roles`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_roles) | Roles such as artist, producer, songwriter, band, label, or a custom role |
| [`party_genre`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_genre) | Genres checked against the genre vocabulary |
| [`party_tags`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_tags) | Free-form descriptive tags |
| [`party_media`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_media) | A Walrus quilt blob ID used for profile imagery |
| [`party_cta`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_cta) | Ordered external call-to-action links |
| [`party_platform_link`](https://github.com/misofm/party-protocol-extensions/tree/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_platform_link) | Typed external-platform links attached to a Party |

## Link Payloads and Shared Primitives

`party_social`, `party_music`, and `party_pro_link` construct typed social, music-platform, and professional-link values. They do not access a Party or its admin capability. `party_platform_link` attaches those values to the Party, using the shared `lib/platform_link` storage primitive.

A stored handle or link is an administrator-supplied claim, not proof that the Party controls the external account. Applications validate those claims and handle stored URLs as untrusted input.

## Data and Workflows

Group relations and profile extensions add optional data-model policies around a Party. Operational workflows and capability custody belong to [Framework](/packages/framework/) packages such as Party Actions and Vault. Each extension has its own pinned dependencies and immutable package identity; check those revisions when combining packages.

The Group and Profile excerpts above are © Miso Labs, Inc. and remain licensed under [FSL-1.1-ALv2](https://github.com/misofm/party-protocol-extensions/blob/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/LICENSE.md). The docs' Apache license for independently written examples does not relicense them.

Source: pinned [group module](https://github.com/misofm/party-protocol-extensions/blob/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_group/sources/party_group.move), [profile module](https://github.com/misofm/party-protocol-extensions/blob/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/party_profile/sources/party_profile.move) and [Party Extensions README](https://github.com/misofm/party-protocol-extensions/blob/7ab3b38ff74ccc9b99122b8d0fb08d57a99f84ad/README.md).
