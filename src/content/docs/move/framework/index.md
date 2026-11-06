---
title: Framework
description: Every package in misofm/framework, covering the data extensions for works and Parties, Records and the Player, royalties, verified audio, and shared libraries.
---

This page is for developers deciding which Miso packages to build on beyond the core protocols. It maps the packages in [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7) to the jobs they do, and shows how the royalty packages pass revenue between compositions, recordings, and releases.

The [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocols supply identities and relationships. Framework packages add the data and behavior a product needs on top of them: titles, credits, and other descriptive fields, and the ability to share a recording's revenue with its composition, license a release from its recordings, pay royalties, sell Records, and give each listener a Player. Every top-level directory of the repository is a separate Move package with its own manifest, published as its own immutable package. A product depends only on the packages it uses.

Every package below has its own page, titled with the package name.

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

## How Extensions Work

An extension adds one slice of optional typed data to a core object: a `Composition`, `Recording`, or `Release` from `miso_music`, or a `Party` from `miso_party`. The core keeps each object's identity and relationships; extensions add titles, credits, lyrics, names, and other descriptive fields without expanding it.

- Each extension stores its data as a dynamic field under a key type private to its package, so a change to one extension never touches another's data.
- Every write goes through the object's `uid_mut(cap)`, which requires the object's admin capability. A Composition or Recording cap is bound to its work's share type, so another work's cap does not type-check; a Release or Party cap for another object aborts in the core with `EUnauthorized`. Owning shares alone does not authorize a write.
- Reads are permissionless.
- Every actual change emits an event carrying the subject's ID and the full new value, so an indexer can rebuild each field from events alone. Equal-value sets and absent clears emit nothing.

Extensions describe objects; they do not move value or custody capabilities. A stored title, credit, name, or genre is a claim by the object's administrator, not proof of authorship or identity, and a recording's [release authorization](/move/framework/release-license/#authorization) covers the release and its revenue splits, not these presentation fields. Applications decide which claims they trust and treat stored text as untrusted input.

## Actions and Plugins

An **Action** accepts a raw capability, or a mutable Player, and returns assets to the caller, so it composes with other calls in one programmable transaction. The repository has two: [`party_wallet`](/move/framework/party-wallet/) under [Party Extensions](#party-extensions) and [`player_wallet`](/move/framework/player-wallet/) under [Records and Player](#records-and-player).

Permissionless automation, when a product needs it, belongs in a separate entry-only **plugin** that holds a capability in a [`vault`](/move/framework/vault/) and calls an Action rather than reimplementing it. The repository deliberately has no Party wallet plugin: every `party_wallet` operation returns assets to its caller, so permissionless automation would only create a way to extract them.

## Composition Extensions

The written work: its preferred title, writing credits, and lyrics. Several recordings can refer to the one composition that carries them.

| Package | Adds |
| --- | --- |
| [`composition_credits`](/move/framework/composition-credits/) | Songwriter, composer, lyricist, arranger, adapter, and translator credits by Party ID |
| [`composition_lyrics`](/move/framework/composition-lyrics/) | Language-keyed, compressed lyrics |
| [`composition_title`](/move/framework/composition-title/) | Preferred title |

## Recording Extensions

A particular master. A studio version and a live take can carry different labels and credits while both refer to the same composition.

| Package | Adds |
| --- | --- |
| [`recording_advisory`](/move/framework/recording-advisory/) | Explicit, not explicit, or cleaned advisory |
| [`recording_credits`](/move/framework/recording-credits/) | Artist, performance, and production credits, including primary and featured artists |
| [`recording_genre`](/move/framework/recording-genre/) | Genres, one dynamic field per genre |
| [`recording_language`](/move/framework/recording-language/) | Ordered languages, or an explicit instrumental indication |
| [`recording_master`](/move/framework/recording-master/) | References to canonical verified [`audio`](/move/framework/audio/) masters |
| [`recording_version`](/move/framework/recording-version/) | Take or version label, such as Live or Radio Edit |

## Release Extensions

How an ordered track list is presented. These fields change under the release administrator without changing the fixed track list.

| Package | Adds |
| --- | --- |
| [`release_cover_art`](/move/framework/release-cover-art/) | Cover art with optional per-track overrides |
| [`release_credits`](/move/framework/release-credits/) | Top-line primary and featured artist billing |
| [`release_description`](/move/framework/release-description/) | Editorial description |
| [`release_genre`](/move/framework/release-genre/) | Genres, one dynamic field per genre |
| [`release_kind`](/move/framework/release-kind/) | Album, EP, Mixtape, or another label |
| [`release_title`](/move/framework/release-title/) | Preferred title |

## Party Extensions

A core `Party` is identity only: an object ID and capability-controlled administration. Renaming a Party or rewriting its biography changes an extension's field, not the Party ID that credits refer to.

| Package | Adds |
| --- | --- |
| [`party_genre`](/move/framework/party-genre/) | Genre tags, one dynamic field per genre from the shared [`genre`](/move/framework/genre/) vocabulary |
| [`party_group`](/move/framework/party-group/) | Optional two-sided group membership: each Party stores its own half, with owned invite objects |
| [`party_name`](/move/framework/party-name/) | Display name, one non-empty `String`, kept separate from the profile so a rename touches only the name |
| [`party_profile`](/move/framework/party-profile/) | Profile card: short and long biographies, country, and languages, replaced as a whole |

[`party_wallet`](/move/framework/party-wallet/) is the Party's [Action](#actions-and-plugins), not an extension: it receives objects and coins sent to a Party's address, or redeems the Party's accumulator funds, with the Party's admin cap, returning every asset to the caller. Never send a Party's only `PartyAdminCap` to that Party's own address: receiving it back would require the same cap.

## Records and Player

| Package | Role |
| --- | --- |
| [`record`](/move/framework/record/) | The Record lifecycle: one `Pressing` per edition of a release, one numbered `Record` per purchase, created only by authorized distributors. |
| [`record_sale`](/move/framework/record-sale/) | First-party fixed-price sales of Records: one price in one currency per Pressing, set once. Refuses to sell unless the release's license is authorized, and forwards proceeds through `release_license`. |
| [`player`](/move/framework/player/) | A listener's on-chain root: one slim, transferable `Player`, which other packages extend. |
| [`player_wallet`](/move/framework/player-wallet/) | An [Action](#actions-and-plugins) that receives objects and coins sent to a Player's address, or redeems its accumulator funds, authorized by `&mut Player` and returned to the caller. |

## Royalties

These packages hold, route, and finance the revenue described in [How Revenue Moves](#how-revenue-moves), listed in that order.

| Package | Role |
| --- | --- |
| [`royalty_pool`](/move/framework/royalty-pool/) | One pool per work and payout currency. Holders stake the work's shares and claim a pro-rata cut of everything paid in. |
| [`recording_revenue_share`](/move/framework/recording-revenue-share/) | A recording permanently gives its composition a share of itself at the rate the composition publishes. The composition holds the shares as a stake in the recording's pools. |
| [`release_license`](/move/framework/release-license/) | A release's license from its recordings: splits set once, each recording admin's authorization, and forwarding of the release's revenue to each track's pool. |
| [`royalty_grant`](/move/framework/royalty-grant/) | Locks a stake and grants part of its royalties to a recipient until an amount is repaid or a term ends, then returns the stake. Covers off-chain advances, producer points, and pledges. |
| [`royalty_advance`](/move/framework/royalty-advance/) | An on-chain advance: a provider escrows a payment in an offer, and accepting it pays the rights holder and creates a `royalty_grant` on their stake in one transaction. |

## Audio

Verified audio facts that a recording's masters point to.

| Package | Role |
| --- | --- |
| [`audio`](/move/framework/audio/) | `Audio<AudioVerifier>`: one canonical, frozen record of a lossless audio's measured facts, created only by a verifier type. |
| [`audio_verifier`](/move/framework/audio-verifier/) | Creates an `Audio` from facts signed by the Nautilus enclave in [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave), verified through `enclave`. |
| [`enclave`](/move/framework/enclave/) | `EnclavePolicy<App>`: verifies AWS Nitro enclave attestations and enclave-signed messages. A PCR change retires every older enclave key. Apache-2.0. |

## Libraries

Shared building blocks. They attach nothing to a work or a Party themselves.

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

Packages inside the repository depend on each other by local path. At this commit every package that uses the core pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). Those are the core sources recorded as published on mainnet, and the [Party](/move/party-protocol/) and [Music](/move/music-protocol/) protocol pages describe the same commits.

No package is upgraded in place. A package's `Published.toml` records a deployed generation that may not match its current source, so each package page says whether its recorded generation matches the source it describes. At this commit **every package has a mainnet generation recorded after its last source change**, so mainnet matches the source on each page. For `audio`, `audio_verifier`, `genre`, and `vault`, the only later change is a comment marker, which does not change bytecode. Testnet entries, where present, record earlier generations.

A consumer accepts only types from the package generation it links, and shared objects such as `GenreRegistry`, `AudioRegistry`, and an `EnclavePolicy` are created per generation; their IDs come from each publish transaction. Before constructing a transaction, use the package IDs and API of the generation deployed on your network.

[`pay`](https://github.com/misofm/pay), [`crank`](https://github.com/misofm/crank), and [`streaming`](https://github.com/misofm/streaming) remain separate repositories outside the framework; check each one's dependency pins before combining it with framework packages.

## Licensing

Framework source is © Miso Labs, Inc. and licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/LICENSE.md). Any use except a Competing Use is permitted, and each version becomes available under Apache 2.0 two years after its release. The exception is [`enclave`](/move/framework/enclave/), which is licensed under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). Excerpts on these pages keep their source license; the docs' Apache license does not relicense FSL excerpts. See [Licensing](/licensing/).

Source: [Framework README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/README.md) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`.
