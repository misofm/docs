---
title: Release Cover Art
description: An album cover and optional per-track cover overrides on a Release.
---

`release_cover_art` stores an album cover and per-track overrides on a [Release](/move/music-protocol/release/). Use it to set or show a release's artwork.

## An Album Cover with Track Overrides

The admin of *The Bodyguard* soundtrack sets one album cover and gives track 0, "I Will Always Love You", its own artwork. Every other track shows the album cover.

```move
public struct ReleaseCoverArt has store {
    cover: Option<CoverArt>,
    track_covers: ReleaseTrackData<Option<CoverArt>>,
}

public struct ReleaseCoverArtKey() has copy, drop, store;
```

One dynamic field on the release, under `ReleaseCoverArtKey()`. `cover` is the album cover. `track_covers` is one optional override per track in track-list order, a [`release_track_data`](/move/framework/release-track-data/) array sized from `recording_ids` when the record is first attached. The track list is fixed at creation, so slots stay aligned.

Each value is a [`cover_art`](/move/framework/cover-art/) `CoverArt`: the Walrus blob ID of a still image (`u256`) and an optional blob ID for an animated version. Cover art is public. Only blob IDs are stored. Nothing checks that a blob exists, holds an image, or is still stored.

## Resolving a Track's Cover

```move
public fun track_cover(release: &Release, track_index: u8): Option<CoverArt> {
    assert!((track_index as u64) < release.recording_ids().length(), ETrackIndexOutOfBounds);
    let record = borrow(release.uid());
    let override = record.track_covers.borrow(track_index);
    if (override.is_some()) *override else record.cover
}
```

A track's cover is its override if set, otherwise the album cover. It can still be `none`: with an override on track 0 and no album cover, track 1 has none. `track_index` is the position in `release.recording_ids()`. At most 255 tracks, so `u8`.

Views are permissionless:

- `has_cover_art(release)`: true while an album cover or any override is set.
- `cover(release)`: the album cover as `&Option<CoverArt>`, `none` when only overrides are set.
- `track_cover_override(release, i)`: track `i`'s raw slot, without the fallback.

`cover`, `track_cover`, and `track_cover_override` abort with `ENoCoverArt` when no record is attached, so check `has_cover_art` first.

## Setting and Clearing

Every write takes the release's `ReleaseAdminCap` and goes through core `uid_mut(cap)`. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not its artwork, so the release admin changes covers without asking recording admins.

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

`borrow_mut_or_init` calls `uid_mut(cap)` and attaches an empty record on the first write, so a mismatched cap aborts before the index is checked. Setting a value already held writes and emits nothing; `set_cover` does the same.

Both clears are silent when nothing is set. A clear that leaves no album cover and no override removes the record, so `has_cover_art` becomes false. Indexers can derive `has_cover_art` by replaying set and clear events.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/Published.toml) records a mainnet publication at `0xdd4840c2b5360e50a43d51d0ee60885c309805666078f9ab2b3c781e7e49b5c1`, recorded after the last change to this package's source and manifest and to its local dependencies `cover_art` and `release_track_data`, so it matches this source. The testnet entry predates this source: recorded before the package was repinned to the mainnet core. The README mentions no audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 30 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/sources/release_cover_art.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/tests).
