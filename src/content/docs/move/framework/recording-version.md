---
title: Recording Version
description: Attach a version name such as Live or Radio Edit to a recording.
---

`recording_version` stores the name that distinguishes one take of a composition from another, such as `Live` or `Radio Edit`. Use it to label a recording or build its display title.

## Naming a Take

Parton's and Houston's masters of "I Will Always Love You" are separate [Recordings](/move/music-protocol/recording/) of one composition, and neither carries a title. If a live recording's admin sets the version name `Live`, an app shows the composition's [title](/move/framework/composition-title/) with it: "I Will Always Love You (Live)". A recording with no version name displays under the composition title alone. Joining the strings is a client convention. The contract stores only the version name.

```move
public struct RecordingVersionKey() has copy, drop, store;
```

The version name is a non-empty `String` of at most 300 bytes, one dynamic field on the recording's UID. Comparison is exact: case and whitespace count. It is presentation only. It links no recordings and describes no rights.

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

Validation runs before the cap. `String::length` counts bytes, so a multi-byte script fits fewer characters. `uid_mut(cap)` accepts only the `RecordingAdminCap` of the recording's own share type. Setting the stored name writes and emits nothing.

Set the version in the creating transaction before `share`, or later. `clear_version(recording, cap)` removes it after the cap check and is a silent no-op when nothing is attached.

## Reading the Version

`has_version(recording)` and `version(recording)` are permissionless. `version` aborts when nothing is attached, so check `has_version` first. For a display title, read the recording's `composition_id`, load the composition, and call `composition_title::title`.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/Published.toml) records one mainnet generation, `published-at = "0x12c62597c4b2b41fff94c8a937ceac17a98035195f79cb08e4a9226e91f188cc"`. It postdates the last source change: matches this source. No testnet generation.

`Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README makes no audit statement. The 18 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/sources/recording_version.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_version/tests).
