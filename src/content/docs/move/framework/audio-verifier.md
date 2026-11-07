---
title: Audio Verifier
description: Turn audio facts signed by an attested Nautilus enclave into an `Audio<AudioVerifier>`.
---

`audio_verifier` turns an enclave signature into an [`Audio`](/move/framework/audio/). Use it to register verified audio, operate the policy, or judge whether to trust `Audio<AudioVerifier>`. [`enclave`](/move/framework/enclave/) registers and rotates images.

## From a FLAC File to an Audio

The rights holder of Whitney Houston's [Recording](/move/music-protocol/recording/) of "I Will Always Love You" uploads the master as FLAC to the enclave from [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave/tree/595329a71c5b01d4515fd12c772821100c455573), running on AWS Nitro. The service signs nothing but canonical FLAC: STREAMINFO as the only metadata block, 8-, 16-, or 24-bit samples, and a sample rate of 44.1, 48, 88.2, 96, 176.4, 192, 352.8, or 384 kHz. It decodes the file, measures the five facts, and signs the facts, not the file. Then, in one programmable transaction:

1. Call `verify_audio` with the enclave's public key, facts, timestamp, and signature. It returns the `Audio<AudioVerifier>`.
2. Call [`recording_master::add_master`](/move/framework/recording-master/) with the Recording, its admin cap, and the `Audio`.
3. Call `audio.freeze()`.

Before uploading, derive the address with `audio::derive_address<AudioVerifier>`. If the `Audio` exists, skip steps 1 and 3 and pass the frozen `Audio` to `add_master`. If two uploads of the same audio race, the second `verify_audio` aborts.

## Two Witnesses

```move
public struct AUDIO_VERIFIER() has drop;

public struct AudioVerifier() has drop;

public struct AudioPayload has copy, drop {
    channels: u8,
    bit_depth: u8,
    sample_rate_hz: u32,
    samples_per_channel: u64,
    pcm_digest: vector<u8>,
}
```

- `AUDIO_VERIFIER`: one-time witness. Owns the package's `EnclavePolicy<AUDIO_VERIFIER>`, so only keys registered there can sign.
- `AudioVerifier`: witness passed to `audio::new`, naming the verifier in `Audio<AudioVerifier>`. Separate because Sui forbids packing a one-time witness outside `init`.
- `AudioPayload`: the signed payload, fields in the same order as the `Audio` key.

`init` creates the package's one policy with no PCRs set, shares it, and sends its admin cap to the publisher:

```move
fun init(otw: AUDIO_VERIFIER, ctx: &mut TxContext) {
    let (policy, cap) = enclave::new(otw, ctx);
    policy.share();
    transfer::public_transfer(cap, ctx.sender());
}
```

The policy, its `EnclavePolicyAdminCap<AUDIO_VERIFIER>`, key registration, and signature checks come from the local-path [`enclave`](/move/framework/enclave/) package. The cap is `key + store` and only changes PCRs. Move it to long-term custody such as a multisig; forward it at publish if an ephemeral signer publishes (see [Operating the Policy](#operating-the-policy)).

## Verifying the Signature

```move
public fun verify_audio(
    registry: &mut AudioRegistry,
    policy: &EnclavePolicy<AUDIO_VERIFIER>,
    pk: vector<u8>,
    channels: u8,
    bit_depth: u8,
    sample_rate_hz: u32,
    samples_per_channel: u64,
    pcm_digest: vector<u8>,
    timestamp_ms: u64,
    signature: vector<u8>,
): Audio<AudioVerifier> {
    policy.verify_signature(
        pk,
        AUDIO_INTENT,
        timestamp_ms,
        AudioPayload { channels, bit_depth, sample_rate_hz, samples_per_channel, pcm_digest },
        &signature,
    );
    let audio = audio::new(
        registry,
        AudioVerifier(),
        channels,
        bit_depth,
        sample_rate_hz,
        samples_per_channel,
        pcm_digest,
    );
    emit(AudioVerifiedEvent {
        pk,
        policy_version: policy.version(),
        verified_at_ms: timestamp_ms,
        audio_id: object::id(&audio),
    });
    audio
}
```

Anyone may call `verify_audio`; the signature is not bound to a sender. Pass the shared policy by read-only reference and the enclave's 32-byte public key `pk`. `AUDIO_INTENT` is 0. The policy's [`verify_signature`](/move/framework/enclave/#verifying-a-signature) requires `pk` registered under the current policy version, then checks the Ed25519 signature over `bcs(IntentMessage { intent: 0, timestamp_ms, payload: AudioPayload })`. Changing any fact, the timestamp, the intent, or the key invalidates it. Unit tests check this encoding against `vectors/audio_intent.json`, a signing vector from the enclave's Rust crate.

- **Policy consulted every call.** A key under an older PCR version stops verifying the moment PCRs change. No per-enclave cleanup.
- **Policy type fixed.** Only `EnclavePolicy<AUDIO_VERIFIER>` is accepted, so a key registered for another App cannot sign.
- **No freshness check.** `timestamp_ms` is the enclave's clock time, supplied by its host. It is signed and kept in `AudioVerifiedEvent`, but nothing compares it with a Sui clock. A replayed signature can only recreate existing audio, which aborts.

## The Trust Model

What Sui checks on-chain:

- **At registration**, `sui::nitro_attestation::load_nitro_attestation` verifies the attestation document against the AWS Nitro certificate chain at the current clock time. `enclave::register` checks PCR0, PCR1, and PCR2 equal the policy's current PCRs and stores the document's 32-byte public key under the current version. Registration is permissionless: anyone with a matching document can submit it. See [Registering an Enclave](/move/framework/enclave/#registering-an-enclave).
- **At verification**, `pk` must be registered under the current policy version and the Ed25519 signature must be valid for it. `audio::new` then checks the facts' shape and that they are not already registered.

What is trusted off-chain:

- **The enclave code.** Only the enclave decodes the file. You trust the image the PCRs identify to parse canonical FLAC, measure the facts, and compute the BLAKE3 PCM digest to the [`audio` specification](/move/framework/audio/#checking-a-file-against-an-audio). The image builds reproducibly (`make eif`): rebuild at a commit and compare PCRs with `EnclavePolicyPcrsSetEvent`.
- **AWS Nitro.** Attestation and private-key isolation rest on Nitro hardware and AWS's certificate chain. PCR3 and PCR4 are not checked, so an enclave running the trusted image in any AWS account can register.
- **The `EnclavePolicyAdminCap` holder** (first the publisher) chooses which image the PCRs name. `enclave` rejects an all-zero PCR (Nitro's debug mode), but nothing on-chain ties PCRs to the audio verifier's source. The holder cannot register or block individual enclaves. It can only change PCRs, which retires every key registered under the old ones.

It proves what the audio is, not who made it or holds rights to it. Anyone can upload a file and point their own object at the resulting `Audio`. Authorship and duplicate detection belong in curation.

## Operating the Policy

1. **Publish.** `init` sends the `EnclavePolicyAdminCap<AUDIO_VERIFIER>` to the publisher. With the ephemeral-signer `publish` tool, pass `--created-objects-recipient <address>` or the cap is lost.
2. **Set the PCRs.** Build the image from `misofm/audio-verifier-enclave`, record PCR0 to PCR2, and call `enclave::enclave::set_pcrs(policy, cap, pcr0, pcr1, pcr2)`. Each PCR must be 48 bytes, not all zeros, and differ from the current set. Each call increments the policy `version`.
3. **Register an enclave.** Boot it and fetch its attestation document. In one programmable transaction, call `sui::nitro_attestation::load_nitro_attestation(attestation, clock)`, then `enclave::enclave::register(policy, document)`. No cap needed.
4. **Rotate the image.** In one programmable transaction, call `set_pcrs` with the new PCRs, then `register` the new enclave. Every old key stops verifying at once. Anyone can then call `enclave::enclave::remove_stale(policy, pk)` to reclaim storage.

`Audio` measured by a retired image stays valid, because the image was trusted at the time. To reject it, track `pk` and `policy_version` from `AudioVerifiedEvent`.

## Failure Cases

| Situation | Result |
| --- | --- |
| `verify_audio` with `pk` not registered | `enclave::enclave::EEnclaveNotRegistered` (10) |
| `verify_audio` with `pk` from an older policy version (retired image) | `enclave::enclave::EStaleEnclave` (11) |
| `verify_audio` with a signature that does not match `pk`, the facts, the timestamp, or the intent | `enclave::enclave::EInvalidSignature` (13) |
| `verify_audio` with facts already registered | `sui::derived_object::EObjectAlreadyExists` |
| `verify_audio` with malformed facts | The [`audio` error](/move/framework/audio/#failure-cases) for that fact |
| `set_pcrs` with a wrong cap, a PCR not 48 bytes, an all-zero PCR, or the current PCRs | In `enclave`: `EUnauthorized` (1), `EInvalidPcrLength` (2), `EDebugPcrs` (3), or `ESamePcrs` (4) |
| `register` with a document whose PCRs differ from the policy's, including while PCRs are unset | In `enclave`: `EInvalidPcrs` (5) |
| `register` for a key already registered, current or stale | In `enclave`: `EEnclaveAlreadyRegistered` (9). Call `remove_stale` first for a stale key. |
| `remove_stale` for a key under the current version | In `enclave`: `ENotStale` (12) |

Other `enclave` aborts (document without a PCR or public key, key not 32 bytes): [Enclave](/move/framework/enclave/#failure-cases).

## Events

| Event | Fields |
| --- | --- |
| `AudioVerifiedEvent` | `pk`, `policy_version`, `verified_at_ms` (the signed `timestamp_ms`), `audio_id` |
| `audio::audio::AudioCreatedEvent<AudioVerifier>` | `audio_id`, `channels`, `bit_depth`, `sample_rate_hz`, `samples_per_channel`, `pcm_digest` |

`enclave` emits `EnclavePolicyCreatedEvent<AUDIO_VERIFIER>` at publish, then `EnclavePolicyPcrsSetEvent`, `EnclaveRegisteredEvent`, and `EnclaveStaleRemovedEvent` as you operate the policy. Fields: [Enclave](/move/framework/enclave/#events).

## Deployment

No core protocol dependency. `audio` and `enclave` are local-path dependencies. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/Published.toml) records one generation:

- **Mainnet** `published-at = "0xc547a01e2fcd7b126e94d6fa67172ea074e452a0534e31d52dbd0e7907bde35f"`, from publish transaction `BcJ47ZqywXkh22dPU1Yp5Ni4SQNpz49oTnR2DMckXezH`. Recorded after the last code change to this package and to `enclave`. One later commit to `audio_verifier.move` only added a `// === Init Function ===` marker, so the bytecode matches this source. It links mainnet [`audio`](/move/framework/audio/#deployment) at `0x5dafcccd44bc253b50bf35b23086e0495264956662fd96fb87b8068eef8eeaeb` and [`enclave`](/move/framework/enclave/#deployment) at `0xc8906ad5bebb9c50e786a3246791cdd2e95c304596574a68647c2d48de69afe8`.

No testnet generation is recorded. The publish transaction created the shared `EnclavePolicy<AUDIO_VERIFIER>` at `0x938a08de3eb7bf1188af949d22b8e897f523056324820fd861aff795080211cc` (pass it to `verify_audio`) and sent its admin cap to the publisher. On 2026-11-06 the cap had moved to `0x2ee0659d5ae261319c4e9b8103cebab8506f3ee5f9fc51c919d04ff786c322b8`, and the policy was still at version 0 with PCRs unset, so no enclave could register and `verify_audio` could not succeed. Read the policy's `version` and PCRs before relying on it.

The README states the package is not audited. The 13 unit tests pass locally with Sui 1.82.2. They register a fixed key with `register_for_testing`, verify the signing vector from `misofm/audio-verifier-enclave` at `595329a7`, and reject unsigned facts, another timestamp, a bad signature, another intent, another key, an unregistered key, a retired-image key, and duplicate audio. Real-enclave attestation and registration still need an end-to-end test on a Nitro host and a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/LICENSE.md). The `enclave` package it depends on is licensed separately under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). The docs' Apache license does not relicense either.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/sources/audio_verifier.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/tests/audio_verifier_tests.move); [`enclave`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/sources/enclave.move); enclave service [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave/tree/595329a71c5b01d4515fd12c772821100c455573) at commit `595329a71c5b01d4515fd12c772821100c455573`.
