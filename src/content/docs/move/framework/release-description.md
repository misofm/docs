---
title: Release Description
description: Store a release's description as one verbatim, bounded string.
---

`release_description` stores a release's descriptive text, such as liner-note copy on a storefront page. The release admin writes it.

## One Paragraph per Release

The admin of *The Bodyguard* soundtrack can set and later change an album paragraph without touching the [Release](/move/music-protocol/release/)'s fixed track list. Like a [title](/move/framework/release-title/), it is presentation, so it is an extension.

The description is one `String` under the `ReleaseDescriptionKey()` dynamic field, with no wrapper struct. It is stored as supplied: whitespace, line breaks, case, and multi-byte UTF-8 are not normalized.

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

`MAX_DESCRIPTION_LENGTH` is 8,192 bytes (roughly 1,300 English words), counted in bytes, not characters; a description must also be non-empty. Both checks run before the cap check. `uid_mut` gates the write. Setting the stored description writes and emits nothing. The set event carries the full text, so an indexer never reads the field.

To describe a release from its first version, call `set_description` in the same programmable transaction as `release::new`, before `release::share`, then transfer the cap.

The description is the admin's statement. Nothing checks it. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not its description.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description/Published.toml) records:

- Mainnet: `0xeb07cbadcce336b27b157535b7ed74c1627e010065f39f1da4609c12a8664891`. Postdates the last source change and core pin: matches this source.
- Testnet: `0x99ee52a1acd70b277c2e834bcb7fa48b72788eb0dfd98f54bab125c908c376f6`. Earlier generation.

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not say whether it is audited. The 20 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description/sources/release_description.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_description/tests).
