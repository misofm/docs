---
title: Release Track Iterator
description: A witness-gated hot potato that walks a release's tracks in order, proving a package visited every one.
---

`ReleaseTrackIterator<Witness>` walks a release's tracks in order in one programmable transaction, one typed call per track, and cannot finish until every track is visited. Use it when your package must act on every track. It is a library: it stores nothing and emits no events.

## Why One Call per Track

To call a function on each track of *The Bodyguard* soundtrack, including "I Will Always Love You", taking the track's `Recording<RecordingShare>` or `RoyaltyPool<RecordingShare, Currency>`: each [Recording](/move/music-protocol/recording/) has its own share type and Move generics are fixed at compile time, so no function can loop over tracks. The transaction issues one command per track, each with that track's type arguments.

Sending funds needs no type: [`release_license`](/move/framework/release-license/) forwards release revenue to each track's [royalty pool](/move/framework/royalty-pool/) address in one call. Use the iterator only when you need the typed object.

The loop now lives in the transaction, where a caller could skip, repeat, or stop early. The iterator restores the guarantees: the consuming module starts it, advances it once per command, and cannot finish it until every track is visited.

## The Iterator

```move
public struct ReleaseTrackIterator<phantom Witness> {
    release_id: ID,
    recording_ids: vector<ID>,
    position: u8,
}
```

No abilities: it is a hot potato that cannot be stored, copied, or dropped, and the transaction fails unless `finish` consumes it. It copies the release's recording IDs at start, which stay accurate because a core [Release](/move/music-protocol/release/) never changes its track list. `position` is the index of the next track. A release has at most 255 tracks, so positions and counts are `u8`.

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

- **Only the consuming module drives it.** Each function takes a `Witness` that only the defining module can construct. Unless that module hands out its witness, only it can start, advance, or finish its iterators.
- **Tracks come in order, each once.** `next` returns the ID at `position` and advances by one. No skipping or rewinding.
- **Every track is visited.** `finish` aborts unless `position` has reached the end. Nothing else can discard the hot potato.

`release_id`, `position`, and `remaining` (tracks not yet visited) are permissionless views. Iterators with different witness types over the same release advance independently.

## Using It in a Package

Define a witness with `drop`. Usually wrap the iterator in your own hot potato beside the state each step needs, such as the `Balance<Currency>` being distributed. Expose three functions, called in order:

1. Start: calls `new(release, Witness())` and returns the wrapper.
2. Step, generic over the track's share type: calls `next(Witness())` and acts on that track. Call once per track, with that track's type arguments.
3. Finish: unwraps the wrapper, settles remaining state, and calls `finish(Witness())`.

**Check the recording at each step.** `next` returns only an ID and the iterator never sees the `Recording` or pool passed to the step. Check that the object is the track `next` returned, for example `object::id(recording) == recording_id`. Otherwise a caller can pass a different recording at each step.

**Keep the witness private.** A public function returning the witness, or a witness type anyone can construct, lets any caller drive your iterators and defeats the ordering guarantee.

## Who Uses It

No framework package depends on `release_track_iterator` at this commit. `release_license` and `royalty_pool` read `release.recording_ids()` directly, since forwarding by address needs no typed call. For per-track data, see [`release_track_data`](/move/framework/release-track-data/).

## Failure Cases

| Situation | Result |
| --- | --- |
| `next` after the last track | Aborts with `ENoTracksRemaining` (0). |
| `finish` before every track has been visited | Aborts with `ETracksRemaining` (1). |
| A transaction that ends without calling `finish` | The transaction fails to execute; nothing applies. |

## Events

None. The consuming package emits events for what it does at each track.

## Deployment

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/Published.toml) records one mainnet generation, `published-at = "0x1e8f88c1baab969ded715f3c58f640c600fd61eed11d10849c2d77e1f5ec5d9a"`, recorded after the last source and core pin change, so it matches this source. No testnet generation. No audit status in the README. The 9 unit tests pass locally; some build an empty release with a test-only constructor, which core `release::new` does not allow. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/sources/release_track_iterator.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_iterator/tests/release_track_iterator_tests.move).
