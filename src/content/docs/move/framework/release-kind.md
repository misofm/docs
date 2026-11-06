---
title: Release Kind
description: Label a Release with a free-form kind such as Album, EP, or Mixtape.
---

This page is for developers who show what kind of product a release is, such as an album or an EP. It explains how `release_kind` stores that label on a [Release](/move/music-protocol/release/) and the rules for setting and clearing it.

## A Free-Form Label

Suppose the release admin of *The Bodyguard* soundtrack labels it `Soundtrack`. The label is whatever the release calls itself. It is not a closed vocabulary, and it is not derived from the track list: a three-track release can call itself an album.

The kind is one `String` stored as a dynamic field on the release:

```move
public struct ReleaseKindKey() has copy, drop, store;
```

The value is stored verbatim, including case and whitespace, so `EP`, `ep`, and `E.P.` are different values. Normalize them in the client if you group releases by kind, and treat the string as untrusted input when rendering it.

## Setting and Clearing the Kind

The `ReleaseAdminCap` holder sets or replaces the kind:

```move
public fun set_kind(release: &mut Release, cap: &ReleaseAdminCap, kind: String) {
    assert!(!kind.is_empty(), EEmptyKind);
    assert!(kind.length() <= MAX_KIND_LENGTH, EKindTooLong);
    let release_id = object::id(release);
    let uid = release.uid_mut(cap);
    if (df::exists(uid, ReleaseKindKey())) {
        let stored: &mut String = df::borrow_mut(uid, ReleaseKindKey());
        if (*stored == kind) return;
        *stored = kind;
    } else {
        df::add(uid, ReleaseKindKey(), kind);
    };
    emit(ReleaseKindSetEvent { release_id, kind });
}
```

The function shows three rules:

- **The value is checked before the cap.** A kind must be 1 to 32 bytes. The limit counts bytes, not characters; it fits "Album (Deluxe Edition)", and anything longer is a title, which belongs in [`release_title`](/move/framework/release-title/).
- **The cap is checked through the core.** `uid_mut(cap)` aborts on another release's cap.
- **An equal value is silent.** Setting the kind already stored neither writes nor emits.

`clear_kind(release, cap)` removes the kind and emits `ReleaseKindClearedEvent`. It is silent when no kind is set, but still checks the cap. Read the kind with `has_kind(release)` and `kind(release)`, which aborts when none is set.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty kind | `set_kind` aborts with `EEmptyKind` (1) before the cap is checked. |
| A kind longer than 32 bytes | `set_kind` aborts with `EKindTooLong` (2) before the cap is checked. |
| Another release's admin cap | `set_kind` and `clear_kind` abort with `miso_music::release::EUnauthorized` (0). |
| Reading a release with no kind | `kind` aborts with `ENoKind` (0). |

## Events

| Event | Fields |
| --- | --- |
| `ReleaseKindSetEvent` | `release_id`, `kind`; only when the stored value changes |
| `ReleaseKindClearedEvent` | `release_id`; only when a kind was removed |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/Published.toml) records a mainnet publication at `0x92da58c54321af4128a8fc28c9ab8a8d04fc5a9485e0796a869c5a590951f711`. It was recorded after the last change to this package's source and manifest, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 21 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/sources/release_kind.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/tests).
