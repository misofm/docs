---
title: Recording Advisory
description: Mark a recording explicit or not explicit, in one dynamic field its admin writes.
---

Label a recording's content for listeners and storefronts, or read the label to badge and filter tracks. No advisory is not the same as `NotExplicit`.

## Two Values, or None

If the admin of Whitney Houston's recording of "I Will Always Love You" sets `NotExplicit`, a storefront shows no badge. If the admin sets nothing, no one has said anything. Do not treat the track as clean.

```move
public enum Advisory has copy, drop, store {
    Explicit,
    NotExplicit,
}
```

A recording holds at most one `Advisory`, under the `RecordingAdvisoryKey()` dynamic field. An absent field means no advisory is asserted: `has_advisory` returns `false`. A clean edit of an explicit recording is its own Recording, marked `NotExplicit`.

Move enums cannot be constructed or matched outside their module. Build with `explicit()` or `not_explicit()`. Test with `is_explicit` or `is_not_explicit`. In a programmable transaction, call the constructor first and pass its result to `set_advisory`.

## Setting and Clearing

`set_advisory` takes the recording's `RecordingAdminCap<RecordingShare>` and writes through the core's [`uid_mut`](/move/music-protocol/recording/):

```move
public fun set_advisory<RecordingShare>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    advisory: Advisory,
) {
    let recording_id = object::id(recording);
    let uid = recording.uid_mut(cap);
    if (df::exists(uid, RecordingAdvisoryKey())) {
        let current: &mut Advisory = df::borrow_mut(uid, RecordingAdvisoryKey());
        if (*current == advisory) return;
        *current = advisory;
    } else {
        df::add(uid, RecordingAdvisoryKey(), advisory);
    };
    emit(RecordingAdvisorySetEvent { recording_id, advisory });
}
```

Only the recording's `RecordingAdminCap` can write; owning shares does not authorize a write. Setting the held value writes and emits nothing. `clear_advisory(recording, cap)` removes the field and emits `RecordingAdvisoryClearedEvent`.

Reads are permissionless. `advisory(recording)` aborts when there is none, so check `has_advisory` first, or read the dynamic field off-chain.

The advisory is the admin's statement, unchecked against the audio. There is no release-level advisory: to badge a release, read each track's recording.

## Failure Cases

| Situation | Result |
| --- | --- |
| Reading a recording with no advisory | `advisory` aborts with `ENoAdvisory` (0). |
| A cap for another recording | Rejected before the call runs: the cap's share type differs. |
| Setting the value already held | No write and no event. |
| Clearing a recording with no advisory | No write and no event. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingAdvisorySetEvent` | `recording_id`, `advisory`, which serializes as its variant index: `Explicit` 0, `NotExplicit` 1 |
| `RecordingAdvisoryClearedEvent` | `recording_id` |

## Deployment

At commit `6999ebc675624c8786700b772c8cad8054337569`, [`Published.toml`](https://github.com/misofm/framework/blob/6999ebc675624c8786700b772c8cad8054337569/recording_advisory/Published.toml) records:

- Mainnet: `0xfb8360a1df3f8725cd15043e7b9692eb4a053c583106b5cc94c7b604a2a67675`, published immutably in transaction `F29KvA5q3gZh1DPARWcbwnQdWd8NwdZCcQ8L5RvEHdye`. Matches this source.
- Testnet: `0xaf50ef46545e86e6e9e532649323211c5b5c94e47b677d80285c3a92102e3238`. Earlier generation.

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not say whether it is audited. The 13 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/6999ebc675624c8786700b772c8cad8054337569/recording_advisory) at commit `6999ebc675624c8786700b772c8cad8054337569`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/6999ebc675624c8786700b772c8cad8054337569/recording_advisory/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/6999ebc675624c8786700b772c8cad8054337569/recording_advisory/README.md), [module](https://github.com/misofm/framework/blob/6999ebc675624c8786700b772c8cad8054337569/recording_advisory/sources/recording_advisory.move), and [tests](https://github.com/misofm/framework/tree/6999ebc675624c8786700b772c8cad8054337569/recording_advisory/tests).
