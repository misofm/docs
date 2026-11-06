---
title: Recording Master
description: Attach canonical verified Audio objects to a recording as its masters, one dynamic field per Audio, written by the recording's admin.
---

This page is for developers who connect a recording to the audio that realizes it, or who look up a recording's verified audio for playback or matching. It explains what a master reference stores, how to verify new audio and attach it in one transaction, and which verifier types a reader should trust.

## A Recording Points at Its Audio

Suppose Whitney Houston's recording of "I Will Always Love You" has a stereo mix and an immersive mix. Each mix is measured by [`audio_verifier`](/move/framework/audio-verifier/), which creates an [`Audio<AudioVerifier>`](/move/framework/audio/): a frozen record of the audio's channels, bit depth, sample rate, length, and PCM digest. The recording's admin attaches both Audio objects as masters. Dolly Parton's recording is a separate Recording with its own masters.

An Audio records what the audio is, not who owns it. A master reference is the recording admin's claim that this audio is this recording.

```move
public struct RecordingMasterKey(ID) has copy, drop, store;
```

Each master is one dynamic field on the recording, keyed by the Audio's ID, with the value `true`. The Audio's ID already fixes its verifier type and facts, so the key needs nothing else, and the facts stay on the frozen Audio for anyone to read. A recording can hold several masters side by side: one per mix, and one per verifier when several verifiers have measured the same sound. `has_master(recording, audio_id)` checks one; to list them all, list the recording's dynamic fields with the `RecordingMasterKey` key type.

## Attaching a Master

`add_master` takes the recording's `RecordingAdminCap<RecordingShare>` and the Audio itself:

```move
public fun add_master<RecordingShare, AudioVerifier>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    audio: &Audio<AudioVerifier>,
) {
    let recording_id = object::id(recording);
    let audio_id = object::id(audio);
    let key = RecordingMasterKey(audio_id);
    let uid = recording.uid_mut(cap);
    assert!(!df::exists(uid, key), EMasterAlreadyAdded);
    df::add(uid, key, true);
    emit(RecordingMasterAddedEvent<AudioVerifier> { recording_id, audio_id });
}
```

Because it takes `&Audio`, it accepts a new Audio before it is frozen. For audio not yet registered, one programmable transaction does all three steps:

1. Call `audio_verifier::verify_audio` with the enclave's signed facts. It returns the new `Audio<AudioVerifier>` unfrozen.
2. Call `recording_master::add_master` with the recording, its cap, and the Audio.
3. Call `audio::freeze_audio` on the Audio. An Audio cannot be transferred or dropped, so the transaction fails unless it is frozen.

For audio that is already registered, pass the frozen Audio as an immutable input to `add_master` alone. `audio::derive_address` gives an Audio's address from its facts, so a client can check whether it exists before uploading. Only the recording's admin can write: each share type belongs to exactly one recording, so a cap for another recording has a different type and the transaction is rejected before the call runs.

## Trusting Masters

- **Pin the verifier types you trust.** `add_master` accepts an Audio of any verifier type, and anyone can publish a verifier. Read only masters whose `RecordingMasterAddedEvent<AudioVerifier>` or Audio type names a verifier you trust, such as `audio_verifier::audio_verifier::AudioVerifier`.
- **A master is a claim, not proof of authorship.** Nothing stops two recordings from attaching the same Audio. Resolving that is curation, not something this package checks.
- **Release authorization covers every master.** A recording authorizes a release in [`release_license`](/move/framework/release-license/), and that authorization names the recording, not a master, so it covers whatever masters the recording holds.

## Removing a Master

`remove_master<RecordingShare, AudioVerifier>(recording, cap, audio_id)` removes the field and emits `RecordingMasterRemovedEvent<AudioVerifier>`. It takes only the Audio's ID, so the caller names the verifier type for the event and the chain does not check it. Indexers should match a removal to its addition by `recording_id` and `audio_id`, not by the event's type. A removed master can be attached again later.

## Failure Cases

| Situation | Result |
| --- | --- |
| Attaching an Audio already attached | `add_master` aborts with `EMasterAlreadyAdded` (1). |
| Removing an Audio that is not attached | `remove_master` aborts with `EMasterNotFound` (0). |
| A cap for another recording | The transaction is rejected before the call runs, because the cap's share type differs. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingMasterAddedEvent<AudioVerifier>` | `recording_id`, `audio_id` |
| `RecordingMasterRemovedEvent<AudioVerifier>` | `recording_id`, `audio_id`; the verifier type is named by the caller and unchecked |

The Audio's facts are in the `AudioCreatedEvent<AudioVerifier>` that [`audio`](/move/framework/audio/) emitted when the Audio was created. Indexers join on `audio_id`; the facts never change.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master/Published.toml) records a mainnet generation at `0xa4bc24667942bc1049380b8765be422e2256f3ef9bb0cdf34c627be1b44f53f1` and no testnet generation. It was recorded after the last change to this module, to `audio`, and to the core pin, so it matches this source. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and depends on `audio` by local path, so it accepts only Audio objects of the `audio` package it was published against. The package README states that it has not been audited. The 8 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master/sources/recording_master.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_master/tests/recording_master_tests.move).
