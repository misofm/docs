---
title: Audio
description: One canonical, frozen record of the measured facts of a lossless audio, created only by a verifier type and found by deriving its address from those facts.
---

This page is for developers who point recordings at verified audio, or who check a file against it. It explains what an `Audio<AudioVerifier>` records, how its address follows from the facts, why it is frozen, and which verifier types to trust. How the production verifier signs the facts is on the [Audio Verifier](/move/framework/audio-verifier/) page.

## One Record per Measured Audio

Suppose the rights holder of Whitney Houston's [Recording](/move/music-protocol/recording/) of "I Will Always Love You" has a lossless master. A verifier decodes it and measures five facts: channels, bit depth, sample rate, samples per channel, and a digest of the decoded samples. `audio::new` records those facts as an `Audio`, and the [`recording_master`](/move/music-protocol/extensions/recording-master/) extension points the Recording at it. Dolly Parton's Recording of the song is different audio, so its master is a different `Audio`.

```move
public struct Audio<phantom AudioVerifier> has key {
    id: UID,
    channels: u8,
    bit_depth: u8,
    sample_rate_hz: u32,
    samples_per_channel: u64,
    pcm_digest: vector<u8>,
}
```

The type parameter names who measured the audio. Only code holding an `AudioVerifier` witness can call `new`, so there is no self-attested audio. `Audio` records what the audio is, not who made it or who holds rights to it: anyone with a file can have it measured, and recordings point at an `Audio` rather than own it. Files are not on-chain.

`Audio` has only `key`, and the module exposes no `UID`. Nothing can attach dynamic fields to it, transfer it, wrap it, or drop it. Data about a sound belongs on the Recording that uses it, or in a separate object keyed by the `Audio`'s ID.

## The Key and the Address

Each `Audio` is a derived object of the shared `AudioRegistry`, claimed with this key:

```move
public struct AudioKey<phantom AudioVerifier>(u8, u8, u32, u64, vector<u8>) has copy, drop, store;
```

The fields are the five facts in the order `channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest`. An `Audio`'s ID is therefore a function of the registry ID, the verifier type, and the facts. A client holding the facts calls `derive_address<AudioVerifier>(registry, channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest)` and reads that address over RPC to learn whether the audio is already registered.

- **One `Audio` per verifier and facts.** Registering the same facts with the same verifier again aborts.
- **The verifier is part of the key.** Two verifiers that measure the same audio create two separate `Audio` objects.
- **The digest alone is not the identity.** The digest covers samples, not how they are played, so the same digest with a different sample rate or channel count is different audio.

## Creating and Freezing

`new<AudioVerifier: drop>(registry, witness, channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest)` checks the shape of the facts and claims the `Audio` from the registry (excerpt; the rest emits `AudioCreatedEvent` and returns the `Audio`):

```move
assert!(channels > 0, EZeroChannels);
assert!(bit_depth > 0 && bit_depth <= MAX_BIT_DEPTH, EInvalidBitDepth);
assert!(sample_rate_hz > 0, EZeroSampleRate);
assert!(samples_per_channel > 0, EZeroSamplesPerChannel);
assert!(samples_per_channel.checked_mul(1_000).is_some(), EInvalidDuration);
assert!(pcm_digest.length() == PCM_DIGEST_LENGTH, EInvalidDigestLength);
let key = AudioKey<AudioVerifier>(
    channels,
    bit_depth,
    sample_rate_hz,
    samples_per_channel,
    pcm_digest,
);
let id = derived_object::claim(&mut registry.id, key);
```

The excerpt shows that `new` only checks that the facts are well formed: bit depth from 1 to 32, a 32-byte digest, and a sample count whose duration in milliseconds fits in a `u64`. It never sees a file. Reading the audio and computing the digest is the verifier's job, which is why the verifier type matters.

`new` returns the `Audio` unfrozen, so the same programmable transaction can point records at it. With the production verifier, the order is:

1. `audio_verifier::verify_audio(...)` returns the `Audio`.
2. Call extensions that reference it, such as `recording_master::add_master(recording, cap, &audio)`.
3. Call `audio.freeze()` (`freeze_audio`). Because `Audio` has no `drop` and no other public consumer, the transaction cannot succeed without freezing it.

Frozen objects are read without consensus. Views: `channels`, `bit_depth`, `sample_rate_hz`, `samples_per_channel`, `pcm_digest`, and `duration_ms`, which rounds down and never aborts.

## Checking a File Against an Audio

Any number of files decode to the same samples, so no file is canonical. To check a file, decode it and compare the BLAKE3 digest of its PCM with `pcm_digest`. The package README specifies the digest: unkeyed BLAKE3 with the default 32-byte output, over the decoded integer PCM interleaved by sample frame, each sample a signed little-endian two's-complement integer of `ceil(bit_depth / 8)` bytes, sign-extended within those bytes. On-chain, `new` checks only the digest's length; following the specification is the verifier's responsibility.

`Audio` means integer linear PCM. Floating-point PCM and DSD are not `Audio`.

## Trusting a Verifier

**Pin the verifier types you trust.** Accept `Audio<audio_verifier::audio_verifier::AudioVerifier>` or another specific type, never a generic `Audio<AudioVerifier>` treated as trusted: anyone can publish a package with a witness and call `new` with any facts. `recording_master` accepts an `Audio` of any verifier type and records the type in its events, so a client that displays masters should filter by the verifier type it trusts.

**Never send assets to an `Audio`'s address.** A frozen `Audio` exposes no `UID`, so anything sent there can never be received.

## Failure Cases

| Situation | Result |
| --- | --- |
| `channels` of 0 | `new` aborts with `EZeroChannels` (0). |
| `bit_depth` of 0 or above 32 | `new` aborts with `EInvalidBitDepth` (1). |
| `sample_rate_hz` of 0 | `new` aborts with `EZeroSampleRate` (2). |
| `samples_per_channel` of 0 | `new` aborts with `EZeroSamplesPerChannel` (3). |
| `samples_per_channel` above `u64::MAX / 1000` | `new` aborts with `EInvalidDuration` (4). |
| A `pcm_digest` other than 32 bytes | `new` aborts with `EInvalidDigestLength` (5). |
| Facts already registered for this verifier type | `new` aborts with `sui::derived_object::EObjectAlreadyExists`. |

## Events

| Event | Fields |
| --- | --- |
| `AudioCreatedEvent<AudioVerifier>` | `audio_id`, `channels`, `bit_depth`, `sample_rate_hz`, `samples_per_channel`, `pcm_digest` |

`init` shares the `AudioRegistry` at publish and emits no event; take its ID from the publish transaction's effects.

## Deployment

`audio` depends only on the Sui framework, not on the core protocol. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/Published.toml) records a mainnet generation at `published-at = "0x5dafcccd44bc253b50bf35b23086e0495264956662fd96fb87b8068eef8eeaeb"`, recorded after the last change to the package's code, so it matches the source on this page; the one later commit to `audio.move` only added a `// === Init Function ===` section marker and left the bytecode unchanged. It records no testnet generation. The mainnet [`audio_verifier`](/move/framework/audio-verifier/#deployment) links this generation and writes to its `AudioRegistry`. The README does not state an audit status. The 23 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/sources/audio.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/tests/audio_tests.move).
