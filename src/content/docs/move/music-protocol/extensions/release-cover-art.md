---
title: Release Cover Art
description: Attach an album cover and optional per-track cover overrides to a Release.
---

This page is for developers who display or set a release's artwork. It explains how `release_cover_art` stores an album cover and per-track overrides on a [Release](/move/music-protocol/release/), how a track's effective cover resolves, and when the record is attached and removed.

## An Album Cover with Track Overrides

Suppose *The Bodyguard* soundtrack is a Release whose first track is Whitney Houston's recording of "I Will Always Love You". The release admin sets one album cover for the whole release and gives track 0 its own artwork. Every other track shows the album cover.

```move
public struct ReleaseCoverArt has store {
    cover: Option<CoverArt>,
    track_covers: ReleaseTrackData<Option<CoverArt>>,
}

public struct ReleaseCoverArtKey() has copy, drop, store;
```

The whole record is one dynamic field on the release under `ReleaseCoverArtKey()`. `cover` is the album cover. `track_covers` holds one optional override per track, in track-list order. It is a [`release_track_data`](/move/framework/release-track-data/) array, sized from the release's `recording_ids` when the record is first attached. A Release's track list is fixed at creation, so the slots stay aligned with the tracks.

Each value is a [`cover_art`](/move/framework/cover-art/) `CoverArt`: the Walrus blob ID of a still image, as a `u256`, and an optional blob ID for an animated version. Cover art is public. The package stores only blob IDs; it does not check that a blob exists, holds an image, or is still stored.

## Resolving a Track's Cover

```move
public fun track_cover(release: &Release, track_index: u8): Option<CoverArt> {
    assert!((track_index as u64) < release.recording_ids().length(), ETrackIndexOutOfBounds);
    let record = borrow(release.uid());
    let override = record.track_covers.borrow(track_index);
    if (override.is_some()) *override else record.cover
}
```

A track's effective cover is its override when one is set, otherwise the album cover. The result can still be `none`: a release with an override on track 0 and no album cover has no cover for track 1. `track_index` is the track's position in `release.recording_ids()`; a Release has at most 255 tracks, so a `u8` covers them all.

The other views are permissionless too. `has_cover_art(release)` is true while an album cover or any override is set. `cover(release)` returns the album cover as `&Option<CoverArt>`, which is `none` when only overrides are set. `track_cover_override(release, i)` returns track `i`'s raw slot, without the fallback. All three of `cover`, `track_cover`, and `track_cover_override` abort with `ENoCoverArt` when no record is attached, so check `has_cover_art` first.

## Setting and Clearing

Every write takes the release's `ReleaseAdminCap` and reaches the release through the core's `uid_mut(cap)`. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not its artwork, so the release admin can change the cover without asking the recording admins.

| Function | Effect |
| --- | --- |
| `set_cover(release, cap, art)` | Sets or replaces the album cover. |
| `clear_cover(release, cap)` | Removes the album cover; overrides stay. |
| `set_track_cover(release, cap, i, art)` | Sets or replaces track `i`'s override. |
| `clear_track_cover(release, cap, i)` | Removes track `i`'s override, so it falls back to the album cover. |

```move
public fun set_track_cover(
    release: &mut Release,
    cap: &ReleaseAdminCap,
    track_index: u8,
    art: CoverArt,
) {
    let release_id = object::id(release);
    let track_count = release.recording_ids().length();
    let record = borrow_mut_or_init(release, cap);
    assert!((track_index as u64) < track_count, ETrackIndexOutOfBounds);
    let slot = record.track_covers.borrow_mut(track_index);
    if (slot.contains(&art)) return;
    slot.swap_or_fill(art);
    emit(ReleaseTrackCoverArtSetEvent {
        release_id,
        track_index,
        still_blob_id: art.still_blob_id(),
        animated_blob_id: art.animated_blob_id(),
    });
}
```

`borrow_mut_or_init` calls `uid_mut(cap)` and attaches an empty record on the first write, so a mismatched cap aborts before the index is checked. Setting the value a slot already holds returns without writing or emitting; `set_cover` follows the same pattern for the album cover.

Both clears are silent when there is nothing to clear. When a clear leaves no album cover and no override, it removes the record, and `has_cover_art` becomes false. An indexer can therefore derive `has_cover_art` by replaying the set and clear events.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another release's admin cap | Every write aborts with `miso_music::release::EUnauthorized` (0) before any other check. |
| A track index at or past the number of tracks | `set_track_cover`, `clear_track_cover`, `track_cover`, and `track_cover_override` abort with `ETrackIndexOutOfBounds` (1). |
| A view on a release with no record | `cover`, `track_cover`, and `track_cover_override` abort with `ENoCoverArt` (0). |

Setting an equal value and clearing an absent one change nothing and emit no event.

## Events

| Event | Fields |
| --- | --- |
| `ReleaseCoverArtSetEvent` | `release_id`, `still_blob_id`, `animated_blob_id` |
| `ReleaseCoverArtClearedEvent` | `release_id` |
| `ReleaseTrackCoverArtSetEvent` | `release_id`, `track_index`, `still_blob_id`, `animated_blob_id` |
| `ReleaseTrackCoverArtClearedEvent` | `release_id`, `track_index` |

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art/Published.toml) records a mainnet publication at `0xdd4840c2b5360e50a43d51d0ee60885c309805666078f9ab2b3c781e7e49b5c1`. It was recorded after the last change to this package's source and manifest and to its local dependencies `cover_art` and `release_track_data`, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 30 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art/sources/release_cover_art.move), and [tests](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_cover_art/tests).
