---
title: Release Track Data
description: Store one value per release track, aligned to the track list at construction.
---

`release_track_data` is a library for release extensions that store one value per track, such as per-track cover art. `ReleaseTrackData<Data>` is aligned to a release's track list at construction. The extension stores it in its own dynamic field.

## One Value per Track

Example: *The Bodyguard* [Release](/move/music-protocol/release/) gives "I Will Always Love You" its own artwork. [`release_cover_art`](/move/framework/release-cover-art/) stores this as `ReleaseTrackData<Option<CoverArt>>`: one slot per track, `none` except at that track.

```move
public struct ReleaseTrackData<Data: store + drop>(vector<Data>) has drop, store;
```

Index `i` is the `i`-th track. No recording or release ID is stored. `Data` needs `store` and `drop` too.

Alignment is checked once, at construction. A release has 1 to 255 tracks and its list never changes, so a value stays aligned for the release's life. Indices and lengths are `u8`.

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

- **`new(release, entries)`**: one value per track, in track-list order. Aborts unless the counts match.
- **`filled(release, value)`**: the same value for every track; needs `Data: copy`. `filled(release, option::none())` starts optional overrides.

Both read only the track count: the check is on length, not identity, and the value does not record its release. The extension must build it from the release it attaches it to, as `release_cover_art` does on first attach (excerpt):

```move
let track_covers = release_track_data::filled(release, option::none<CoverArt>());
let uid = release.uid_mut(cap);
df::add(uid, ReleaseCoverArtKey(), ReleaseCoverArt { cover: option::none(), track_covers });
```


## Reading and Updating

| Function | Returns | Aborts |
| --- | --- | --- |
| `length(data)` | The number of tracks covered, as a `u8` | Never |
| `borrow(data, i)` | `&Data` for track `i` | `EIndexOutOfBounds` (0) if `i` is not below the length |
| `borrow_mut(data, i)` | `&mut Data` for track `i` | `EIndexOutOfBounds` (0) if `i` is not below the length |

`borrow_mut` checks no capability. Access control belongs to the extension: only its module reaches the value under its package-private key, and its writes go through the release's `uid_mut(cap)`, so only the release admin can write. The library emits no events. The extension reports changes, such as `release_cover_art`'s `ReleaseTrackCoverArtSetEvent` with its `track_index`.

## Who Uses It

Only `release_cover_art` depends on it. [`release_license`](/move/framework/release-license/) and [`royalty_pool`](/move/framework/royalty-pool/) read `release.recording_ids()` directly. For one typed call per track in a programmable transaction, use [`release_track_iterator`](/move/framework/release-track-iterator/).

## Failure Cases

| Situation | Result |
| --- | --- |
| `new` with more or fewer entries than the release has tracks | Aborts with `ELengthMismatch` (1). |
| `borrow` or `borrow_mut` at an index at or past the length | Aborts with `EIndexOutOfBounds` (0). |

## Events

None. The extension that stores the value emits its own events.

## Deployment

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/Published.toml) records one mainnet generation, `published-at = "0x651df92c6817dc9669fb96225937469406bfcd2ea60d8995b5ea331a6a385830"`. It postdates the last source and core-pin change, so it matches this source. No testnet generation. The README states no audit status. The 14 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/LICENSE.md). The `release_cover_art` excerpt is from the same commit and license ([source](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_cover_art/sources/release_cover_art.move)). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/sources/release_track_data.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_track_data/tests/release_track_data_tests.move).
