---
title: Recording
description: A master as an object with its own identity and share type, permanently linked to its composition.
---

A recording is one fixed performance and production of a [composition](/move/music-protocol/composition/): a master. A studio version, a live take, and a cover are each a distinct recording of the same song.

In the [overview's example](/move/music-protocol/), Dolly Parton's and Whitney Houston's recordings of “I Will Always Love You” have separate recording IDs and share types. Both point to the same composition.

## A permanent composition relationship

`Recording<RecordingShare>` holds its object ID and an immutable `composition_id`. A published recording cannot be redirected to another composition.

```move
public struct Recording<phantom RecordingShare> has key {
    id: UID,
    composition_id: ID,
}
```

`RecordingShare` is this master's share type. `composition_id` points to the composition object.

The link lives on the recording, not in a mutable list on the composition. `recording::new` takes a reference to the composition, so a recording can only point to an existing composition. It does not take the composition's admin capability, so adding a recording neither changes the composition nor needs its admin. Core is permissionless: an application that needs recording authorization must rely on an agreement it recognizes. A [recording revenue share](/move/framework/recording-revenue-share/) shares revenue with the composition and is not a copyright license.

## Recording Shares

Each master has a unique `RecordingShare` type with **100,000,000 shares and six decimals**, held as `Coin<RecordingShare>` or `Balance<RecordingShare>`. Recordings of one composition have separate share types, so ownership and allocations can differ.

Constants:

```move
const SHARE_DECIMALS: u8 = 6;
const SHARE_SYMBOL: vector<u8> = b"RSHARE";
const SHARE_NAME: vector<u8> = b"Recording Share";
const SHARE_SUPPLY: u64 = 100_000_000_000_000;
```

Core validates the currency and fixes the full supply at creation. The creator receives the initial balance. Applications and extensions decide allocations. Shares alone pay no royalties: a revenue source must fund the [royalty pool](/move/framework/royalty-pool/), and the holder must register a stake there.

## Independent ownership and administration

Recording and composition shares are distinct [fixed-supply types](#recording-shares), one per economic interest. Linking the objects routes no recording royalties to composition holders.

`RecordingAdminCap` is separate from shares. Its ID derives from the recording, so each recording has exactly one. It authorizes extension writes and is what the recording side presents to Framework licenses: to [share revenue](/move/framework/recording-revenue-share/) with the composition, or to [authorize a release](/move/framework/release-license/#authorization). Shares alone grant none of these powers.

## One recording, multiple releases

A recording keeps one ID across a single, an album, and a later compilation. Releases refer to the master and never copy it.

[Anyone can create a release](/move/music-protocol/release/#who-can-create-a-release) of shared recordings, with no recording admin check. The Framework's [`release_license`](/move/framework/release-license/) records on the recording whether the admin approved a release, with that release's revenue splits. Authorizing one release does not authorize another.

## Audio and metadata live in extensions

Core holds no audio, artist credits, version name, or license terms. [Extension packages](/move/framework/#recording-extensions) attach them under the recording admin's authority and can evolve without changing identity or the composition link.

`recording::new` emits the recording, admin cap, and composition IDs together, so indexers get the core relationship directly. The creating transaction then calls `recording.share()`, which takes no capability and emits nothing.

```move
public struct RecordingCreatedEvent<phantom RecordingShare> has copy, drop {
    recording_id: ID,
    recording_admin_cap_id: ID,
    composition_id: ID,
}
```

Metadata and economic packages have their own state and events.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

Source: [recording module](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/recording.move) and [protocol design](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md).
