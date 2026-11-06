---
title: Enclave
description: Trust one AWS Nitro enclave image per App, let anyone register its keys from attestation documents, and verify enclave-signed intent messages on-chain.
---

This page is for developers who build a Move package that trusts output signed by an AWS Nitro enclave, operate that package's enclave policy, or register enclaves under it. It explains how `enclave` states which enclave image an App trusts, how anyone registers a running enclave's key from its attestation document, how a signature is checked, how a PCR change retires every old key at once, and what the library deliberately does not check.

`enclave` is a library. It is the on-chain half of [nautilus-rust](https://github.com/unconfirmedlabs/nautilus-rust) and works with any [Nautilus](https://github.com/MystenLabs/nautilus) enclave through Sui's native `NitroAttestationDocument`. Unlike the rest of `misofm/framework`, it is licensed under Apache-2.0.

## One Policy per App

The framework's [Audio Verifier](/move/framework/audio-verifier/) is the running example. Its enclave decodes a FLAC file, measures the audio, and signs the facts. Sui cannot rerun that work, so `audio_verifier` must decide which enclave keys it believes. It does that with one `EnclavePolicy<AUDIO_VERIFIER>`, created in its `init`:

```move
public struct EnclavePolicy<phantom App: drop> has key {
    id: UID,
    pcrs: Pcrs,
    version: u64,
}

public struct EnclavePolicyAdminCap<phantom App: drop> has key, store {
    id: UID,
}

public struct Pcrs(vector<u8>, vector<u8>, vector<u8>) has copy, drop, store;
```

The policy is the single statement of which image the App trusts: PCR0, PCR1, and PCR2 of the image, and a `version` that counts PCR changes. Its type parameter is the App, so each App's keys are separate. The policy has only `key`, so it cannot be wrapped or transferred; `share` is the only way to keep it. The admin cap is `key + store`, so it can move to any custody, such as a multisig.

```move
public fun new<App: drop>(
    otw: App,
    ctx: &mut TxContext,
): (EnclavePolicy<App>, EnclavePolicyAdminCap<App>) {
    assert!(is_one_time_witness(&otw), ENotOneTimeWitness);
    create(ctx)
}
```

`new` requires the App's one-time witness, so it runs once, in the App's `init`, and each App has exactly one policy. The private `create` builds the policy with empty PCRs at version 0, claims the cap as a derived object of the policy, and emits `EnclavePolicyCreatedEvent`. `init` then shares the policy and sends the cap to an address. The [Audio Verifier](/move/framework/audio-verifier/#two-witnesses) sends it to the publisher; the README's example sends it to a fixed admin address instead, and warns that a cap sent to an ephemeral publishing signer is lost, leaving a policy whose PCRs can never be set.

A consuming function must name its own policy type, as `verify_audio` takes `EnclavePolicy<AUDIO_VERIFIER>`. A generic `EnclavePolicy<T>` parameter would accept a key registered for any other App.

## Setting the PCRs

PCRs are known only after the enclave image is built, which happens after the package is published. The policy therefore starts unset, and nothing can register until the cap holder calls `set_pcrs`:

```move
public fun set_pcrs<App: drop>(
    self: &mut EnclavePolicy<App>,
    cap: &EnclavePolicyAdminCap<App>,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
) {
    self.authorize(cap);
    assert_valid_pcr(&pcr0);
    assert_valid_pcr(&pcr1);
    assert_valid_pcr(&pcr2);
    let pcrs = Pcrs(pcr0, pcr1, pcr2);
    assert!(pcrs != self.pcrs, ESamePcrs);
    self.version = self.version + 1;
    self.pcrs = pcrs;
    emit(EnclavePolicyPcrsSetEvent<App> {
        policy_id: object::id(self),
        version: self.version,
        pcr0,
        pcr1,
        pcr2,
    });
}
```

`set_pcrs` checks the cap first, then each PCR with this private helper:

```move
fun assert_valid_pcr(pcr: &vector<u8>) {
    assert!(pcr.length() == PCR_LENGTH, EInvalidPcrLength);
    assert!(pcr.any!(|byte| *byte != 0), EDebugPcrs);
}
```

Each PCR must be 48 bytes (`PCR_LENGTH`, a SHA-384 digest) and not all zeros. A Nitro enclave in debug mode reports all-zero PCRs and its memory is readable from the host, so a policy can never admit one. Setting the current PCRs again aborts, so `version` moves only on a real change. Anyone who can reproduce the image build can compare its PCRs with those in `EnclavePolicyPcrsSetEvent`, but nothing on-chain ties the PCRs to a particular source tree; that choice is the cap holder's.

### The Admin Cap Is Derived from the Policy

The cap stores no policy ID. `create` claims its UID from the policy with the key `EnclavePolicyAdminCapKey()`, and `set_pcrs` checks the cap by deriving that address again:

```move
public fun derive_admin_cap_address<App: drop>(self: &EnclavePolicy<App>): address {
    derived_object::derive_address(object::id(self), EnclavePolicyAdminCapKey())
}
```

```move
fun authorize<App: drop>(self: &EnclavePolicy<App>, cap: &EnclavePolicyAdminCap<App>) {
    assert!(object::id(cap).to_address() == self.derive_admin_cap_address(), EUnauthorized);
}
```

Each policy has exactly one cap, and because `new` requires the one-time witness, each App has one policy. The derived check still rejects a cap from another policy, such as one created with `new_for_testing` in unit tests. Clients can compute the cap's ID offline with `derive_admin_cap_address` or the SDK's `derivePolicyAdminCapId`.

## Registering an Enclave

Registration is permissionless. Anyone holding a valid attestation document whose PCRs match the policy's current PCRs can register the enclave's key:

```move
public fun register<App: drop>(self: &mut EnclavePolicy<App>, document: NitroAttestationDocument) {
    let pk = self.load_pk(&document);
    let version = self.version;
    self.add(pk, version);
    emit(EnclaveRegisteredEvent<App> { policy_id: object::id(self), pk, version });
}
```

The document comes from `sui::nitro_attestation::load_nitro_attestation(attestation, clock)`, which verifies the AWS Nitro certificate chain at the clock's time. That function is `entry`, so it is called from the programmable transaction itself, and its result is passed straight to `register`; an App needs no registration wrapper. `load_pk` then checks the PCRs and the key:

```move
fun load_pk<App: drop>(self: &EnclavePolicy<App>, document: &NitroAttestationDocument): vector<u8> {
    let entries = document.pcrs();
    let pcrs = Pcrs(pcr_at(entries, 0), pcr_at(entries, 1), pcr_at(entries, 2));
    assert!(pcrs == self.pcrs, EInvalidPcrs);
    checked_public_key(*document.public_key())
}
```

PCRs are matched by index, not by position in the document. While the policy is unset, its empty PCRs never equal a real document's, so `register` aborts with `EInvalidPcrs`. The key must be present and 32 bytes, an Ed25519 public key. `add` stores it as a dynamic field on the policy, `EnclaveKey(pk) -> version`, and aborts if the key is already registered. PCR3 and PCR4 are not checked, so an enclave running the trusted image in any AWS account can register.

Routine boots and re-registrations need no cap, so the cap can stay cold.

## Verifying a Signature

```move
public fun verify_signature<App: drop, Payload: drop>(
    self: &EnclavePolicy<App>,
    pk: vector<u8>,
    intent: u8,
    timestamp_ms: u64,
    payload: Payload,
    signature: &vector<u8>,
) {
    assert!(self.registered_version(pk) == self.version, EStaleEnclave);
    let message = bcs::to_bytes(&create_intent_message(intent, timestamp_ms, payload));
    assert!(ed25519_verify(signature, &pk, &message), EInvalidSignature);
}
```

The caller supplies the signer's `pk` and reads the policy by shared, read-only reference. `registered_version` aborts with `EEnclaveNotRegistered` for an unknown key; a key registered under any other version aborts with `EStaleEnclave`. The signed message is the BCS encoding of an `IntentMessage`:

```move
public struct IntentMessage<Payload: drop> has copy, drop {
    intent: u8,
    timestamp_ms: u64,
    payload: Payload,
}
```

That is one `intent` byte, `timestamp_ms` as a little-endian `u64`, and the payload's BCS bytes. nautilus-rust's `NautilusContext::sign_intent` signs this layout. The test `intent_message_layout_matches_nautilus_rust` pins the shared vector `0020b1d110960100000d53616e204672616e636973636f0d00000000000000` (intent 0, timestamp 1744038900000, payload `{ location: "San Francisco", temperature: 13 }`). `create_intent_message` is public, so callers can build the same message.

- **Domain separation is the `intent` byte.** Give each kind of message its own intent value. `audio_verifier` signs its audio facts under intent 0.
- **The intent namespace belongs to the image, not the App.** If one image is registered under two policies, its signatures verify under both. Use distinct intents or distinct images per App if that matters.
- **No replay protection.** A valid signature verifies any number of times. Callers dedupe, for example by timestamp or by a nonce in the payload; `audio_verifier` relies on its `Audio` being created once per set of facts.
- **No freshness check.** `verify_signature` takes no `Clock`. `timestamp_ms` comes from the enclave's clock, which the host provides, so treat it as the time the enclave claims, not as attested time.

## Rotation, Stale Keys, and Rollback

A PCR change is the kill switch. Each `set_pcrs` increments `version`, and every key registered under an older version stops verifying at once. Rotating to a new image is one programmable transaction: `set_pcrs` with the new PCRs, then `register` with the new enclave's attestation document.

There is no per-key revoke. Registration is permissionless, so a removed key could simply register again; an enclave key can leak only if the image is broken, and that calls for new PCRs anyway. Stale keys can be deleted by anyone to reclaim storage:

```move
public fun remove_stale<App: drop>(self: &mut EnclavePolicy<App>, pk: vector<u8>) {
    let version = self.remove(pk);
    assert!(version < self.version, ENotStale);
    emit(EnclaveStaleRemovedEvent<App> { policy_id: object::id(self), pk, version });
}
```

`remove` aborts with `EEnclaveNotRegistered` for an unknown key, and a key registered under the current version aborts with `ENotStale`.

A rollback from image A to B and back to A needs no reboot. After setting A's PCRs again, call `remove_stale` for the still-running enclave's key, then `register` it with that enclave's attestation document; it is stored under the new version. The test `rollback_re_registers_the_same_attestation_without_reboot` checks this sequence.

## Deployment Order

1. Publish the App's package. Its `init` calls `new`, shares the policy, and sends the cap.
2. Build the enclave image and record its PCRs.
3. Call `set_pcrs` with the cap.
4. Boot the enclave and `register` it. Anyone may submit the transaction.

To use the library, depend on it from the framework repository:

```toml
enclave = { git = "https://github.com/misofm/framework.git", subdir = "enclave", rev = "ffbc8f0b2852932f879f00130117c5b597ea7db7" }
```

For unit tests, `new_for_testing<App>(ctx)` creates a policy and cap without a one-time witness, and `register_for_testing(policy, pk, version)` stores a key directly with the same duplicate and 32-byte checks as `register`, so downstream packages need no real attestation document. Both are `#[test_only]`.

## Views

| Function | Returns |
| --- | --- |
| `version(policy)` | The current policy version, 0 until the first `set_pcrs`. |
| `pcr0(policy)`, `pcr1(policy)`, `pcr2(policy)` | The trusted PCRs, empty until the first `set_pcrs`. |
| `is_registered(policy, pk)` | Whether `pk` has a registration, current or stale. |
| `registered_version(policy, pk)` | The version `pk` was registered under. Aborts with `EEnclaveNotRegistered`. |
| `derive_admin_cap_address(policy)` | The address of the policy's `EnclavePolicyAdminCap`. |

A key is usable when `registered_version(policy, pk)` equals `version(policy)`.

## TypeScript SDK

The package's [`sdk/`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/sdk) directory holds `@misofm/enclave`, a small Apache-2.0 TypeScript module for reading registrations without a Move call:

| Export | What it does |
| --- | --- |
| `derivePolicyAdminCapId(policyId, packageId)` | The `EnclavePolicyAdminCap` ID, the same value as `derive_admin_cap_address`. |
| `enclaveKeyFieldId(policyId, publicKey, packageId)` | The object ID of the `EnclaveKey(publicKey) -> u64` dynamic field on the policy. |
| `getRegisteredVersion(client, { policyId, publicKey, packageId })` | The registered version as a `bigint`, or `null` if the field cannot be read. Transport failures reject. |
| `isKeyUsable(client, { policyId, publicKey, packageId, policyVersion })` | Whether the key is registered under `policyVersion`; `false` when the version is `null`. |
| `EnclaveClient`, `EnclaveKeyRef` | Types. `EnclaveClient` is any Sui client exposing the core `getObjects` API (gRPC, GraphQL, or JSON-RPC). |

`packageId` is always the published `enclave` package that defines the key types, not the App's package. The Sui clients report a missing object like any other per-object error, so `null` means "not readable", not proof that the key is absent; `isKeyUsable` fails closed. The SDK test pins the policy and admin cap IDs that the Move test `admin_cap_address_matches_the_pinned_vector` asserts, so the two derivations cannot drift.

`package.json` declares `@mysten/sui` `^2.6.0`, `typescript` `^5` as a peer dependency, and `@types/bun` `latest`; the committed `bun.lock` resolves them to 2.6.0, 5.9.3, and 1.3.10. With Bun 1.4.4, `bun install --frozen-lockfile`, `bun run test` (17 tests), and `bun run typecheck` pass locally.

## Failure Cases

| Code | Constant | Situation |
| --- | --- | --- |
| 0 | `ENotOneTimeWitness` | `new` with a type that is not the App's one-time witness. |
| 1 | `EUnauthorized` | `set_pcrs` with another policy's cap. |
| 2 | `EInvalidPcrLength` | `set_pcrs` with a PCR that is not 48 bytes. |
| 3 | `EDebugPcrs` | `set_pcrs` with an all-zero PCR. |
| 4 | `ESamePcrs` | `set_pcrs` with the current PCRs. |
| 5 | `EInvalidPcrs` | `register` with a document whose PCR0, PCR1, or PCR2 differs from the policy's, always while the policy is unset. |
| 6 | `EMissingPcr` | `register` with a document lacking PCR0, PCR1, or PCR2. |
| 7 | `EMissingPublicKey` | `register` with a document that has no public key. |
| 8 | `EInvalidPublicKeyLength` | `register` or `register_for_testing` with a key that is not 32 bytes. |
| 9 | `EEnclaveAlreadyRegistered` | `register` or `register_for_testing` with a key that is already registered, current or stale. |
| 10 | `EEnclaveNotRegistered` | `verify_signature`, `registered_version`, or `remove_stale` with an unregistered key. |
| 11 | `EStaleEnclave` | `verify_signature` with a key registered under another version. |
| 12 | `ENotStale` | `remove_stale` with a key registered under the current version. |
| 13 | `EInvalidSignature` | `verify_signature` with a signature that does not match `pk` and the intent message. |

An attestation document that fails the AWS certificate chain check never reaches `register`; `load_nitro_attestation` rejects it in the Sui framework.

## Events

| Event | Fields | Emitted by |
| --- | --- | --- |
| `EnclavePolicyCreatedEvent<App>` | `policy_id` | `new` |
| `EnclavePolicyPcrsSetEvent<App>` | `policy_id`, `version` (the new version), `pcr0`, `pcr1`, `pcr2` | `set_pcrs` |
| `EnclaveRegisteredEvent<App>` | `policy_id`, `pk`, `version` | `register` |
| `EnclaveStaleRemovedEvent<App>` | `policy_id`, `pk`, `version` (the key's registered version) | `remove_stale` |

An indexer can rebuild a policy's PCRs, version, and key set from these events. `verify_signature` emits nothing; consuming packages emit their own events, such as `audio_verifier`'s `AudioVerifiedEvent`.

## Deployment

`enclave` depends only on the Sui framework. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/Published.toml) records one generation:

- **Mainnet** `published-at = "0xc8906ad5bebb9c50e786a3246791cdd2e95c304596574a68647c2d48de69afe8"`, from publish transaction `2BFqHWf7cn4Y8rXKw4hCbxLpf4Qh5GvbPboiTkXKMqqY`, recorded after the last change to the package's sources, so it corresponds to the source on this page. The mainnet `audio_verifier` links this generation.

It records no testnet generation. The package has no `init`, so its publish created no policy; each App creates its own. The package README's Deployments section still says "Not yet published"; `Published.toml` is the newer record. The README does not state an audit status. The 37 unit tests pass locally with Sui 1.82.2; they use a real Nitro attestation document from Mysten's weather example. The corpus has no document without a public key or a PCR, so `EMissingPublicKey`, `EInvalidPublicKeyLength`, and `EMissingPcr` are tested through test-only wrappers of the private helpers that raise them. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/LICENSE.md). This package is Apache-2.0, unlike the rest of `misofm/framework`, which is FSL-1.1-ALv2.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/sources/enclave.move), [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/tests/enclave_tests.move), and [SDK](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/enclave/sdk/index.ts).
