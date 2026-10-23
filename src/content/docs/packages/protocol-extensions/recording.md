---
title: Recording
description: Data-model extensions for the recording object.
---

The recording extensions describe a particular master: its version label, performance and production credits, advisory classification, genres, and languages. The core Recording keeps the master's identity, share type, and immutable composition ID.

A studio version and a live take can therefore have different labels and credits while both refer to the same underlying composition.

## Packages

| Package | Object | Adds |
| --- | --- | --- |
| [`recording_version`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_version) | Recording | Take or version label |
| [`recording_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_credits) | Recording | Artist, performance, and production credits |
| [`recording_advisory`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_advisory) | Recording | Explicit/clean advisory status |
| [`recording_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_genre) | Recording | Ordered genres |
| [`recording_language`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_language) | Recording | Ordered languages or instrumental indication |

## Administration and Compatibility

These packages live in [`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions). Each attaches typed dynamic fields through the Recording object's admin-gated `uid_mut` surface. Reads are permissionless; each extension defines its own validation and update behavior. Owning shares alone does not authorize extension writes.

Each directory is a separate Move package. Its `Move.toml` pins the core revision it uses; verify compatible package identities before combining it with other packages. See the [Protocol Extensions overview](/packages/protocol-extensions/) for the shared model and [Framework](/packages/framework/) for business rules and workflows.

Source: [extension repository](https://github.com/misofm/music-protocol-extensions/blob/main/README.md). Package source uses the repository's [FSL-1.1-ALv2 license](https://github.com/misofm/music-protocol-extensions/blob/main/LICENSE.md).
