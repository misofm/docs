---
title: Audio Verifier
description: Create an Audio<AudioVerifier> from audio facts signed by an attested Nautilus enclave, and understand what that proves.
---

This page is for developers who register verified audio, operate the enclave policy, or decide whether to trust `Audio<AudioVerifier>`. It explains how `audio_verifier` turns an enclave signature into an [`Audio`](/move/framework/audio/), what Sui checks on-chain, what is trusted to the enclave and to the policy's admin, and how enclave images are registered and rotated through [`enclave`](/move/framework/enclave/).

## From a FLAC File to an Audio

Suppose the rights holder of Whitney Houston's [Recording](/move/music-protocol/recording/) of "I Will Always Love You" wants its master on-chain. They upload the master as a FLAC file to the audio verifier enclave from [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave/tree/595329a71c5b01d4515fd12c772821100c455573), running on AWS Nitro. The service accepts canonical FLAC only (STREAMINFO as the only metadata block, 8-, 16-, or 24-bit samples, and a sample rate of 44.1, 48, 88.2, 96, 176.4, 192, 352.8, or 384 kHz) and rejects anything else without a signature. The enclave decodes the file, measures the five facts, and returns them with a signature. It signs nothing about the file itself. In one programmable transaction, they then:

1. Call `verify_audio` with the enclave's public key, the facts, the timestamp, and the signature. It returns the `Audio<AudioVerifier>`.
2. Call [`recording_master::add_master`](/move/music-protocol/extensions/recording-master/) with the Recording, its admin cap, and the `Audio`.
3. Call `audio.freeze()`.

Before uploading, derive the `Audio`'s address with `audio::derive_address<AudioVerifier>` and read it; if it exists, skip steps 1 and 3 and pass the frozen `Audio` to `add_master`. If two uploads of the same audio race, the second `verify_audio` aborts.

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

`AUDIO_VERIFIER` is the package's one-time witness. It owns the package's enclave policy, an `EnclavePolicy<AUDIO_VERIFIER>`, so the only keys that can sign are those registered on that policy. `AudioVerifier` is the witness passed to `audio::new` and names the verifier in `Audio<AudioVerifier>`. It is a separate type because Sui does not allow packing a one-time witness outside `init`. `AudioPayload` is the signed payload, with fields in the same order as the `Audio` key.

At publish, `init` creates the package's one policy, with no PCRs set, shares it, and sends its admin cap to the publisher:

```move
fun init(otw: AUDIO_VERIFIER, ctx: &mut TxContext) {
    let (policy, cap) = enclave::new(otw, ctx);
    policy.share();
    transfer::public_transfer(cap, ctx.sender());
}
```

The policy, its `EnclavePolicyAdminCap<AUDIO_VERIFIER>`, key registration, and signature checks come from the framework's [`enclave`](/move/framework/enclave/) package, a local-path dependency in the same repository. The cap is `key + store`, so its holder can move it to long-term custody, such as a multisig. It is needed only to change the PCRs. If the package is published by an ephemeral signer, the cap must be forwarded at publish; the README's operating steps below say how.

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

Anyone may call `verify_audio`; the signature is not bound to a sender. The caller passes the shared policy by read-only reference and the signing enclave's 32-byte public key `pk`. `AUDIO_INTENT` is 0. The policy's [`verify_signature`](/move/framework/enclave/#verifying-a-signature) first requires `pk` to be registered under the policy's current version, then checks the Ed25519 signature over `bcs(IntentMessage { intent: 0, timestamp_ms, payload: AudioPayload })`. Changing any fact, the timestamp, the intent, or the key invalidates the signature. The unit tests check this encoding against a signing vector, `vectors/audio_intent.json`, generated by the enclave's Rust crate.

- **The policy is consulted on every call.** A key registered under an older PCR version stops verifying the moment the PCRs change; no per-enclave cleanup is needed.
- **The policy type is fixed.** `verify_audio` takes `EnclavePolicy<AUDIO_VERIFIER>` only, so a key registered for another App cannot sign.
- **No freshness check.** `timestamp_ms` is the enclave's clock time, supplied by its host. It is signed and kept in `AudioVerifiedEvent`, but nothing compares it with a Sui clock. Replaying a signature can only recreate audio that already exists, which aborts.

## The Trust Model

What Sui checks on-chain:

- **At registration**, `sui::nitro_attestation::load_nitro_attestation` verifies the enclave's attestation document against the AWS Nitro certificate chain at the current clock time. `enclave::register` then checks that PCR0, PCR1, and PCR2 in the document equal the policy's current PCRs and stores the document's 32-byte public key on the policy under the current version. Registration is permissionless: anyone holding a matching attestation document can submit it. [Registering an Enclave](/move/framework/enclave/#registering-an-enclave) shows the check.
- **At verification**, `pk` must be registered under the current policy version, and the Ed25519 signature over the facts must be valid for it. `audio::new` then checks the facts' shape and that they are not already registered.

What is trusted off-chain:

- **The enclave code.** Only the enclave decodes the file. Users trust that the image the PCRs identify parses canonical FLAC correctly, measures the facts, and computes the BLAKE3 PCM digest to the [`audio` specification](/move/framework/audio/#checking-a-file-against-an-audio). The enclave repository builds its image reproducibly (`make eif`), so anyone can rebuild it at a given commit and compare the PCRs with those in `EnclavePolicyPcrsSetEvent`.
- **AWS Nitro.** The attestation and the isolation of the enclave's private key rest on Nitro hardware and AWS's certificate chain. PCR3 and PCR4 are not checked, so an enclave running the trusted image in any AWS account can register.
- **The `EnclavePolicyAdminCap` holder.** Whoever holds the cap, first the publisher, chooses which image the PCRs name. `enclave` rejects a PCR of all zeros, which Nitro reports in debug mode, but nothing on-chain ties the PCRs to the audio verifier's source. The holder cannot register or block individual enclaves; it can only change the PCRs, which retires every key registered under the old ones.

What it proves: what the audio is, not who made it or who holds rights to it. Anyone can upload a file and point their own object at the resulting `Audio`. Authorship and duplicate detection belong in curation.

## Operating the Policy

1. **Publish.** `init` sends the `EnclavePolicyAdminCap<AUDIO_VERIFIER>` to the publisher. With the ephemeral-signer `publish` tool, the README says to pass `--created-objects-recipient <address>` so the cap is forwarded instead of lost.
2. **Set the PCRs.** Build the image from `misofm/audio-verifier-enclave`, record its PCR0 to PCR2, and call `enclave::enclave::set_pcrs(policy, cap, pcr0, pcr1, pcr2)`. Each PCR must be 48 bytes and not all zeros, and must differ from the current set. Each call increments the policy `version`.
3. **Register an enclave.** Boot the enclave and fetch its attestation document. In one programmable transaction, call `sui::nitro_attestation::load_nitro_attestation(attestation, clock)` and pass the document to `enclave::enclave::register(policy, document)`. No cap is needed, and anyone may submit it.
4. **Rotate the image.** In one programmable transaction, call `set_pcrs` with the new image's PCRs, then `register` the new enclave. Every old key stops verifying at once. Anyone can then delete old keys with `enclave::enclave::remove_stale(policy, pk)` to reclaim storage.

`Audio` measured by a retired image stays valid: it was measured by an image that was trusted at the time. A consumer that wants to reject it has to track it by `pk` and `policy_version` from `AudioVerifiedEvent`.

## Failure Cases

| Situation | Result |
| --- | --- |
| `pk` not registered on the policy | `verify_audio` aborts with `enclave::enclave::EEnclaveNotRegistered` (10). |
| `pk` registered under an older policy version, from a retired image | `verify_audio` aborts with `enclave::enclave::EStaleEnclave` (11). |
| A signature that does not match `pk`, the facts, the timestamp, or the intent | `verify_audio` aborts with `enclave::enclave::EInvalidSignature` (13). |
| Facts already registered | `verify_audio` aborts with `sui::derived_object::EObjectAlreadyExists`. |
| Malformed facts | `verify_audio` aborts with the [`audio` error](/move/framework/audio/#failure-cases) for that fact. |
| A `set_pcrs` call with a wrong cap, a PCR that is not 48 bytes, an all-zero PCR, or the current PCRs | Aborts in `enclave` with `EUnauthorized` (1), `EInvalidPcrLength` (2), `EDebugPcrs` (3), or `ESamePcrs` (4). |
| A `register` call whose document's PCRs differ from the policy's, including while the PCRs are unset | Aborts in `enclave` with `EInvalidPcrs` (5). |
| A `register` call for a key that is already registered, current or stale | Aborts in `enclave` with `EEnclaveAlreadyRegistered` (9); call `remove_stale` first for a stale key. |
| A `remove_stale` call for a key registered under the current version | Aborts in `enclave` with `ENotStale` (12). |

The remaining `enclave` aborts, for documents without a PCR or public key and for keys that are not 32 bytes, are listed on the [Enclave](/move/framework/enclave/#failure-cases) page.

## Events

| Event | Fields |
| --- | --- |
| `AudioVerifiedEvent` | `pk`, `policy_version`, `verified_at_ms` (the signed `timestamp_ms`), `audio_id` |
| `audio::audio::AudioCreatedEvent<AudioVerifier>` | `audio_id`, `channels`, `bit_depth`, `sample_rate_hz`, `samples_per_channel`, `pcm_digest` |

`enclave` emits `EnclavePolicyCreatedEvent<AUDIO_VERIFIER>` at publish, and `EnclavePolicyPcrsSetEvent`, `EnclaveRegisteredEvent`, and `EnclaveStaleRemovedEvent` as the policy is operated; their fields are on the [Enclave](/move/framework/enclave/#events) page.

## Deployment

`audio_verifier` does not depend on the core protocol; its dependencies are `audio` and `enclave`, both by local path. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/Published.toml) records one generation:

- **Mainnet** `published-at = "0xc547a01e2fcd7b126e94d6fa67172ea074e452a0534e31d52dbd0e7907bde35f"`, from publish transaction `BcJ47ZqywXkh22dPU1Yp5Ni4SQNpz49oTnR2DMckXezH`. It was recorded after the last change to the package's code and to `enclave`'s; the one later commit to `audio_verifier.move` only added a `// === Init Function ===` section marker and left the bytecode unchanged. It corresponds to the source on this page. On-chain, it links mainnet [`audio`](/move/framework/audio/#deployment) at `0x5dafcccd44bc253b50bf35b23086e0495264956662fd96fb87b8068eef8eeaeb` and [`enclave`](/move/framework/enclave/#deployment) at `0xc8906ad5bebb9c50e786a3246791cdd2e95c304596574a68647c2d48de69afe8`.

It records no testnet generation. The publish transaction created the shared `EnclavePolicy<AUDIO_VERIFIER>` at `0x938a08de3eb7bf1188af949d22b8e897f523056324820fd861aff795080211cc`, the policy to pass to `verify_audio`, and sent its admin cap to the publishing address. When this page was checked against mainnet on 2026-11-06, the cap had since been transferred to `0x2ee0659d5ae261319c4e9b8103cebab8506f3ee5f9fc51c919d04ff786c322b8`, and the policy was still at version 0 with its PCRs unset, so no enclave could register and `verify_audio` could not succeed. Read the policy's `version` and PCRs before relying on it.

The README states that the package has not been audited. The 13 unit tests pass locally with Sui 1.82.2. They register a fixed test key with `register_for_testing` and verify the signing vector from `misofm/audio-verifier-enclave` at `595329a7`; they reject facts the enclave did not sign, another timestamp, a bad signature, another intent, another key, an unregistered key, a key from a retired image, and already registered audio. Attestation and registration of a real audio verifier enclave need an end-to-end test on a Nitro host and a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/LICENSE.md). The `enclave` package it depends on is licensed separately under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). The docs' Apache license does not relicense either.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/sources/audio_verifier.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/audio_verifier/tests/audio_verifier_tests.move); [`enclave`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/sources/enclave.move); enclave service [`misofm/audio-verifier-enclave`](https://github.com/misofm/audio-verifier-enclave/tree/595329a71c5b01d4515fd12c772821100c455573) at commit `595329a71c5b01d4515fd12c772821100c455573`.
