---
title: Recording Version
description: Attach a version name such as Live or Radio Edit to a recording, set and cleared by its admin.
---

This page is for developers who label a recording or build its display title. It explains how `recording_version` stores the name that distinguishes one take of a composition from another, and how it combines with the composition's title.

## Naming a Take

Dolly Parton's and Whitney Houston's masters of "I Will Always Love You" are separate [Recordings](/move/music-protocol/recording/) of one composition, and neither recording carries a title. Suppose a third recording of the composition is a live performance. Its recording admin sets the version name `Live`, and an application shows the composition's [title](/move/framework/composition-title/) with that version, for example as "I Will Always Love You (Live)". A recording with no version name is the composition's plain rendition and displays under the composition title alone. How the two strings are joined is a client convention; the contract stores only the version name.

```move
public struct RecordingVersionKey() has copy, drop, store;
```

The version name is a non-empty `String` of at most 300 bytes, stored as one dynamic field on the recording's UID under this package's key. Comparison is exact: case and whitespace are part of the value. The name is presentation; it does not link recordings to each other or describe their rights.

## Setting the Version

```move
public fun set_version<RecordingShare>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    version: String,
) {
    assert!(!version.is_empty(), EEmptyVersion);
    assert!(version.length() <= MAX_VERSION_LENGTH, EVersionTooLong);
    let recording_id = object::id(recording);
    let uid = recording.uid_mut(cap);
    if (df::exists(uid, RecordingVersionKey())) {
        let current: &mut String = df::borrow_mut(uid, RecordingVersionKey());
        if (*current == version) return;
        *current = version;
    } else {
        df::add(uid, RecordingVersionKey(), version);
    };
    emit(RecordingVersionSetEvent { recording_id, version });
}
```

- **Validation runs before the cap.** An empty or over-long name aborts first, so an invalid replacement never touches the stored value. `String::length` counts bytes, so a name in a multi-byte script fits fewer characters.
- **Only the recording's admin can write.** `uid_mut(cap)` accepts only the `RecordingAdminCap` of the recording's own share type; a cap for another recording does not type-check.
- **Only a change emits.** Setting the name already stored neither writes nor emits.

The admin can set the version in the transaction that creates the recording, before `share`, or later on the shared recording. `clear_version(recording, cap)` removes it after the cap check and is a silent no-op when nothing is attached.

## Reading the Version

`has_version(recording)` and `version(recording)` are permissionless. `version` aborts when nothing is attached, so check `has_version` first. To build a display title, read the recording's `composition_id`, load that composition, and read its title with `composition_title::title`.

## Failure Cases

| Situation | Result |
| --- | --- |
| Reading `version` with nothing attached | Aborts with `ENoVersion` (0). |
| `set_version` with an empty string | Aborts with `EEmptyVersion` (1), before the cap is checked. |
| `set_version` with more than 300 bytes | Aborts with `EVersionTooLong` (2), before the cap is checked. |
| A cap for a different recording | Does not type-check: the cap's share type must match the recording's. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingVersionSetEvent` | `recording_id`, `version` (the full new value); only when the stored name changes |
| `RecordingVersionClearedEvent` | `recording_id`; only when a name was removed |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/Published.toml) records one mainnet generation, `published-at = "0x12c62597c4b2b41fff94c8a937ceac17a98035195f79cb08e4a9226e91f188cc"`. It was recorded after the last change to the package's sources, so it is the generation this page describes. No testnet generation is recorded. The package README makes no statement about an audit. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 18 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/sources/recording_version.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/tests).
