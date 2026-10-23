---
title: Release
description: Data-model extensions for the release object.
---

The release extensions describe how an ordered track list is presented: its title, artwork, artist billing, description, genres, and kind. The core Release retains the ordered recording IDs and the identity approved by recording admins.

Artwork or a preferred title can be updated under the release administrator without changing the fixed track list. Release Consent does not approve those presentation fields or any commercial terms.

## Packages

| Package | Object | Adds |
| --- | --- | --- |
| [`release_title`](https://github.com/misofm/music-protocol-extensions/tree/main/release_title) | Release | Preferred title |
| [`release_cover_art`](https://github.com/misofm/music-protocol-extensions/tree/main/release_cover_art) | Release | Cover art and optional track overrides |
| [`release_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/release_credits) | Release | Top-line artist billing |
| [`release_description`](https://github.com/misofm/music-protocol-extensions/tree/main/release_description) | Release | Editorial description |
| [`release_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/release_genre) | Release | Ordered genres |
| [`release_kind`](https://github.com/misofm/music-protocol-extensions/tree/main/release_kind) | Release | Album, EP, mixtape, or other label |

## Administration and Compatibility

These packages live in [`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions). Each attaches typed dynamic fields through the Release object's admin-gated `uid_mut` surface. Reads are permissionless; each extension defines its own validation and update behavior. Owning shares alone does not authorize extension writes.

Each directory is a separate Move package. Its `Move.toml` pins the core revision it uses; verify compatible package identities before combining it with other packages. See the [Protocol Extensions overview](/packages/protocol-extensions/) for the shared model and [Framework](/packages/framework/) for business rules and workflows.

Source: [extension repository](https://github.com/misofm/music-protocol-extensions/blob/main/README.md). Package source uses the repository's [FSL-1.1-ALv2 license](https://github.com/misofm/music-protocol-extensions/blob/main/LICENSE.md).
