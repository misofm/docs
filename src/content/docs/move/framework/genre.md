---
title: Genre
description: A canonical genre vocabulary of frozen on-chain objects whose IDs follow from their names, shared by the recording, release, and party genre extensions.
---

This page is for developers who tag works or Parties with genres, or who index the genre vocabulary. It explains what a `Genre` is, how its ID follows from its name, the naming rules, and which extensions point at it.

## Genres Are Objects, Not Strings

Suppose the release admin of *The Bodyguard* soundtrack wants to tag the [Release](/move/music-protocol/release/) `SOUNDTRACK`. The tag is not a string copied onto the Release. It is the ID of a frozen `Genre` object named `SOUNDTRACK`, and [`release_genre`](/move/music-protocol/extensions/release-genre/) stores that ID. Every Release, Recording, or Party tagged `SOUNDTRACK` points at the same object.

```move
public struct Genre has key {
    id: UID,
    name: String,
}

public struct GenreRegistry has key {
    id: UID,
}

public struct GenreKey(String) has copy, drop, store;
```

Each `Genre` is a derived object of the shared `GenreRegistry`, claimed with `GenreKey(name)`. Its ID is a pure function of the registry ID and the name, so any client can compute it with `derive_address(registry, name)` and read it without a lookup table. Because the name fully determines both the object and its ID, creation needs no authority: anyone can create a genre that does not exist yet.

`Genre` has only `key`. Without `store` it cannot be transferred or wrapped, and without `drop` the creating transaction must consume it. `freeze_genre` (alias `genre.freeze()`) is the only public function that takes a `Genre` by value, so every genre ends up frozen and never changes.

## Creating a Genre

The full function:

```move
public fun new(registry: &mut GenreRegistry, name: String): Genre {
    assert!(!name.is_empty(), EEmptyName);
    assert!(name.length() <= MAX_NAME_LENGTH, ENameTooLong);
    let mut previous_underscore = true;
    name.as_bytes().do_ref!(|c| {
        let underscore = *c == 0x5F;
        assert!(underscore || (*c >= 0x41 && *c <= 0x5A), EInvalidNameChar);
        assert!(!(underscore && previous_underscore), EMisplacedUnderscore);
        previous_underscore = underscore;
    });
    assert!(!previous_underscore, EMisplacedUnderscore);
    let genre = Genre { id: claim(&mut registry.id, GenreKey(name)), name };
    let genre_id = object::id(&genre);
    emit(GenreCreatedEvent { genre_id, name });
    genre
}
```

A name is 1 to 64 bytes of uppercase words `A` to `Z` joined by single underscores, such as `DRUM_AND_BASS`. Starting `previous_underscore` as `true` rejects a leading underscore, and the final check rejects a trailing one, so `_HIP_HOP` and `HIP__HOP` cannot exist. Spelling variants such as `HIPHOP` and `HIP_HOP` are still distinct genres; choosing canonical names is a curation concern.

To tag with a genre that does not exist yet, in one programmable transaction:

1. Call `genre::new(registry, name)`.
2. Call the extension's `add_genre` with the `&Genre`.
3. Call `genre.freeze()`.

If the genre already exists, derive its address and pass the frozen `Genre` to `add_genre`.

## Who Uses It

Each extension takes a `&Genre` when adding a tag, so a tag is proven against the vocabulary at write time. It stores the genre's ID as a dynamic-field key and emits the name in its added event. Removing a tag takes the genre ID only.

| Extension | Tags | Admin cap |
| --- | --- | --- |
| [`recording_genre`](/move/music-protocol/extensions/recording-genre/) | a Recording | `RecordingAdminCap` |
| [`release_genre`](/move/music-protocol/extensions/release-genre/) | a Release | `ReleaseAdminCap` |
| [`party_genre`](/move/party-protocol/extensions/party-genre/) | a Party | `PartyAdminCap` |

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty name | `new` aborts with `EEmptyName` (0). |
| A name longer than 64 bytes | `new` aborts with `ENameTooLong` (1). |
| A byte other than `A` to `Z` or `_` | `new` aborts with `EInvalidNameChar` (2). |
| A leading, trailing, or repeated underscore | `new` aborts with `EMisplacedUnderscore` (3). |
| A name that already exists | `new` aborts with `sui::derived_object::EObjectAlreadyExists`. |

## Events

| Event | Fields |
| --- | --- |
| `GenreCreatedEvent` | `genre_id`, `name` |

An indexer can build the whole vocabulary from these events. `init` shares the `GenreRegistry` at publish and emits no event; take its ID from the publish transaction's effects. Genres are frozen, so nothing else is emitted.

## Deployment

`genre` depends only on the Sui framework, not on the core protocol. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/Published.toml) records a mainnet generation at `published-at = "0xfa21fae0a05165943e5a4b466e84b34d7a8ea6d1b29c86d1185675e793a34363"`, recorded after the last change to the package's sources, so it matches this source. The recorded testnet generation, `published-at = "0xeda153873304f89c694ff97bc3fa81f07895f68c94a588fd49196f741793016f"`, was recorded before the latest source change. Before that change, `new` froze the genre itself and returned nothing, so check that generation's API before using the create, tag, and freeze sequence above. Each generation has its own `GenreRegistry`, so the same name derives a different ID in each, and a genre extension accepts only `Genre` objects of the `genre` package it links. The README does not state an audit status. The 16 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/sources/genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/tests/genre_tests.move).
