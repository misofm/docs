---
title: Release
description: Why recordings are grouped into ordered releases, why anyone can create one, and where recording admins' authorization lives.
---

This page is for developers who group recordings into singles, EPs, albums, or compilations. It explains what a core release fixes, why creating one needs no permission, and where the recording admins' authorization and the release's revenue splits are recorded.

A release groups [recordings](/move/music-protocol/recording/) into an ordered track list. The same recording may appear on several releases. A release establishes a catalog and distribution grouping; it does not create another class of composition or master rights.

In the [overview's example](/move/music-protocol/), *The Bodyguard* soundtrack is one release that includes Whitney Houston's recording of "I Will Always Love You". A later compilation can include the same master. Each release has its own identity, while the recording and its link to the composition stay the same.

## An Ordered Track List

The complete core object:

```move
public struct Release has key {
    id: UID,
    recording_ids: vector<ID>,
}
```

`recording_ids` holds **1 to 255 distinct recording IDs** in track order. Order is part of the release: tracks A then B is a different track list from B then A. The list is fixed once the release is created, and the release refers to existing masters rather than duplicating their audio, shares, or composition links.

A release gets a fresh object ID; it is not derived from its track list. Two releases of the same recordings in the same order are distinct objects, such as an original album and its reissue.

## Who Can Create a Release

Each track is a `ReleaseTrack` value, and the only public way to make one takes the recording itself:

```move
public fun new_release_track<RecordingShare>(recording: &Recording<RecordingShare>): ReleaseTrack {
    ReleaseTrack { recording_id: object::id(recording) }
}
```

A `ReleaseTrack` can therefore only name a real `Recording` of this package. It needs no admin capability: recordings are shared objects, so any transaction can read one. `ReleaseTrack` has only `drop`, so it cannot be stored or carried into another transaction.

The opening checks of `release::new` (excerpt; the rest creates the release and its admin cap and emits `ReleaseCreatedEvent`):

```move
public fun new(tracks: vector<ReleaseTrack>, ctx: &mut TxContext): (Release, ReleaseAdminCap) {
    assert!(!tracks.is_empty(), ENoTracks);
    assert!(tracks.length() <= (u8::max_value!() as u64), ETooManyTracks);
    let recording_ids = tracks.map!(|track| track.recording_id);
    let mut keys = recording_ids.map_ref!(|recording_id| recording_id.to_address().to_u256());
    keys.merge_sort_by!(|a, b| *a <= *b);
    assert!(keys.is_sorted_by!(|a, b| *a < *b), EDuplicateRecording);
```

The excerpt shows what core checks: at least one track, at most 255, and no recording twice. Duplicates are found by sorting a copy of the IDs; the stored list keeps the caller's order. Nothing here asks a recording's admin. Anyone can create a release of any recordings, as anyone can compile a playlist.

## Authorization Lives in a Release License

Core leaves permission out on purpose. A release is derived from its recordings, and the Framework's design rule is that anyone may create a derivative while the source grants its terms through a license. The recording admins' authorization therefore lives in the Framework's [`release_license`](/move/framework/release-license/):

1. The release admin creates the release's license with one revenue split per track.
2. Each recording admin authorizes that release, with those splits, on their own recording.
3. Once every track has authorized, the license is permanently `Authorized`. A store such as [`record_sale`](/move/framework/record-sale/) refuses to sell until then.

An on-chain release is not evidence that its recordings' admins approved it. Before distributing or selling a release, check `release_license::is_authorized` or another agreement the recording admins have made.

Earlier core generations, such as commit [`3bd54d13`](https://github.com/misofm/music-protocol/tree/3bd54d135058324ce3e326e027eb300e0ceca2d8), required a `ReleaseConsent` from each recording admin and derived the release ID from the track list and a salt. This generation has neither. Published historical generations keep their own behavior.

## Administration

```move
public struct ReleaseAdminCap has key, store {
    id: UID,
    release_id: ID,
}
```

`release::new` returns the release with its admin cap, whose ID is derived from the release, so each release has exactly one. `uid_mut(release, cap)` checks `cap.release_id` against the release and aborts with `EUnauthorized` on a mismatch. The cap controls the release's extension surface, and `release_license::new` requires it to create the release's license.

The `ReleaseAdminCap` grants no administration over the included recordings. A release has no share type and earns nothing itself: [Framework](/move/framework/#how-revenue-moves) packages route release revenue to the recordings and their share holders.

`Release` has only `key`, so the creating transaction must call `release.share()`, which takes no cap and emits nothing.

## Failure Cases

| Situation | Result |
| --- | --- |
| No tracks | `new` aborts with `ENoTracks` (1). |
| More than 255 tracks | `new` aborts with `ETooManyTracks` (2). |
| A recording listed twice | `new` aborts with `EDuplicateRecording` (3). |
| Another release's admin cap | `uid_mut` aborts with `EUnauthorized` (0). |

## Events

| Event | Fields |
| --- | --- |
| `ReleaseCreatedEvent` | `release_id`, `release_admin_cap_id`, `recording_ids` in track order; emitted by `new` |

Readers can follow each recording ID to its composition. Authorization and splits come from `release_license` events.

## Fixed Relationships, Extensible Presentation

Titles, artwork, credits, and other presentation data belong to [extensions](/move/music-protocol/extensions/#release). They are managed around the fixed track list without expanding the core release model.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/LICENSE).

Source: pinned [release module](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/sources/release.move) and [tests](https://github.com/misofm/music-protocol/blob/bc547c79a2d3a6db6543ba7b12260ce70b93731c/tests/release_tests.move) at commit `bc547c79a2d3a6db6543ba7b12260ce70b93731c`.
