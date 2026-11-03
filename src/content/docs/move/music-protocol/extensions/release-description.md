---
title: Release Description
description: Store the paragraph a release says about itself as one verbatim, bounded string written by the release admin.
---

This page is for developers who write or display the descriptive text for a release, such as liner-note copy on a storefront page. It explains how `release_description` stores that text, its size bound, and who may set or clear it.

## One Paragraph per Release

Suppose the release admin of *The Bodyguard* soundtrack sets a short paragraph introducing the album. Like a [title](/move/music-protocol/extensions/release-title/), the description is presentation, so it lives in an extension and can change without touching the [Release](/move/music-protocol/release/)'s fixed track list.

The description is a single `String` stored under the package's `ReleaseDescriptionKey()` dynamic field on the release, with no wrapper struct. It is stored exactly as supplied: whitespace, line breaks, case, and multi-byte UTF-8 are not normalized.

## Setting the Description

`set_description` takes the release's `ReleaseAdminCap`, which `release::new` returns to whoever creates the release:

```move
public fun set_description(release: &mut Release, cap: &ReleaseAdminCap, description: String) {
    assert!(!description.is_empty(), EEmptyDescription);
    assert!(description.length() <= MAX_DESCRIPTION_LENGTH, EDescriptionTooLong);
    let release_id = object::id(release);
    let uid = release.uid_mut(cap);
    if (df::exists(uid, ReleaseDescriptionKey())) {
        let stored: &mut String = df::borrow_mut(uid, ReleaseDescriptionKey());
        if (*stored == description) return;
        *stored = description;
    } else {
        df::add(uid, ReleaseDescriptionKey(), description);
    };
    emit(ReleaseDescriptionSetEvent { release_id, description });
}
```

The function shows three rules:

- **A description is non-empty and at most 8,192 bytes.** `MAX_DESCRIPTION_LENGTH` counts bytes, not characters, roughly 1,300 words of English. The bound keeps storage tidy; this field is not meant for long-form writing. Both checks run before the cap check.
- **Only the release's admin can write.** The core's `uid_mut` compares the cap's release ID with the release and aborts with `release::EUnauthorized` otherwise.
- **Every event is a real change.** Setting the description already stored returns without writing or emitting. The set event carries the full text, so an indexer never needs to read the field.

To describe a release from its first version, call `set_description` in the same programmable transaction as `release::new`, before `release::share`, then transfer the cap.

The description is the release admin's own statement. Nothing on-chain checks it, and a recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not its description.

`clear_description(release, cap)` removes the text and emits `ReleaseDescriptionClearedEvent`. Reads are permissionless: `has_description(release)` and `description(release)`, which aborts when there is none.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty description | `set_description` aborts with `EEmptyDescription` (1), even with a wrong cap. |
| A description over 8,192 bytes | `set_description` aborts with `EDescriptionTooLong` (2), even with a wrong cap. |
| A cap for another release | `set_description` and `clear_description` abort with `release::EUnauthorized` (0), even when there is nothing to clear. |
| Reading a release with no description | `description` aborts with `ENoDescription` (0). |
| Setting the description already stored, or clearing when absent | No write and no event. |

## Events

| Event | Fields |
| --- | --- |
| `ReleaseDescriptionSetEvent` | `release_id`, `description` (the full text) |
| `ReleaseDescriptionClearedEvent` | `release_id` |

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description/Published.toml) records a mainnet generation at `0xeb07cbadcce336b27b157535b7ed74c1627e010065f39f1da4609c12a8664891` and a testnet generation at `0x99ee52a1acd70b277c2e834bcb7fa48b72788eb0dfd98f54bab125c908c376f6`. The mainnet entry was recorded after the module's last source change and its current core pin, so it matches this source; the testnet entry predates both and is an earlier generation. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not say whether the package has been audited. The 20 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description/sources/release_description.move), and [tests](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_description/tests).
