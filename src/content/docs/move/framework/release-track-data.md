---
title: Release Track Data
description: Store one value per track of a release, aligned to the release's track list when it is built.
---

This page is for developers who write a release extension that stores something for each track, such as per-track cover art. It explains how `ReleaseTrackData<Data>` stays aligned with a release's track list, how to build, read, and update it, and what it leaves to the extension that stores it.

`release_track_data` is a library. It attaches nothing to a release itself; an extension stores it inside its own dynamic field.

## One Value per Track

A [Release](/move/music-protocol/release/) is an ordered list of recording IDs, fixed when the release is created. Suppose *The Bodyguard* soundtrack's release admin gives Whitney Houston's "I Will Always Love You" its own artwork while the other tracks use the album cover. [`release_cover_art`](/move/framework/release-cover-art/) stores the overrides as a `ReleaseTrackData<Option<CoverArt>>`: one slot per track, `none` everywhere except at that track's position.

```move
public struct ReleaseTrackData<Data: store + drop>(vector<Data>) has drop, store;
```

The type is a vector whose index `i` is the `i`-th track of the release. It stores no recording IDs and no release ID: a value is found by its position in the track list, not by recording. It has `store` so an extension can keep it inside a dynamic-field value, and `drop` so the extension can discard it, which is why `Data` needs both abilities too.

Alignment is checked once, at construction, against the release's track list. A core release has between 1 and 255 tracks and its track list never changes, so a value built for a release stays aligned for that release's whole life. Indices and lengths are `u8` for the same reason.

## Building It

```move
public fun new<Data: store + drop>(
    release: &Release,
    entries: vector<Data>,
): ReleaseTrackData<Data> {
    assert!(entries.length() == release.recording_ids().length(), ELengthMismatch);
    ReleaseTrackData(entries)
}

public fun filled<Data: store + drop + copy>(
    release: &Release,
    value: Data,
): ReleaseTrackData<Data> {
    ReleaseTrackData(vector::tabulate!(release.recording_ids().length(), |_| value))
}
```

- **`new(release, entries)`** takes one value per track, in track-list order, and aborts unless there are exactly as many values as tracks.
- **`filled(release, value)`** gives every track the same value, so it needs `Data: copy`. `filled(release, option::none())` is the usual start for optional per-track overrides.

Both read only the release's track count. The check is on length, not identity: nothing in the value records which release it was built from. The extension that stores it must build it from the same release it attaches it to, as `release_cover_art` does when it first attaches its record (excerpt; the rest of the function returns the existing record when there is one, or the new record after adding it):

```move
let track_covers = release_track_data::filled(release, option::none<CoverArt>());
let uid = release.uid_mut(cap);
df::add(uid, ReleaseCoverArtKey(), ReleaseCoverArt { cover: option::none(), track_covers });
```

Because the write goes through the release's `uid_mut(cap)`, only the release admin can attach the record.

## Reading and Updating

| Function | Returns | Aborts |
| --- | --- | --- |
| `length(data)` | The number of tracks covered, as a `u8` | Never |
| `borrow(data, i)` | `&Data` for track `i` | `EIndexOutOfBounds` (0) if `i` is not below the length |
| `borrow_mut(data, i)` | `&mut Data` for track `i` | `EIndexOutOfBounds` (0) if `i` is not below the length |

`borrow_mut` checks no capability. Access control belongs to the extension: once the value sits under the extension's package-private dynamic-field key, only that extension's module can reach it mutably, and its writes go through the release's `uid_mut(cap)`. The library emits no events either. The storing extension reports changes in its own events, such as `release_cover_art`'s `ReleaseTrackCoverArtSetEvent` with its `track_index`.

## Who Uses It

At this commit, `release_cover_art` is the only framework package that depends on `release_track_data`. Packages that act on every track, such as [`release_license`](/move/framework/release-license/) and [`royalty_pool`](/move/framework/royalty-pool/), read `release.recording_ids()` directly and do not use it. A package that needs one typed call per track in a programmable transaction uses [`release_track_iterator`](/move/framework/release-track-iterator/) instead.

## Failure Cases

| Situation | Result |
| --- | --- |
| `new` with more or fewer entries than the release has tracks | Aborts with `ELengthMismatch` (1). |
| `borrow` or `borrow_mut` at an index at or past the length | Aborts with `EIndexOutOfBounds` (0). |

## Events

None. The extension that stores the value emits its own events.

## Deployment

`release_track_data` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/Published.toml) records one mainnet generation, `published-at = "0x651df92c6817dc9669fb96225937469406bfcd2ea60d8995b5ea331a6a385830"`, recorded after the last change to the package's sources and core pin, so it corresponds to the source on this page. It records no testnet generation. The README does not state an audit status. The 14 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/LICENSE.md). The `release_cover_art` excerpt is from the same commit and license ([source](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/sources/release_cover_art.move)). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/sources/release_track_data.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/tests/release_track_data_tests.move).
