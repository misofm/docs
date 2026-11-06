---
title: Cover Art
description: The CoverArt value type, a still image plus an optional animation referenced by Walrus blob IDs, used by the release cover art extension.
---

This page is for developers who set or display artwork. It explains the `CoverArt` value, what it references, what it does not check, and where it is stored.

## A Still and an Optional Animation

Suppose the release admin of *The Bodyguard* soundtrack has stored the album cover as a public blob on Walrus, plus a short animated version. A `CoverArt` holds the two blob IDs:

```move
public struct CoverArt has copy, drop, store {
    still_blob_id: u256,
    animated_blob_id: Option<u256>,
}
```

`CoverArt` is a plain value, not an object, with no admin, ID, or events. Cover art is public, so both blobs are meant to be unencrypted. The type lives in this small package rather than in the frozen core, so a new cover format means a new cover-art package or standard, not a new core protocol.

`new(still_blob_id, animated_blob_id)` builds one and never aborts. Views: `still_blob_id` and `animated_blob_id`.

**Nothing checks the blobs.** `new` does not check that a blob exists on Walrus, how long Walrus stores it, that it is an image, or that it is unencrypted. A client displaying cover art should resolve each blob ID itself and handle a missing or unexpected blob. Storing a `CoverArt` on a work is gated by the extension that stores it, not by this package.

## Who Uses It

[`release_cover_art`](/move/music-protocol/extensions/release-cover-art/) stores an `Option<CoverArt>` for the album cover and per-track overrides in a [`ReleaseTrackData<Option<CoverArt>>`](/move/framework/release-track-data/), set with the `ReleaseAdminCap`. To set *The Bodyguard*'s cover, call `cover_art::new` and pass the result to `release_cover_art::set_cover` in the same programmable transaction. That extension's events carry the blob IDs, so an indexer does not need to read the Release.

## Deployment

`cover_art` depends only on the Sui framework, not on the core protocol. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/Published.toml) records a mainnet generation at `published-at = "0x0d2a68cbe10a1724af7bf5036a78dcb4d39a9c1fa853076a629c2dff0740a101"`, recorded after the last change to the package's sources, so it matches this source. The recorded testnet generation, `published-at = "0x97ae14cddfc69650c81022cbe10012b06f3065cf81077bda2c784706bbe129cd"`, was recorded before the change that replaced an earlier blob wrapper with plain `u256` blob IDs, so check that generation's `CoverArt` layout and API before using it. `release_cover_art` accepts only the `CoverArt` type of the `cover_art` package it links. The README does not state an audit status. The 2 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/sources/cover_art.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/tests/cover_art_tests.move).
