---
title: Recording Advisory
description: Mark a recording as explicit, not explicit, or a cleaned version, as one dynamic field its admin writes.
---

This page is for developers who label a recording's content for listeners and storefronts, or who read that label to badge or filter tracks. It explains the three advisory values, why a recording with no advisory is different from one marked `NotExplicit`, and how the recording admin sets and clears it.

## Three Values, or None

Suppose the admin of Whitney Houston's recording of "I Will Always Love You" sets `NotExplicit`. A storefront that reads it can show the track without a badge. Had the admin set nothing, the storefront would know only that nobody has said, and should not treat the track as clean.

```move
public enum Advisory has copy, drop, store {
    Explicit,
    NotExplicit,
    Cleaned,
}
```

The recording holds at most one `Advisory`, under the package's `RecordingAdvisoryKey()` dynamic field. `Cleaned` marks an explicit recording re-issued with the offending content removed; it is its own value because storefronts present it differently from a recording that was never explicit. An absent field means no advisory has been asserted, which `has_advisory` reports as `false`.

Move enums cannot be constructed or matched outside their module, so callers build a value with `explicit()`, `not_explicit()`, or `cleaned()`, and test one with `is_explicit`, `is_not_explicit`, or `is_cleaned`. In a programmable transaction, call the constructor first and pass its result to `set_advisory`.

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

The function shows two rules:

- **Only the recording's admin can write.** Each share type belongs to exactly one recording, so a `RecordingAdminCap` for another recording has a different type and the transaction is rejected before the call runs. Owning the recording's shares does not authorize a write.
- **Every event is a real change.** Setting the value already held returns without writing or emitting, so an indexer can apply events in order without deduplicating.

`clear_advisory(recording, cap)` removes the field and emits `RecordingAdvisoryClearedEvent`, returning the recording to "no advisory asserted". Clearing a recording that has none does nothing.

Reads are permissionless. `advisory(recording)` returns the value and aborts when there is none, so check `has_advisory` first. Off-chain, read the dynamic field directly.

The advisory is the recording admin's own statement. Nothing on-chain checks it against the audio. There is no release-level advisory package, so a client that badges a release such as *The Bodyguard* soundtrack reads each track's recording.

## Failure Cases

| Situation | Result |
| --- | --- |
| Reading a recording with no advisory | `advisory` aborts with `ENoAdvisory` (0). |
| A cap for another recording | The transaction is rejected before the call runs, because the cap's share type differs. |
| Setting the value already held | No write and no event. |
| Clearing a recording with no advisory | No write and no event. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingAdvisorySetEvent` | `recording_id`, `advisory`, which serializes as its variant index: `Explicit` 0, `NotExplicit` 1, `Cleaned` 2 |
| `RecordingAdvisoryClearedEvent` | `recording_id` |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory/Published.toml) records a mainnet generation at `0xde4e648166711882a80588239a91dd48f712faa5d4af570e77a2478897d45f43` and a testnet generation at `0xaf50ef46545e86e6e9e532649323211c5b5c94e47b677d80285c3a92102e3238`. The mainnet entry was recorded after the module's last source change and its current core pin, so it matches this source; the testnet entry predates both and is an earlier generation. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not say whether the package has been audited. The 13 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory/sources/recording_advisory.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_advisory/tests).
