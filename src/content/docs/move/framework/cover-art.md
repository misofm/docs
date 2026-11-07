---
title: Cover Art
description: Value type for a still image plus an optional animation, referenced by Walrus blob IDs.
---

`CoverArt` is a value type that references a still image and an optional animation by Walrus blob ID. Use it to set or display artwork.

## A Still and an Optional Animation

A `CoverArt` for *The Bodyguard* soundtrack holds the blob IDs of the album cover and an optional animated version:

```move
public struct CoverArt has copy, drop, store {
    still_blob_id: u256,
    animated_blob_id: Option<u256>,
}
```

`CoverArt` is a plain value, not an object: no admin, ID, or events. Cover art is public, so both blobs should be unencrypted. The type lives here, not in the frozen core: a new cover format means a new package or standard, not a new core.

`new(still_blob_id, animated_blob_id)` never aborts. Views: `still_blob_id`, `animated_blob_id`.

**Nothing checks the blobs.** `new` does not check that a blob exists on Walrus, how long Walrus stores it, that it is an image, or that it is unencrypted. Clients must resolve each blob ID and handle a missing or unexpected blob. The extension that stores a `CoverArt` gates the write, not this package.

## Who Uses It

[`release_cover_art`](/move/framework/release-cover-art/) stores an `Option<CoverArt>` for the album cover and per-track overrides in a [`ReleaseTrackData<Option<CoverArt>>`](/move/framework/release-track-data/), set with the `ReleaseAdminCap`. Call `cover_art::new` and pass the result to `release_cover_art::set_cover` in the same programmable transaction. The extension's events carry the blob IDs, so an indexer need not read the Release.

## Deployment

`cover_art` depends only on the Sui framework. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/Published.toml) records:

- Mainnet: `published-at = "0x0d2a68cbe10a1724af7bf5036a78dcb4d39a9c1fa853076a629c2dff0740a101"`. Postdates the last source change: matches this source.
- Testnet: `published-at = "0x97ae14cddfc69650c81022cbe10012b06f3065cf81077bda2c784706bbe129cd"`. Predates the change from an earlier blob wrapper to plain `u256` blob IDs. Check its `CoverArt` layout and API before use.

`release_cover_art` accepts only the `CoverArt` type of the `cover_art` package it links. The README states no audit status. The 2 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/sources/cover_art.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/cover_art/tests/cover_art_tests.move).
