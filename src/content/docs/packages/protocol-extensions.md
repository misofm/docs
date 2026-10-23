---
title: Protocol Extensions
description: Extend the data model of compositions, recordings, and releases without expanding the protocol core.
---

Protocol Extensions add optional typed data to the Miso Music Protocol's three core objects: **Composition, Recording, and Release**. They live in [`music-protocol-extensions`](https://github.com/misofm/music-protocol-extensions). A title, lyric, credit, or artwork reference enriches an existing object while preserving its core identity and relationships.

## How extensions fit the core

The core defines which work an object identifies and how it relates to other works. Extensions describe that work. For example, a recording keeps its immutable composition ID in core, while its version label and artist credits live in separate extensions.

Each extension attaches typed data as a dynamic field on the core object's UID. Writes require the matching admin capability through the object's `uid_mut` surface; reads are permissionless. An extension defines its own read and update API. Updating a title therefore does not require changing the core object or migrating unrelated extension data.

These packages extend the data model. [Framework packages](/packages/framework/) define business rules such as licensing, royalty distribution, capability custody, and commerce.

## Extension inventory

| Package | Object | Adds |
| --- | --- | --- |
| [`composition_title`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_title) | Composition | Preferred title |
| [`composition_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_credits) | Composition | Writer and publisher credit by Party ID |
| [`composition_lyrics`](https://github.com/misofm/music-protocol-extensions/tree/main/composition_lyrics) | Composition | Language-keyed, compressed lyrics |
| [`recording_version`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_version) | Recording | Take or version label |
| [`recording_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_credits) | Recording | Artist, performance, and production credits |
| [`recording_advisory`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_advisory) | Recording | Explicit/clean advisory status |
| [`recording_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_genre) | Recording | Ordered genres |
| [`recording_language`](https://github.com/misofm/music-protocol-extensions/tree/main/recording_language) | Recording | Ordered languages or instrumental indication |
| [`release_title`](https://github.com/misofm/music-protocol-extensions/tree/main/release_title) | Release | Preferred title |
| [`release_cover_art`](https://github.com/misofm/music-protocol-extensions/tree/main/release_cover_art) | Release | Cover art and optional track overrides |
| [`release_credits`](https://github.com/misofm/music-protocol-extensions/tree/main/release_credits) | Release | Top-line artist billing |
| [`release_description`](https://github.com/misofm/music-protocol-extensions/tree/main/release_description) | Release | Editorial description |
| [`release_genre`](https://github.com/misofm/music-protocol-extensions/tree/main/release_genre) | Release | Ordered genres |
| [`release_kind`](https://github.com/misofm/music-protocol-extensions/tree/main/release_kind) | Release | Album, EP, mixtape, or other label |

Pin a specific repository commit and the package subdirectory, for example:

```toml
[dependencies]
release_title = { git = "https://github.com/misofm/music-protocol-extensions.git", subdir = "release_title", rev = "<40-character-commit>" }
```

Each directory is a separate Move package with its own dependency pins and publication records. Select compatible revisions when combining extensions with the core or framework. Follow the repository's [license](https://github.com/misofm/music-protocol-extensions/blob/main/LICENSE.md) when reusing its source.

Source: [Music Protocol Extensions README](https://github.com/misofm/music-protocol-extensions/blob/main/README.md).
