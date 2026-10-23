---
title: Composition
description: Data-model extensions for the composition object.
---

The composition extensions describe the underlying written work: its preferred title, songwriting and publishing credits, and lyrics. They enrich the Composition object while its identity and share type remain in core.

For example, the same composition can have language-keyed lyrics and credits pointing to Party IDs, while several recordings continue to refer to that one composition.

## Packages

| Package | Object | Adds |
| --- | --- | --- |
| [`composition_title`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_title) | Composition | Preferred title |
| [`composition_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_credits) | Composition | Writer and publisher credit by Party ID |
| [`composition_lyrics`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_lyrics) | Composition | Language-keyed, compressed lyrics |

## Administration and Compatibility

These packages live in [`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions). Each attaches typed dynamic fields through the Composition object's admin-gated `uid_mut` surface. Reads are permissionless; each extension defines its own validation and update behavior. Owning shares alone does not authorize extension writes.

Each directory is a separate Move package. Its `Move.toml` pins the core revision it uses; verify compatible package identities before combining it with other packages. See the [Protocol Extensions overview](/packages/protocol-extensions/) for the shared model and [Framework](/packages/framework/) for business rules and workflows.

Source: [extension repository](https://github.com/misofm/music-protocol-extensions/blob/main/README.md). Package source uses the repository's [FSL-1.1-ALv2 license](https://github.com/misofm/music-protocol-extensions/blob/main/LICENSE.md).
