---
title: Recording
description: How a master has its own identity and ownership while remaining linked to its composition.
---

A recording represents a particular fixed performance and production of a [composition](/move/music-protocol/composition/): a master. A studio version, a live take, and a cover can each be distinct recordings of the same song.

In the [overview's example](/move/music-protocol/), Dolly Parton's and Whitney Houston's recordings of “I Will Always Love You” would have separate recording IDs and separate share types. Both would point to the same composition.

## A permanent composition relationship

The core `Recording<RecordingShare>` contains its own object ID and an immutable `composition_id`. Once published, a recording cannot be redirected to another composition. Integrations reading that recording agree on which underlying work it references.

That relationship is visible in the complete object definition:

```move
public struct Recording<phantom RecordingShare> has key {
    id: UID,
    composition_id: ID,
}
```

`RecordingShare` identifies this master's share type; `composition_id` points to the separate composition object. The two relationships serve different purposes.

The relationship is stored on the recording rather than maintained as a mutable list on the composition. `recording::new` takes a reference to the composition itself, so a recording can point only to a composition that exists, but it does not take the composition's admin capability. Adding a recording therefore does not change the composition or require its admin. The core is permissionless: an application that needs recording authorization must check a recognized [recording license](/move/framework/recording-license/) or another agreement.

## Recording Shares

Each master has a unique `RecordingShare` type with **100,000,000 shares and six decimals**. Shares are held as `Coin<RecordingShare>` or `Balance<RecordingShare>` values. Different recordings of the same composition have separate share types, so their ownership and allocations can differ.

The recording contract fixes its own currency conventions:

```move
const SHARE_DECIMALS: u8 = 6;
const SHARE_SYMBOL: vector<u8> = b"RSHARE";
const SHARE_NAME: vector<u8> = b"Recording Share";
const SHARE_SUPPLY: u64 = 100_000_000_000_000;
```

Core validates the currency and fixes its full supply when the recording is created. The creator receives the initial balance, while applications and extensions determine allocations. Holding shares alone pays no royalties: a revenue source must fund the relevant [royalty pool](/move/framework/royalty-pool/), and the holder must register a stake there.

## Independent ownership and administration

Every recording has its own [fixed-supply share type](#recording-shares). Recording shares and composition shares are distinct types, reflecting the separate economic interests in the master and the underlying work. Recording royalties do not automatically flow to composition share holders simply because the objects are linked.

The `RecordingAdminCap` is separate from those shares. Its ID is derived from the recording, so each recording has exactly one. It authorizes extension writes, and it is what the recording side presents to the Framework's licenses: to take a [recording license](/move/framework/recording-license/) from the composition, or to [authorize a release](/move/framework/release-license/#authorization). Share ownership alone grants none of these powers.

## One recording, multiple releases

A recording can appear on a single, an album, and a later compilation while retaining the same recording ID. Those releases refer to the existing master rather than creating copies of it.

Core does not ask the recording admin before a release includes the recording; [anyone can create a release](/move/music-protocol/release/#who-can-create-a-release) of shared recordings. Whether the admin approved a particular release is recorded on the recording itself by the Framework's [`release_license`](/move/framework/release-license/), together with that release's revenue splits. Authorizing one release does not authorize another. This preserves the distinction between identifying a master and approving how it is grouped for distribution.

## Audio and metadata live in extensions

The core recording does not contain audio, artist credits, a version name, or license terms. [Extension packages](/move/music-protocol/extensions/#recording) attach those details under the recording admin's authority. They can evolve without changing the master object's identity or its composition relationship.

`recording::new` emits the recording, admin capability, and composition IDs together, giving indexers a direct record of the core relationship. The creating transaction then calls `recording.share()`, which takes no capability and emits nothing.

```move
public struct RecordingCreatedEvent<phantom RecordingShare> has copy, drop {
    recording_id: ID,
    recording_admin_cap_id: ID,
    composition_id: ID,
}
```

Metadata and economic packages provide their own state and events.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

Source: [recording module](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/recording.move) and [protocol design](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/README.md).
