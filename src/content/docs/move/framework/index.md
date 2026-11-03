---
title: Framework
description: Miso's economic model, Records, the Player, and shared libraries, built as separate Move packages in misofm/framework.
---

This page is for developers deciding which Miso packages to build on beyond the core protocols. It maps the packages in [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0) to the jobs they do, and shows how the economic packages pass revenue between compositions, recordings, and releases.

The [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocols supply identities and relationships. Framework packages add what a product does with them: license a recording or a release, pay royalties, sell Records, and give each listener a Player. Every top-level directory of the repository is a separate Move package with its own manifest, published as its own immutable package. A product depends only on the packages it uses.

The repository also holds the optional data extensions for those objects. They are documented by object in [Music Protocol Extensions](/move/music-protocol/extensions/) and [Party Protocol Extensions](/move/party-protocol/extensions/).

## How Revenue Moves

Carry the [overview's example](/move/music-protocol/) forward. "I Will Always Love You" is one composition, and Whitney Houston's master is a recording of it. Suppose that recording is the first track on a release sold as a Record.

```text
Record sale ─→ ReleaseLicense ──forward by splits──→ each track's recording pool
                                                        │
                    recording-share holders ←── claim ──┤
                                                        │ the composition's stake
                                                        ↓ sweep
                                               composition pool ──→ composition-share holders
```

1. [`record_shop`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop) sells the Record only when the release has an authorized [Release License](/move/framework/release-license/). It pays the sale to that license, which splits it by fixed basis points into each track's recording pool.
2. A [Royalty Pool](/move/framework/royalty-pool/) pays the recording's registered share stakes in proportion to their shares.
3. Because the recording took a [Recording License](/move/framework/recording-license/), one of those stakes is the composition's cut. Sweeping it sends that money to the composition's pool, which pays composition-share holders.

Each step is a separate package and a separate agreement. A sale that bypasses the release license, or a pool with no registered stakes, does not complete this path.

The repository README states the design rules behind the path:

- Compositions and recordings earn. Releases route revenue to them and earn nothing themselves.
- Revenue enters at the work that was consumed: a whole-release sale through the release, a stream or single-track sale at the recording.
- A derivative work pays its sources through a license that the source grants. Anyone may create the derivative; the license agrees its terms.
- Payment never waits on authorization. Authorization records what a source approved; it never blocks money owed to it.
- The party granting a right stores it. Each authorization is written by the work that grants it.

## Economics

| Package | Role |
| --- | --- |
| [`royalty_pool`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_pool) | One pool per work and payout currency. Holders stake the work's shares and claim a pro-rata cut of everything paid in. [Read the guide](/move/framework/royalty-pool/). |
| [`recording_license`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/recording_license) | A composition's standing license to record it. The recording pays the composition's rate as a stake of recording shares. [Read the guide](/move/framework/recording-license/). |
| [`release_license`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license) | A release's license from its recordings: fixed splits, each recording admin's authorization, and forwarding of the release's revenue to each track's pool. [Read the guide](/move/framework/release-license/). |
| [`royalty_grant`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant) | Locks a stake and grants part of its royalties to a recipient until an amount is repaid or a term ends, then returns the stake. Covers off-chain advances, producer points, and pledges. |
| [`royalty_advance`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_advance) | An on-chain advance: a provider escrows a payment in an offer, and accepting it pays the rights holder and creates a `royalty_grant` on their stake in one transaction. |

## Records and the Player

| Package | Role |
| --- | --- |
| [`record`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record) | The Record lifecycle: one `Pressing` per edition of a release, one numbered `Record` per purchase. |
| [`record_shop`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop) | First-party fixed- or floor-price sales of Records. Refuses to sell unless the release's license is authorized, and forwards proceeds through `release_license`. |
| [`miso_player`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player) | A listener's on-chain root: one non-transferable `Player` per address, which other packages extend. |

## Actions and Libraries

An **Action** accepts a raw admin capability and returns assets to the caller, so it composes with other calls in one programmable transaction. [`party_wallet`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet) is the Action in this repository: it receives objects and coins sent to a Party's address, or redeems the Party's accumulator funds, and returns every asset to the caller. It stores no profile data.

Libraries are shared building blocks. They attach nothing to a work or a Party themselves.

| Package | Role |
| --- | --- |
| [`audio`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/audio) | `Audio<AudioVerifier>`: one canonical, verified, frozen record of a lossless audio file's facts. |
| [`audio_verifier`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/audio_verifier) | Creates an `Audio` from facts signed by the Nautilus enclave in [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave). |
| [`credit`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/credit) | `Credit<Role>`: a party's credit on a work, with a display name and one or more roles. Used by the credit extensions. |
| [`genre`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/genre) | A canonical genre vocabulary as on-chain objects, shared by the genre extensions. |
| [`cover_art`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/cover_art) | The `CoverArt` value type: a still image and an optional animation, each a Walrus blob ID. |
| [`vault`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/vault) | Generic capability custody and temporary exact-return leases. |
| [`release_track_data`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_track_data) | `ReleaseTrackData<Data>`: one value per track of a release, aligned to its track list by construction. |
| [`release_track_iterator`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_track_iterator) | `ReleaseTrackIterator<Witness>`: a witness-gated hot potato that walks a release's track list, one typed call per track. |

Permissionless automation, when a product needs it, belongs in a separate entry-only **plugin** that holds a capability in a `vault` and calls an Action rather than reimplementing it. The repository deliberately has no Party wallet plugin: every `party_wallet` operation returns assets to its caller, so permissionless automation would only create a way to extract them.

## Where the Old Repositories Went

Packages that had their own repositories now live in `misofm/framework`. The standalone `royalty-pool`, `credit`, `vault`, `record`, `record-shop`, `genre`, and `cover-art` repositories are archived, and `recording-license`, `release-track-data`, `release-track-iterator`, `music-protocol-extensions`, and `party-protocol-extensions` are no longer available. The archived `vault-plugins` and `record-extensions` have no counterpart in the framework at this commit, and `party-protocol-actions` is no longer available; `party_wallet` is the framework's Party Action.

[`pay`](https://github.com/misofm/pay), [`crank`](https://github.com/misofm/crank), and [`streaming`](https://github.com/misofm/streaming) remain separate repositories outside the framework; check each one's dependency pins before combining it with framework packages.

## Compatibility and Deployments

Depend on a package by its directory, pinned to a full commit:

```toml
[dependencies]
royalty_pool = { git = "https://github.com/misofm/framework.git", subdir = "royalty_pool", rev = "3a7d223b94f566d9e714a0a6b26efe2549e7bad0" }
```

Packages inside the repository depend on each other by local path. At this commit every package that uses the core pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Those are newer than the core revisions some protocol pages still describe, so check the core API at those commits when combining packages.

No package is upgraded in place. A package's `Published.toml` records a deployed generation that may not match its current source. For example, the recorded mainnet `royalty_pool` was published before the source renamed its modules to `royalty_pool` and `royalty_pool_stake`. `recording_license`, `release_license`, `royalty_grant`, `royalty_advance`, `miso_player`, and `audio_verifier` record no deployment at this commit. Before constructing a transaction, use the package IDs and API of the generation deployed on your network.

## Licensing

Framework source is © Miso Labs, Inc. and licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/LICENSE.md). Any use except a Competing Use is permitted, and each version becomes available under Apache 2.0 two years after its release. Excerpts on these pages keep that license; the docs' Apache license does not relicense them. See [Licensing](/licensing/).

Source: [Framework README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/README.md) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`.
