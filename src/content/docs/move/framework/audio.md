---
title: Audio
description: A frozen record of lossless audio's measured facts, created only by a verifier type.
---

`Audio<AudioVerifier>` is a frozen record of lossless audio's measured facts, at an address derived from them. Point recordings at it or check a file against it. For how the production verifier signs facts, see [Audio Verifier](/move/framework/audio-verifier/).

## One Record per Measured Audio

A verifier decodes the lossless master of Whitney Houston's [Recording](/move/music-protocol/recording/) of "I Will Always Love You" and measures five facts: channels, bit depth, sample rate, samples per channel, and a digest of the decoded samples. `audio::new` records them as an `Audio`, and [`recording_master`](/move/framework/recording-master/) points the Recording at it. Dolly Parton's different audio gets a different `Audio`.

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

The type parameter names who measured the audio. Only code holding an `AudioVerifier` witness can call `new`, so no audio is self-attested. `Audio` records what the audio is, not who made it or holds its rights. Anyone can have a file measured. Files are not on-chain.

`Audio` has only `key` and no exposed `UID`: nothing can attach fields to it, transfer, wrap, or drop it. Put data about a sound on the Recording that uses it, or in a separate object keyed by the `Audio`'s ID.

## The Key and the Address

Each `Audio` is a derived object of the shared `AudioRegistry`, claimed with this key:

```move
public struct AudioKey<phantom AudioVerifier>(u8, u8, u32, u64, vector<u8>) has copy, drop, store;
```

The fields are the five facts in the order `channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest`, so the ID is a function of registry ID, verifier type, and facts. To check whether audio is registered, call `derive_address<AudioVerifier>(registry, channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest)` and read that address over RPC.

- **One `Audio` per verifier and facts.** Re-registering the same facts with the same verifier aborts.
- **The verifier is in the key.** Two verifiers measuring the same audio create two `Audio` objects.
- **The digest alone is not the identity.** It covers samples, not playback: the same digest with a different sample rate or channel count is different audio.

## Creating and Freezing

`new<AudioVerifier: drop>(registry, witness, channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest)` checks the facts' shape and claims the `Audio` (excerpt; the rest emits `AudioCreatedEvent` and returns the `Audio`):

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

`new` checks only well-formedness: bit depth 1 to 32, a 32-byte digest, and a sample count whose duration in milliseconds fits in a `u64`. It never sees a file. Reading the audio and computing the digest is the verifier's job, so the verifier type matters.

`new` returns the `Audio` unfrozen so the same programmable transaction can point records at it. With the production verifier:

1. `audio_verifier::verify_audio(...)` returns the `Audio`.
2. Call extensions that reference it, such as `recording_master::add_master(recording, cap, &audio)`.
3. Call `audio.freeze()` (`freeze_audio`). `Audio` has no `drop` and no other public consumer, so the transaction fails without it.

Frozen objects are read without consensus. Views: `channels`, `bit_depth`, `sample_rate_hz`, `samples_per_channel`, `pcm_digest`, and `duration_ms`, which rounds down and never aborts.

## Checking a File Against an Audio

Many files decode to the same samples, so no file is canonical. Decode the file and compare the BLAKE3 digest of its PCM with `pcm_digest`. Per the README, the digest is unkeyed BLAKE3, default 32-byte output, over decoded integer PCM interleaved by sample frame. Each sample is a signed little-endian two's-complement integer of `ceil(bit_depth / 8)` bytes, sign-extended within those bytes. `new` checks only the digest's length. The verifier must follow the specification.

`Audio` means integer linear PCM. Floating-point PCM and DSD are not `Audio`.

## Trusting a Verifier

**Pin the verifier types you trust.** Accept `Audio<audio_verifier::audio_verifier::AudioVerifier>` or another specific type. Never trust a generic `Audio<AudioVerifier>`: anyone can publish a witness and call `new` with any facts. `recording_master` accepts any verifier type and records it in events, so clients displaying masters should filter by trusted verifier type.

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

`init` shares the `AudioRegistry` at publish and emits no event. Take its ID from the publish transaction's effects.

## Deployment

`audio` depends only on the Sui framework, not the core protocol. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/Published.toml) records a mainnet generation at `published-at = "0x5dafcccd44bc253b50bf35b23086e0495264956662fd96fb87b8068eef8eeaeb"`, recorded after the last code change, so it matches this source. The one later commit to `audio.move` only added a `// === Init Function ===` marker; bytecode is unchanged. No testnet generation. The mainnet [`audio_verifier`](/move/framework/audio-verifier/#deployment) links this generation and writes to its `AudioRegistry`. No audit status in the README. The 23 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/sources/audio.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio/tests/audio_tests.move).
