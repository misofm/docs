---
title: Release Title
description: Store a release's title as one verbatim, bounded string.
---

`release_title` stores the title a release is known by. The release admin writes it; the core Release has no title.

## Why the Title Is an Extension

A core [Release](/move/music-protocol/release/) is an ordered list of recording IDs. The admin of *The Bodyguard* soundtrack can correct or restyle the title `The Bodyguard` later without changing the track list the release ID commits to. Presentation is an extension, not core; see [Fixed Relationships, Extensible Presentation](/move/music-protocol/release/#fixed-relationships-extensible-presentation).

The title is one `String` under the `ReleaseTitleKey()` dynamic field, with no wrapper struct. It is stored verbatim: case, whitespace, and multi-byte UTF-8 are not normalized.

## Setting the Title

`set_title` takes the release's `ReleaseAdminCap`, which [`release::new`](/move/music-protocol/release/#who-can-create-a-release) returns to whoever creates the release:

```move
public fun set_title(release: &mut Release, cap: &ReleaseAdminCap, title: String) {
    assert!(!title.is_empty(), EEmptyTitle);
    assert!(title.length() <= MAX_TITLE_LENGTH, ETitleTooLong);
    let release_id = object::id(release);
    let uid = release.uid_mut(cap);
    if (df::exists(uid, ReleaseTitleKey())) {
        let stored: &mut String = df::borrow_mut(uid, ReleaseTitleKey());
        if (*stored == title) return;
        *stored = title;
    } else {
        df::add(uid, ReleaseTitleKey(), title);
    };
    emit(ReleaseTitleSetEvent { release_id, title });
}
```

A title is non-empty and at most 300 bytes. `MAX_TITLE_LENGTH` counts bytes, so a multi-byte script holds fewer than 300 characters. Both checks run before the cap check, which `uid_mut` performs. Setting the stored title writes and emits nothing.

To title a release from its first version, call `set_title` in the same programmable transaction as `release::new`, before `release::share`, then transfer the cap.

Anyone can create a release from shared recordings, so a title is the creator's presentation, not approved by the recordings' admins. A recording's [release authorization](/move/framework/release-license/) approves the release and its revenue splits, not its title.

`clear_title(release, cap)` removes the title and emits `ReleaseTitleClearedEvent`. Reads are permissionless: `has_title(release)` and `title(release)`, which aborts when there is none.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty title | `set_title` aborts with `EEmptyTitle` (1), even with a wrong cap. |
| A title over 300 bytes | `set_title` aborts with `ETitleTooLong` (2), even with a wrong cap. |
| A cap for another release | `set_title` and `clear_title` abort with `release::EUnauthorized` (0), even when there is no title to clear. |
| Reading a release with no title | `title` aborts with `ENoTitle` (0). |
| Setting the title already stored, or clearing when absent | No write and no event. |

## Events

| Event | Fields |
| --- | --- |
| `ReleaseTitleSetEvent` | `release_id`, `title` |
| `ReleaseTitleClearedEvent` | `release_id` |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title/Published.toml) records a mainnet generation at `0xc08ae67dfd03a3df841e89586e7a93b33c9421ec075b216e61b22db7735868eb` and no testnet generation. It postdates the last source change and core pin: matches this source.

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not say whether it is audited. The 20 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title/sources/release_title.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_title/tests).
