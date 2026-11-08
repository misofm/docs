---
title: Framework
description: Every misofm/framework package, grouped by job, and how royalties flow.
---

Framework packages add optional data and behavior to the [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocols: titles, credits, revenue sharing, release licenses, royalties, Record sales, and Players. Pick only the packages your product uses. All live in [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7).

Each top-level directory is a separate, immutable Move package with its own manifest and its own page, titled with the package name.

## How Revenue Moves

Continuing the [overview's example](/move/music-protocol/): Whitney Houston's master of "I Will Always Love You" is the first track on a release sold as a Record.

```text
Record sale ─→ ReleaseLicense ──forward by splits──→ each track's recording pool
                                                        │
                    recording-share holders ←── claim ──┤
                                                        │ the composition's stake
                                                        ↓ sweep
                                               composition pool ──→ composition-share holders
```

1. [`record_sale`](/move/framework/record-sale/) sells the Record only when the release has an authorized [Release License](/move/framework/release-license/). It pays the whole price to the license, which splits it by fixed basis points into each track's recording pool.
2. A [Royalty Pool](/move/framework/royalty-pool/) pays the recording's registered stakes pro rata.
3. Through a [Recording Revenue Share](/move/framework/recording-revenue-share/), one stake belongs to the composition, at its published rate. Sweeping it sends royalties to the composition's pool, which pays composition-share holders.

Each step is a separate package and agreement. A sale that bypasses the release license, or a pool with no registered stakes, breaks the path. A recording revenue share is a voluntary share between two works, not a copyright license, and does not replace royalties owed under law.

Design rules (repository README):

- Compositions and recordings earn. Releases route revenue to them and earn nothing.
- Revenue enters at the work consumed: a whole-release sale through the release, a stream or single-track sale at the recording.
- A derivative pays its sources on terms the source publishes. Anyone may create the derivative. A recording shares revenue with its composition by giving it shares at the composition's published rate.
- Payment never waits on authorization. Authorization records what a source approved and never blocks money owed to it.
- The party granting a right stores it. Only the granting work writes its authorization.
- Access never depends on spending. A Record says which pressing and edition it is, not what it cost. A tier is its own pressing or edition.

## How Extensions Work

An extension adds one slice of optional typed data to a core object: a `Composition`, `Recording`, or `Release` from `miso_music`, or a `Party` from `miso_party`. Core keeps identity and relationships. Extensions add titles, credits, lyrics, names, and other descriptive fields.

- Data is a dynamic field under a key type private to the package. One extension never touches another's data.
- Every write goes through the object's `uid_mut(cap)`, which requires its admin capability. A Composition or Recording cap is bound to its work's share type, so another work's cap does not type-check. A Release or Party cap for another object aborts in the core with `EUnauthorized`. Owning shares does not authorize a write.
- Reads are permissionless.
- Every actual change emits an event with the subject's ID and the full new value, so an indexer rebuilds each field from events alone. Equal-value sets and absent clears emit nothing.

Extensions describe objects. They move no value and custody no capabilities. A stored title, credit, name, or genre is the administrator's claim, not proof of authorship or identity. A recording's [release authorization](/move/framework/release-license/#authorization) covers the release and its revenue splits, not these fields. Decide which claims to trust. Treat stored text as untrusted input.

## Actions and Plugins

An **Action** takes a raw capability or a mutable Player and returns assets to the caller, so it composes in one programmable transaction. Two exist: [`party_wallet`](/move/framework/party-wallet/) under [Party Extensions](#party-extensions) and [`player_wallet`](/move/framework/player-wallet/) under [Records and Player](#records-and-player).

Permissionless automation belongs in a separate entry-only **plugin** that holds a capability in a [`vault`](/move/framework/vault/) and calls an Action. There is deliberately no Party wallet plugin: every `party_wallet` operation returns assets to its caller, so permissionless automation would only extract them.

## Composition Extensions

The written work: preferred title, writing credits, lyrics. Several recordings can refer to one composition.

| Package | Adds |
| --- | --- |
| [`composition_credits`](/move/framework/composition-credits/) | Songwriter, composer, lyricist, arranger, adapter, and translator credits by Party ID |
| [`composition_lyrics`](/move/framework/composition-lyrics/) | Language-keyed, compressed lyrics |
| [`composition_title`](/move/framework/composition-title/) | Preferred title |

## Recording Extensions

A particular master. A studio version and a live take can carry different credits and refer to the same composition.

| Package | Adds |
| --- | --- |
| [`recording_advisory`](/move/framework/recording-advisory/) | Explicit or not explicit advisory |
| [`recording_credits`](/move/framework/recording-credits/) | Artist, performance, and production credits, including primary and featured artists |
| [`recording_genre`](/move/framework/recording-genre/) | Genres, one dynamic field per genre |
| [`recording_language`](/move/framework/recording-language/) | Ordered languages, or an explicit instrumental indication |
| [`recording_master`](/move/framework/recording-master/) | References to canonical verified [`audio`](/move/framework/audio/) masters |

## Release Extensions

How an ordered track list is presented. The release administrator can change these fields without changing the fixed track list.

| Package | Adds |
| --- | --- |
| [`release_cover_art`](/move/framework/release-cover-art/) | Cover art with optional per-track overrides |
| [`release_credits`](/move/framework/release-credits/) | Top-line primary and featured artist billing |
| [`release_description`](/move/framework/release-description/) | Editorial description |
| [`release_genre`](/move/framework/release-genre/) | Genres, one dynamic field per genre |
| [`release_kind`](/move/framework/release-kind/) | Album, EP, Mixtape, or another label |
| [`release_title`](/move/framework/release-title/) | Preferred title |

## Party Extensions

A core `Party` is an object ID plus capability-controlled administration. Renaming or rewriting a biography changes an extension field, not the ID credits refer to.

| Package | Adds |
| --- | --- |
| [`party_genre`](/move/framework/party-genre/) | Genre tags, one dynamic field per genre from the shared [`genre`](/move/framework/genre/) vocabulary |
| [`party_group`](/move/framework/party-group/) | Optional two-sided group membership: each Party stores its own half, with owned invite objects |
| [`party_name`](/move/framework/party-name/) | Display name, one non-empty `String`, separate from the profile so a rename touches only the name |
| [`party_profile`](/move/framework/party-profile/) | Profile card: short and long biographies, country, and languages, replaced as a whole |

[`party_wallet`](/move/framework/party-wallet/) is the Party's [Action](#actions-and-plugins), not an extension. With the admin cap it receives objects and coins sent to the Party's address, or redeems its accumulator funds, and returns every asset to the caller. Never send a Party's only `PartyAdminCap` to that Party's own address: receiving it back requires the same cap.

## Records and Player

| Package | Role |
| --- | --- |
| [`record`](/move/framework/record/) | The Record lifecycle: one `Pressing` per edition of a release, one numbered `Record` per purchase, created only by authorized distributors. |
| [`record_sale`](/move/framework/record-sale/) | First-party fixed-price Record sales: one price in one currency per Pressing, set once. Refuses to sell unless the release's license is authorized. Forwards proceeds through `release_license`. |
| [`player`](/move/framework/player/) | A listener's on-chain root: one slim, transferable `Player`, which other packages extend. |
| [`player_wallet`](/move/framework/player-wallet/) | An [Action](#actions-and-plugins) that receives objects and coins sent to a Player's address, or redeems its accumulator funds. Authorized by `&mut Player`; returns assets to the caller. |

## Royalties

These packages hold, route, and finance the revenue in [How Revenue Moves](#how-revenue-moves), in that order.

| Package | Role |
| --- | --- |
| [`royalty_pool`](/move/framework/royalty-pool/) | One pool per work and payout currency. Holders stake the work's shares and claim a pro-rata cut of everything paid in. |
| [`recording_revenue_share`](/move/framework/recording-revenue-share/) | A recording permanently gives its composition a share of itself at the composition's published rate. The composition holds the shares as a stake in the recording's pools. |
| [`release_license`](/move/framework/release-license/) | A release's license from its recordings: splits set once, each recording admin's authorization, and forwarding of release revenue to each track's pool. |
| [`royalty_grant`](/move/framework/royalty-grant/) | Locks a stake and grants part of its royalties to a recipient until an amount is repaid or a term ends, then returns the stake. Covers off-chain advances, producer points, and pledges. |
| [`royalty_advance`](/move/framework/royalty-advance/) | An on-chain advance: a provider escrows a payment in an offer. Accepting it pays the rights holder and creates a `royalty_grant` on their stake in one transaction. |

## Audio

Verified audio facts that a recording's masters point to.

| Package | Role |
| --- | --- |
| [`audio`](/move/framework/audio/) | `Audio<AudioVerifier>`: one canonical, frozen record of a lossless audio's measured facts, created only by a verifier type. |
| [`audio_verifier`](/move/framework/audio-verifier/) | Creates an `Audio` from facts signed by the Nautilus enclave in [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave), verified through `enclave`. |
| [`enclave`](/move/framework/enclave/) | `EnclavePolicy<App>`: verifies AWS Nitro enclave attestations and enclave-signed messages. A PCR change retires every older enclave key. Apache-2.0. |

## Libraries

Shared building blocks. They attach nothing to a work or a Party.

| Package | Role |
| --- | --- |
| [`cover_art`](/move/framework/cover-art/) | The `CoverArt` value type: a still image and an optional animation, each a Walrus blob ID. |
| [`credit`](/move/framework/credit/) | `Credit<Role>`: a party's credit on a work, with a display name and one or more roles. Used by the credit extensions. |
| [`genre`](/move/framework/genre/) | A canonical genre vocabulary as on-chain objects, shared by the genre extensions. |
| [`release_track_data`](/move/framework/release-track-data/) | `ReleaseTrackData<Data>`: one value per track of a release, aligned to its track list by construction. Used by `release_cover_art`. |
| [`release_track_iterator`](/move/framework/release-track-iterator/) | `ReleaseTrackIterator<Witness>`: a witness-gated hot potato that walks a release's track list, one typed call per track. No package uses it at this commit. |
| [`vault`](/move/framework/vault/) | Generic capability custody and temporary exact-return leases. |

## Compatibility and Deployments

Depend on a package by its directory, pinned to a full commit:

```toml
[dependencies]
royalty_pool = { git = "https://github.com/misofm/framework.git", subdir = "royalty_pool", rev = "ffbc8f0b2852932f879f00130117c5b597ea7db7" }
```

Packages in the repository depend on each other by local path. At this commit every package using the core pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). These are the core sources recorded as published on mainnet. The [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocol pages describe the same commits.

No package is upgraded in place. `Published.toml` records a deployed generation that may not match current source, so each package page says whether it does. At this commit **every package has a mainnet generation recorded after its last source change**, so mainnet matches the source on each page. [`recording_advisory`](/move/framework/recording-advisory/) follows a later commit that removed its `Cleaned` value, republished on mainnet from that source. For `audio`, `audio_verifier`, `genre`, and `vault`, the only later change is a comment marker, which does not change bytecode. Testnet entries, where present, record earlier generations.

A consumer accepts only types from the generation it links. Shared objects such as `GenreRegistry`, `AudioRegistry`, and an `EnclavePolicy` are created per generation, with IDs from each publish transaction. Before constructing a transaction, use the package IDs and API of the generation deployed on your network.

[`pay`](https://github.com/misofm/pay), [`crank`](https://github.com/misofm/crank), and [`streaming`](https://github.com/misofm/streaming) are separate repositories outside the framework. Check each one's dependency pins before combining it with framework packages.

## Licensing

Framework source is © Miso Labs, Inc. and licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/LICENSE.md). Any use except a Competing Use is permitted. Each version becomes available under Apache 2.0 two years after its release. The exception is [`enclave`](/move/framework/enclave/), licensed under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). Excerpts keep their source license. The docs' Apache license does not relicense FSL excerpts. See [Licensing](/licensing/).

Source: [Framework README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/README.md) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`.
