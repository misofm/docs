---
title: Framework
description: Miso's economic model, Record sales, the Player, and shared libraries, built as separate Move packages in misofm/framework.
---

This page is for developers deciding which Miso packages to build on beyond the core protocols. It maps the packages in [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7) to the jobs they do, and shows how the economic packages pass revenue between compositions, recordings, and releases.

The [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocols supply identities and relationships. Framework packages add what a product does with them: share a recording's revenue with its composition, license a release from its recordings, pay royalties, sell Records, and give each listener a Player. Every top-level directory of the repository is a separate Move package with its own manifest, published as its own immutable package. A product depends only on the packages it uses.

The repository also holds the optional data extensions for those objects. Each has its own page, grouped by object under [Music Protocol Extensions](/move/music-protocol/extensions/) and [Party Protocol Extensions](/move/party-protocol/extensions/). Every package below links to its page.

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

1. [`record_sale`](/move/framework/record-sale/) sells the Record only when the release has an authorized [Release License](/move/framework/release-license/). It pays the whole price to that license, which splits it by fixed basis points into each track's recording pool.
2. A [Royalty Pool](/move/framework/royalty-pool/) pays the recording's registered share stakes in proportion to their shares.
3. Because the recording shares revenue with its composition through a [Recording Revenue Share](/move/framework/recording-revenue-share/), one of those stakes is the composition's: the recording gave it the composition's published rate of its shares. Sweeping that stake sends its royalties to the composition's pool, which pays composition-share holders.

Each step is a separate package and a separate agreement. A sale that bypasses the release license, or a pool with no registered stakes, does not complete this path. A recording revenue share is a voluntary share between two works, not a copyright license, and does not replace royalties owed under law.

The repository README states the design rules behind the path:

- Compositions and recordings earn. Releases route revenue to them and earn nothing themselves.
- Revenue enters at the work that was consumed: a whole-release sale through the release, a stream or single-track sale at the recording.
- A derivative work pays its sources on terms the source publishes. Anyone may create the derivative. A recording shares revenue with its composition by giving it shares at the composition's published rate.
- Payment never waits on authorization. Authorization records what a source approved; it never blocks money owed to it.
- The party granting a right stores it. Each authorization is written by the work that grants it, and no one else can.
- Access never depends on spending. A Record says which pressing and edition it is, not what it cost; a tier is its own pressing or edition.

## Economics

| Package | Role |
| --- | --- |
| [`royalty_pool`](/move/framework/royalty-pool/) | One pool per work and payout currency. Holders stake the work's shares and claim a pro-rata cut of everything paid in. |
| [`recording_revenue_share`](/move/framework/recording-revenue-share/) | A recording permanently gives its composition a share of itself at the rate the composition publishes. The composition holds the shares as a stake in the recording's pools. |
| [`release_license`](/move/framework/release-license/) | A release's license from its recordings: splits set once, each recording admin's authorization, and forwarding of the release's revenue to each track's pool. |
| [`royalty_grant`](/move/framework/royalty-grant/) | Locks a stake and grants part of its royalties to a recipient until an amount is repaid or a term ends, then returns the stake. Covers off-chain advances, producer points, and pledges. |
| [`royalty_advance`](/move/framework/royalty-advance/) | An on-chain advance: a provider escrows a payment in an offer, and accepting it pays the rights holder and creates a `royalty_grant` on their stake in one transaction. |

## Records and the Player

| Package | Role |
| --- | --- |
| [`record`](/move/framework/record/) | The Record lifecycle: one `Pressing` per edition of a release, one numbered `Record` per purchase, created only by authorized distributors. |
| [`record_sale`](/move/framework/record-sale/) | First-party fixed-price sales of Records: one price in one currency per Pressing, set once. Refuses to sell unless the release's license is authorized, and forwards proceeds through `release_license`. |
| [`player`](/move/framework/player/) | A listener's on-chain root: one slim, transferable `Player`, which other packages extend. |

## Actions and Libraries

An **Action** accepts a raw capability, or here a mutable Player, and returns assets to the caller, so it composes with other calls in one programmable transaction. The repository has two:

| Package | Role |
| --- | --- |
| [`party_wallet`](/move/framework/party-wallet/) | Receives objects and coins sent to a Party's address, or redeems the Party's accumulator funds, with the Party's admin cap, returning every asset to the caller. |
| [`player_wallet`](/move/framework/player-wallet/) | The same inbox operations for a Player's address, authorized by `&mut Player` instead of an admin cap. |

Libraries are shared building blocks. They attach nothing to a work or a Party themselves.

| Package | Role |
| --- | --- |
| [`vault`](/move/framework/vault/) | Generic capability custody and temporary exact-return leases. |
| [`enclave`](/move/framework/enclave/) | `EnclavePolicy<App>`: verifies AWS Nitro enclave attestations and enclave-signed messages. A PCR change retires every older enclave key. Apache-2.0. |
| [`audio`](/move/framework/audio/) | `Audio<AudioVerifier>`: one canonical, frozen record of a lossless audio's measured facts, created only by a verifier type. |
| [`audio_verifier`](/move/framework/audio-verifier/) | Creates an `Audio` from facts signed by the Nautilus enclave in [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave), verified through `enclave`. |
| [`credit`](/move/framework/credit/) | `Credit<Role>`: a party's credit on a work, with a display name and one or more roles. Used by the credit extensions. |
| [`genre`](/move/framework/genre/) | A canonical genre vocabulary as on-chain objects, shared by the genre extensions. |
| [`cover_art`](/move/framework/cover-art/) | The `CoverArt` value type: a still image and an optional animation, each a Walrus blob ID. |
| [`release_track_data`](/move/framework/release-track-data/) | `ReleaseTrackData<Data>`: one value per track of a release, aligned to its track list by construction. Used by `release_cover_art`. |
| [`release_track_iterator`](/move/framework/release-track-iterator/) | `ReleaseTrackIterator<Witness>`: a witness-gated hot potato that walks a release's track list, one typed call per track. No package uses it at this commit. |

Permissionless automation, when a product needs it, belongs in a separate entry-only **plugin** that holds a capability in a `vault` and calls an Action rather than reimplementing it. The repository deliberately has no Party wallet plugin: every `party_wallet` operation returns assets to its caller, so permissionless automation would only create a way to extract them.

## Renamed and Retired Packages

Several packages were renamed in the framework, and each rename is a new package identity:

| Earlier package | Now |
| --- | --- |
| `recording_license` | [`recording_revenue_share`](/move/framework/recording-revenue-share/), recast as a voluntary revenue share rather than a license |
| `record_shop` | [`record_sale`](/move/framework/record-sale/), fixed price only |
| `miso_player` | [`player`](/move/framework/player/), a transferable `Player` with no per-address registry |

`enclave` supersedes the external `unconfirmedlabs/kagi` registry that `audio_verifier` used before.

Packages that had their own repositories now live in `misofm/framework`. The standalone `royalty-pool`, `credit`, `vault`, `record`, `record-shop`, `genre`, and `cover-art` repositories are archived, and `recording-license`, `release-track-data`, `release-track-iterator`, `music-protocol-extensions`, and `party-protocol-extensions` are no longer available. The archived `vault-plugins` and `record-extensions` have no counterpart in the framework at this commit, and `party-protocol-actions` is no longer available; `party_wallet` is the framework's Party Action.

[`pay`](https://github.com/misofm/pay), [`crank`](https://github.com/misofm/crank), and [`streaming`](https://github.com/misofm/streaming) remain separate repositories outside the framework; check each one's dependency pins before combining it with framework packages.

## Compatibility and Deployments

Depend on a package by its directory, pinned to a full commit:

```toml
[dependencies]
royalty_pool = { git = "https://github.com/misofm/framework.git", subdir = "royalty_pool", rev = "ffbc8f0b2852932f879f00130117c5b597ea7db7" }
```

Packages inside the repository depend on each other by local path. At this commit every package that uses the core pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Those are the core sources recorded as published on mainnet, and the [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocol pages describe the same commits.

No package is upgraded in place. A package's `Published.toml` records a deployed generation that may not match its current source, so each package page says whether its recorded generation matches the source it describes. At this commit **every package has a mainnet generation recorded after its last source change**, so mainnet matches the source on each page. For `audio`, `audio_verifier`, `genre`, and `vault`, the only later change is a comment marker, which does not change bytecode. Testnet entries, where present, record earlier generations.

A consumer accepts only types from the package generation it links, and shared objects such as `GenreRegistry`, `AudioRegistry`, and an `EnclavePolicy` are created per generation; their IDs come from each publish transaction. Before constructing a transaction, use the package IDs and API of the generation deployed on your network.

## Licensing

Framework source is © Miso Labs, Inc. and licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/LICENSE.md). Any use except a Competing Use is permitted, and each version becomes available under Apache 2.0 two years after its release. The exception is [`enclave`](/move/framework/enclave/), which is licensed under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). Excerpts on these pages keep their source license; the docs' Apache license does not relicense FSL excerpts. See [Licensing](/licensing/).

Source: [Framework README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/README.md) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`.
