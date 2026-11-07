---
title: Release Kind
description: Label a Release with a free-form kind such as Album, EP, or Mixtape.
---

`release_kind` labels a [Release](/move/music-protocol/release/) as an album, EP, or other kind of product.

## A Free-Form Label

The admin of *The Bodyguard* soundtrack can label it `Soundtrack`. The vocabulary is open and not derived from the track list: a three-track release can call itself an album.

The kind is one `String` dynamic field on the release:

```move
public struct ReleaseKindKey() has copy, drop, store;
```

The value is stored verbatim, including case and whitespace: `EP`, `ep`, and `E.P.` differ. Normalize in the client if you group by kind. Treat the string as untrusted input when rendering.

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

A kind is 1 to 32 bytes (bytes, not characters), checked before the cap. It fits "Album (Deluxe Edition)". Anything longer is a title: use [`release_title`](/move/framework/release-title/). `uid_mut(cap)` gates the write. Setting the stored kind writes and emits nothing.

`clear_kind(release, cap)` removes the kind and emits `ReleaseKindClearedEvent`. It is silent when no kind is set but still checks the cap. Read with `has_kind(release)` and `kind(release)`, which aborts when none is set.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/Published.toml) records:

- Mainnet: `0x92da58c54321af4128a8fc28c9ab8a8d04fc5a9485e0796a869c5a590951f711`. Postdates the last change to this package's source and manifest: matches this source.
- Testnet: recorded before the repin to the mainnet core. Predates this source.

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not mention an audit. The 21 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/sources/release_kind.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_kind/tests).
