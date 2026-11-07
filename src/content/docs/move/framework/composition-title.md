---
title: Composition Title
description: Store a composition's preferred title as one bounded string, set only by its admin.
---

`composition_title` stores a composition's preferred title so every application shows the same name. Only the composition admin can set or clear it.

## A Title Outside the Core

A core [Composition](/move/music-protocol/composition/) has no title. The admin of "I Will Always Love You" calls `set_title` with the `CompositionAdminCap` and the string `I Will Always Love You`. Any application can then read it.

```move
public struct CompositionTitleKey() has copy, drop, store;
```

The title is a `String` dynamic field on the composition's UID: at most one. It is stored as supplied; whitespace, case, and multi-byte UTF-8 are not trimmed or normalized. It has no economic or authorization meaning. Two compositions can share a title, so identify a work by its composition ID.

Recordings have no title. Display a recording as its composition's title (via `composition_id`) plus its optional [version name](/move/framework/recording-version/).

## Setting the Title

Only the admin cap holder can write:

```move
public fun set_title<CompositionShare>(
    composition: &mut Composition<CompositionShare>,
    cap: &CompositionAdminCap<CompositionShare>,
    title: String,
) {
    let bytes = title.as_bytes();
    assert!(!bytes.is_empty(), EEmptyTitle);
    assert!(bytes.length() <= MAX_TITLE_LENGTH, ETitleTooLong);
    let composition_id = object::id(composition);
    let uid = composition.uid_mut(cap);
    if (df::exists(uid, CompositionTitleKey())) {
        let stored: &mut String = df::borrow_mut(uid, CompositionTitleKey());
        if (*stored == title) return;
        *stored = title;
    } else {
        df::add(uid, CompositionTitleKey(), title);
    };
    emit(CompositionTitleSetEvent { composition_id, title });
}
```

- **The value is checked before the cap.** An empty title or one over 300 bytes aborts with any cap. The bound counts bytes, so multi-byte scripts fit fewer characters.
- **Authorization is the core's.** `uid_mut(cap)` accepts only the `CompositionAdminCap` of the same share type. The package adds no policy.
- **Only a change emits.** Setting the stored title writes and emits nothing. The first set always emits.

Set a title in the creating transaction, after `composition::new` and before `share`, or later to correct it. `clear_title(composition, cap)` checks the cap first. Clearing when no title exists is an authorized no-op that emits nothing.

The title is the cap holder's claim. It proves no rights in the work. Transferring the admin cap transfers the power to change it.

## Reading the Title

`has_title(composition)` and `title(composition)` are permissionless. `title` returns `&String` and aborts when none is attached, so check `has_title` first.

## Failure Cases

| Situation | Result |
| --- | --- |
| Reading `title` with no title attached | Aborts with `ENoTitle` (0). |
| `set_title` with an empty string | Aborts with `EEmptyTitle` (1), before the cap is checked. |
| `set_title` with more than 300 bytes | Aborts with `ETitleTooLong` (2), before the cap is checked. |
| A cap for a different composition | Does not type-check: the cap's share type must match the composition's. |

## Events

| Event | Fields |
| --- | --- |
| `CompositionTitleSetEvent` | `composition_id`, `title` (the full new value); only when the stored title changes |
| `CompositionTitleClearedEvent` | `composition_id`; only when a title was removed |

These events rebuild every title. The payload omits the sender and admin cap ID.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/Published.toml) records one mainnet generation, `published-at = "0x721d599ee97ec61c863b7b28afcf855eee423ea76d2bd0f1fc6326d3cc41664c"`, postdating the last source change, so this page describes it. No testnet generation. The README makes no audit statement. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 24 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/sources/composition_title.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/tests).
