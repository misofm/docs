---
title: Move Integration
description: Verify the core package locally, pin its Move API, and find the mainnet deployment.
---

This supplemental guide is for developers inspecting the Move implementation. For the protocol design, start with the [Overview](/move/music-protocol/). It uses [core commit `bc547c7`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c), the source recorded as published on Sui mainnet, as a concrete API reference. The checks below run **locally**; they do not publish a package or create on-chain works.

## Verify the source locally

You need Git and a Sui CLI with Move 2024 support. The example was checked with `sui 1.82.2-e10772f4fafe`; the mainnet package was built with toolchain 1.82.1. Clone and check out the exact revision:

```sh
git clone https://github.com/misofm/music-protocol.git
cd music-protocol
git checkout bc547c79a2d3a6db6543ba7b12260ce70b93731c
sui move test
```

At this revision, the expected final line is `Test result: OK. Total tests: 36; passed: 36; failed: 0`. The [production constructor test](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/tests/production_constructor_tests.move) exercises the share templates, currency validation, composition and recording creation, derived IDs, and events. The [release flow test](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/tests/release_e2e_tests.move) has a third party release a shared recording. These tests use local fixtures and test-only helpers; they are not deployment scripts.

## Pin the Move dependency

Add the core package to your own `Move.toml`. Its package name is `miso_music`:

```toml
[dependencies]
miso_music = { git = "https://github.com/misofm/music-protocol.git", rev = "bc547c79a2d3a6db6543ba7b12260ce70b93731c" }
```

The core pins its one Move dependency, [`share`](https://github.com/unconfirmedlabs/share/tree/159f50d5357730b49dd1aeb0b6f41d542c87c776), which validates each work's share currency and fixes its supply. The [Framework](/move/framework/#compatibility-and-deployments) packages pin this same core commit. If you add an extension or Framework package, inspect its `Move.toml` and align its core revision with yours.

## Find the deployment

The repository's [`Published.toml`](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/Published.toml) records one deployment of this source:

| Network | Object | ID |
| --- | --- | --- |
| Mainnet | `miso_music` package | `0x0d958fc04212d0be5c92fd89964e6d2fa1065be489b19eaf7668f77ca46c6dba` |
| Mainnet | `CompositionRegistry` (shared) | `0x2899a1a60678bbfa5d65ec27312c46b1325c188fb67b4e7babff00e57a62ef21` |
| Mainnet | `RecordingRegistry` (shared) | `0xa92d103199a5e062546cb014582d3ab363daa84ff1ec2d3252bd1eb346062443` |

The registry IDs come from the objects created by the package's publish transaction, `9BH5hC3TaJc9A79Q1wcDwpnZ3dMiuVU8nEY9VmCTACvv` (October 30, 2026). Verify them against that transaction on a mainnet explorer or RPC before relying on them. There is no recorded testnet deployment at this commit. The repository README still says the package is not yet published; `Published.toml` is the newer record.

## Follow the creation flow

Each work needs its own share currency, published from an unchanged copy of the `composition_share` or `recording_share` template in the repository's `templates/` directory. The core constructors take that currency and its treasury cap:

1. `composition::new(registry, currency, treasury_cap)` returns the composition, its admin cap, and the full share supply as a `Balance`, and emits `CompositionCreatedEvent`. Call `composition.share()` in the same transaction.
2. `recording::new(registry, currency, composition, treasury_cap)` does the same for a recording, taking a reference to its composition, and emits `RecordingCreatedEvent`. Call `recording.share()`.
3. For a release, call `release::new_release_track(recording)` for each recording in track order, pass the vector to `release::new`, and call `release.share()`. No recording admin's consent is needed; [Release](/move/music-protocol/release/#authorization-lives-in-a-release-license) explains where that authorization lives.

The `share` functions take no capability and emit nothing. The [production constructor test](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/tests/production_constructor_tests.move) shows the template initialization and constructor calls in context. The [Share Types](/move/music-protocol/#share-types) section explains why each work has its own share type. A core relationship does not grant a recording license, authorize a release, or open a royalty pool.

## Read and extend

- `recording::composition_id` returns the immutable parent work ID.
- `release::recording_ids` returns the ordered track list.
- `composition::derive_address<CompositionShare>(registry)` and `recording::derive_address<RecordingShare>(registry)` return where a work with that share type lives.
- `composition::uid_mut`, `recording::uid_mut`, and `release::uid_mut` expose the typed dynamic-field extension surface to callers with the matching admin cap.
- `CompositionCreatedEvent`, `RecordingCreatedEvent`, and `ReleaseCreatedEvent` carry core identities and relationships, emitted by each `new`. Optional metadata and economic state belong to extension packages and their events.

Earlier generations, such as commit `3bd54d1`, used `publish(cap)` with `*PublishedEvent` events, a `ReleaseRegistry`, salted release IDs, and `ReleaseConsent`. Match bindings and event decoding to the generation you use.

For paid flows, choose the [relevant packages](/move/), then read [Royalty Pools](/move/framework/royalty-pool/), [Recording Licenses](/move/framework/recording-license/), and [Release Licenses](/move/framework/release-license/) as needed. Creating a core object alone neither opens a pool nor licenses a recording.

Source: pinned [core README](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md), [Move.toml](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/Move.toml), [Published.toml](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/Published.toml), and [source modules](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources).
