---
title: Composition Title
description: Attach a composition's preferred title as one bounded string that only its admin can set or clear.
---

This page is for developers who name a composition or display its name. It explains how `composition_title` stores a composition's preferred title, who can set or clear it, and what the stored value does and does not mean.

## A Title Outside the Core

A core [Composition](/move/music-protocol/composition/) records the work's identity and share type but carries no title. Suppose the admin of the composition "I Will Always Love You" wants every application to show that name. The admin calls `set_title` with the composition's `CompositionAdminCap` and the string `I Will Always Love You`; any application can then read the same value from the composition.

```move
public struct CompositionTitleKey() has copy, drop, store;
```

The title is a `String` dynamic field on the composition's UID under this package's key, so a composition has at most one. It is stored exactly as supplied: whitespace, case, and multi-byte UTF-8 are not trimmed or normalized. Nothing on-chain reads it, and it has no economic or authorization meaning. A title does not identify the work; two compositions can carry the same title, so applications identify a work by its composition ID.

Recordings carry no title either. A recording's display title is its composition's title plus the recording's optional [version name](/move/framework/recording-version/), read through the recording's `composition_id`.

## Setting the Title

Only the holder of the composition's admin cap can write:

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

The function shows three rules:

- **The value is checked before the cap.** An empty title or one over 300 bytes aborts whatever cap is supplied. The bound counts bytes, so a title in a multi-byte script fits fewer characters.
- **Authorization is the core's.** `uid_mut(cap)` accepts only the `CompositionAdminCap` of the same share type, so a cap for another composition does not type-check. The package adds no policy of its own.
- **Only a change emits.** Setting the title already stored returns without writing or emitting; the first set always emits.

The admin can set a title in the transaction that creates the composition, after `composition::new` and before `share`, or later on the shared composition to correct it. `clear_title(composition, cap)` removes the title. It checks the cap first; clearing a composition with no title is an authorized no-op that emits nothing.

The title is the cap holder's claim. Setting it registers nothing off-chain and proves no rights in the work; transferring the admin cap moves the power to change it.

## Reading the Title

`has_title(composition)` and `title(composition)` are permissionless. `title` returns `&String` and aborts when no title is attached rather than returning an empty string, so check `has_title` first. An absent title means nobody has named the composition.

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

An indexer can rebuild every composition's title from these events alone. The sender and the admin cap ID are not repeated in the payload.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/Published.toml) records one mainnet generation, `published-at = "0x721d599ee97ec61c863b7b28afcf855eee423ea76d2bd0f1fc6326d3cc41664c"`. It was recorded after the last change to the package's sources, so it is the generation this page describes. No testnet generation is recorded. The package README makes no statement about an audit. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 24 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/sources/composition_title.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_title/tests).
