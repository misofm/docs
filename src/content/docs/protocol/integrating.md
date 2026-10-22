---
title: Move Integration
description: Verify the core package locally, pin its Move API, and build against the right deployment.
---

This guide is for Sui Move builders who want to call the Miso Music Protocol from another package. It uses [core commit `3bd54d1`](https://github.com/misofm/music-protocol/tree/3bd54d135058324ce3e326e027eb300e0ceca2d8) as a concrete API reference. The checks below run **locally**; they do not publish a package or create on-chain works.

## Verify the source locally

You need Git and a Sui CLI with Move 2024 support. The example was checked with `sui 1.82.1-987123842623`. Clone and check out the exact revision:

```sh
git clone https://github.com/misofm/music-protocol.git
cd music-protocol
git checkout 3bd54d135058324ce3e326e027eb300e0ceca2d8
sui move test
```

At this revision, the expected final line is `Test result: OK. Total tests: 49; passed: 49; failed: 0`. The [production constructor test](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/tests/production_constructor_tests.move) exercises the share template, currency initialization, composition and recording publication, derived IDs, and events. The [release flow test](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/tests/release_e2e_tests.move) covers consent and release publication. These tests use local fixtures and test-only helpers; they are not deployment scripts.

## Pin the Move dependency

Add the core package to your own `Move.toml`. Its package name is `miso_music`:

```toml
[dependencies]
miso_music = { git = "https://github.com/misofm/music-protocol.git", rev = "3bd54d135058324ce3e326e027eb300e0ceca2d8" }
```

The core source also pins its `share` dependency. If you add an extension, inspect that extension's `Move.toml` and align its core revision with yours. A source commit describes an API, **not** a network deployment: before submitting a transaction, verify the package IDs and shared registry objects for the deployed generation you intend to use. The core repository at this commit does not provide a `Published.toml` with verified network IDs, so this guide does not prescribe Mainnet or Testnet addresses.

## Follow the creation flow

The core constructors expect an initialized share currency and its treasury cap. For each work, first publish a fresh [share coin template](/protocol/shares/#create-a-works-coin), initialize its currency, and then use the corresponding shared registry. The focused Move examples are on [Composition](/protocol/composition/#create-and-publish) and [Recording](/protocol/recording/#create-and-publish).

For a release, derive its target ID from the ordered recording IDs and 32-byte salt, collect one consent from each recording admin, then call `release::new` and `publish`. [Release Consent](/protocol/release/#release-consent) shows that flow and its exact scope. A core relationship does not grant a recording license or activate a royalty pool.

## Read and extend

- `recording::composition_id` returns the immutable parent work ID.
- `release::recording_ids` returns the ordered track list.
- `composition::uid_mut`, `recording::uid_mut`, and `release::uid_mut` expose the typed dynamic-field extension surface to callers with the matching admin cap.
- `CompositionPublishedEvent`, `RecordingPublishedEvent`, and `ReleasePublishedEvent` carry core identities and relationships. Optional metadata and economic state belong to extension packages and their events.

For paid flows, choose the [relevant packages](/packages/), then read [Royalty Pools](/packages/royalty-pool/) and [Recording Licenses](/packages/recording-license/) as needed. Creating a core object alone neither opens a pool nor licenses a recording.

Source: pinned [core README](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/README.md), [Move.toml](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/Move.toml), and [source modules](https://github.com/misofm/music-protocol/tree/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources).
