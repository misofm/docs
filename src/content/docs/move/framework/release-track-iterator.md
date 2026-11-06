---
title: Release Track Iterator
description: A witness-gated hot potato that walks a release's track list in order, so a package can make one typed call per track and prove it visited every track.
---

This page is for developers who write a package that must act on every track of a release within one programmable transaction, with a separate call for each track. It explains why such a package needs an iterator, how `ReleaseTrackIterator<Witness>` guarantees that every track is visited in order, and what the consuming module must still check.

`release_track_iterator` is a library. It stores nothing and emits no events.

## Why One Call per Track

Suppose a package must call a function on each track of *The Bodyguard* soundtrack, including Whitney Houston's "I Will Always Love You", that takes the track's `Recording<RecordingShare>` or its `RoyaltyPool<RecordingShare, Currency>`. Each [Recording](/move/music-protocol/recording/) has its own share type, so those object types differ from track to track. Move generics are fixed at compile time, so one function cannot loop over the track list and make a typed call with a different share type for each element. The programmable transaction has to issue one command per track, each with that track's type arguments.

Sending funds needs no type: [`release_license`](/move/framework/release-license/) forwards release revenue to each track's [royalty pool](/move/framework/royalty-pool/) address inside one call. The iterator is for work that needs the typed object.

That moves the loop out of Move and into the transaction, where a caller could skip a track, repeat one, or stop early. The iterator keeps the loop's guarantees: the consuming module starts it, advances it once per command, and cannot finish it until every track has been visited.

## The Iterator

```move
public struct ReleaseTrackIterator<phantom Witness> {
    release_id: ID,
    recording_ids: vector<ID>,
    position: u8,
}
```

The struct has no abilities, so it is a hot potato: it cannot be stored, copied, or dropped, and the transaction fails unless it is consumed by `finish`. It copies the release's recording IDs when it starts; because a core [Release](/move/music-protocol/release/) never changes its track list, the copy stays accurate. `position` is the index of the next track. A release has at most 255 tracks, so positions and counts are `u8`.

```move
public fun new<Witness: drop>(release: &Release, _: Witness): ReleaseTrackIterator<Witness> {
    ReleaseTrackIterator {
        release_id: object::id(release),
        recording_ids: *release.recording_ids(),
        position: 0,
    }
}

public fun next<Witness: drop>(self: &mut ReleaseTrackIterator<Witness>, _: Witness): ID {
    assert!((self.position as u64) < self.recording_ids.length(), ENoTracksRemaining);
    let recording_id = self.recording_ids[self.position as u64];
    self.position = self.position + 1;
    recording_id
}

public fun finish<Witness: drop>(self: ReleaseTrackIterator<Witness>, _: Witness) {
    let ReleaseTrackIterator { recording_ids, position, .. } = self;
    assert!((position as u64) == recording_ids.length(), ETracksRemaining);
}
```

The three functions show the guarantees:

- **Only the consuming module drives it.** Each function takes a value of the `Witness` type. A struct can be constructed only in the module that defines it, so if that module does not hand out its witness, only it can start, advance, or finish its iterators.
- **Tracks come in order, each once.** `next` returns the recording ID at `position` and moves forward by one. There is no way to skip or rewind.
- **Every track is visited.** `finish` aborts unless `position` has reached the end, and the hot potato cannot be discarded any other way.

`release_id`, `position`, and `remaining` (tracks not yet visited) are permissionless views. Iterators with different witness types over the same release advance independently.

## Using It in a Package

The consuming module defines a witness with `drop` and usually wraps the iterator in its own hot potato beside the state each step needs, such as the `Balance<Currency>` being distributed. It then exposes three functions that a transaction calls in order:

1. A start function that calls `new(release, Witness())` and returns the wrapper.
2. A step function, generic over the track's share type, that calls `next(Witness())` and acts on that track. The transaction calls it once per track, with that track's type arguments.
3. A finish function that unwraps the wrapper, settles any remaining state, and calls `finish(Witness())`.

**Check the recording at each step.** `next` returns only an ID. The iterator never sees the `Recording` or pool the caller passes to the step function, so the step must check that the object it was given is the track `next` returned, for example `object::id(recording) == recording_id`, before acting on it. Without that check a caller could pass a different recording at each step.

**Keep the witness private.** A public function that returns the witness, or a witness type anyone can construct, lets any caller drive the module's iterators and defeats the ordering guarantee.

## Who Uses It

At this commit no framework package depends on `release_track_iterator`. `release_license` and `royalty_pool` read `release.recording_ids()` directly, because forwarding funds by address needs no typed call per track. For data stored per track, see [`release_track_data`](/move/framework/release-track-data/).

## Failure Cases

| Situation | Result |
| --- | --- |
| `next` after the last track | Aborts with `ENoTracksRemaining` (0). |
| `finish` before every track has been visited | Aborts with `ETracksRemaining` (1). |
| A transaction that ends without calling `finish` | The transaction fails to execute; nothing applies. |

## Events

None. The consuming package emits events for what it does at each track.

## Deployment

`release_track_iterator` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/Published.toml) records one mainnet generation, `published-at = "0x1e8f88c1baab969ded715f3c58f640c600fd61eed11d10849c2d77e1f5ec5d9a"`, recorded after the last change to the package's sources and core pin, so it corresponds to the source on this page. It records no testnet generation. The README does not state an audit status. The 9 unit tests pass locally; some build an empty release with a test-only constructor, which the core `release::new` does not allow. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/sources/release_track_iterator.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/tests/release_track_iterator_tests.move).
