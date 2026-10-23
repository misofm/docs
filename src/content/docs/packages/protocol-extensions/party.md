---
title: Party
description: Profiles, roles, media, and external links attached to a Party identity.
---

[Party](/protocol/party/) provides identity, a name, individual or group kind, and consent-based group membership. [`party-protocol-extensions`](https://github.com/misofm/party-protocol-extensions) adds optional profile and presentation data around that identity. Updating a biography or image does not create a new Party ID or change existing credits to that Party.

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
| [`party_profile`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_profile) | Short and long biographies, country, and languages |
| [`party_roles`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_roles) | Roles such as artist, producer, songwriter, band, label, or a custom role |
| [`party_genre`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_genre) | Genres checked against the genre vocabulary |
| [`party_tags`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_tags) | Free-form descriptive tags |
| [`party_media`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_media) | A Walrus quilt blob ID used for profile imagery |
| [`party_cta`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_cta) | Ordered external call-to-action links |
| [`party_platform_link`](https://github.com/misofm/party-protocol-extensions/tree/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_platform_link) | Typed external-platform links attached to a Party |

## Link Payloads and Shared Primitives

`party_social`, `party_music`, and `party_pro_link` construct typed social, music-platform, and professional-link values. They do not access a Party or its admin capability. `party_platform_link` attaches those values to the Party, using the shared `lib/platform_link` storage primitive.

A stored handle or link is an administrator-supplied claim, not proof that the Party controls the external account. Applications validate those claims and handle stored URLs as untrusted input.

## Data and Workflows

Profile extensions describe a Party. Operational workflows and capability custody belong to [Framework](/packages/framework/) packages such as Party Actions and Vault. Each extension has its own pinned dependencies and immutable package identity; check those revisions when combining packages.

The profile excerpt above is © Miso Labs, Inc. and remains licensed under [FSL-1.1-ALv2](https://github.com/misofm/party-protocol-extensions/blob/625b17935dfe818907f44a2dcb4b109e4d43a9f6/LICENSE.md), rather than the docs' Apache license for independently written examples.

Source: pinned [profile module](https://github.com/misofm/party-protocol-extensions/blob/625b17935dfe818907f44a2dcb4b109e4d43a9f6/party_profile/sources/party_profile.move) and [Party Extensions README](https://github.com/misofm/party-protocol-extensions/blob/625b17935dfe818907f44a2dcb4b109e4d43a9f6/README.md).
