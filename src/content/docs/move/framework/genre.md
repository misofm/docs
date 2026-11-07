---
title: Genre
description: A shared genre vocabulary of frozen objects whose IDs derive from their names.
---

`genre` is the shared vocabulary behind the recording, release, and party genre tags. Each `Genre` is a frozen object whose ID derives from its name.

## Genres Are Objects, Not Strings

Tagging *The Bodyguard* [Release](/move/music-protocol/release/) `SOUNDTRACK` copies no string. [`release_genre`](/move/framework/release-genre/) stores the ID of the frozen `Genre` named `SOUNDTRACK`. Every Release, Recording, or Party tagged `SOUNDTRACK` points at that object.

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

Each `Genre` is a derived object of the shared `GenreRegistry`, claimed with `GenreKey(name)`. Its ID is a pure function of registry ID and name: compute it with `derive_address(registry, name)`. Anyone can create a genre that does not exist yet.

`Genre` has only `key`. Without `store` it cannot be transferred or wrapped; without `drop` the creating transaction must consume it. `freeze_genre` (alias `genre.freeze()`) is the only public function taking a `Genre` by value, so every genre ends up frozen.

## Creating a Genre

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

A name is 1 to 64 bytes of uppercase words `A` to `Z` joined by single underscores, such as `DRUM_AND_BASS`. `_HIP_HOP` and `HIP__HOP` are rejected. `HIPHOP` and `HIP_HOP` are distinct genres; canonical naming is a curation concern.

To tag with a new genre, in one programmable transaction:

1. Call `genre::new(registry, name)`.
2. Call the extension's `add_genre` with the `&Genre`.
3. Call `genre.freeze()`.

If it exists, derive its address and pass the frozen `Genre` to `add_genre`.

## Who Uses It

Each extension takes a `&Genre` to add a tag, proving it against the vocabulary at write time. It stores the genre ID as a dynamic-field key and emits the name in its added event. Removal takes only the genre ID.

| Extension | Tags | Admin cap |
| --- | --- | --- |
| [`recording_genre`](/move/framework/recording-genre/) | a Recording | `RecordingAdminCap` |
| [`release_genre`](/move/framework/release-genre/) | a Release | `ReleaseAdminCap` |
| [`party_genre`](/move/framework/party-genre/) | a Party | `PartyAdminCap` |

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

These events rebuild the vocabulary. `init` shares the `GenreRegistry` at publish and emits no event; take its ID from the publish transaction's effects.

## Deployment

Depends only on the Sui framework, not the core protocol. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/Published.toml) records a mainnet generation at `published-at = "0xfa21fae0a05165943e5a4b466e84b34d7a8ea6d1b29c86d1185675e793a34363"`, postdating the last source change, so it matches this source. The testnet generation, `published-at = "0xeda153873304f89c694ff97bc3fa81f07895f68c94a588fd49196f741793016f"`, predates it: `new` froze the genre itself and returned nothing, so check that API before using the create, tag, and freeze sequence above. Each generation has its own `GenreRegistry`, so one name derives a different ID in each. A genre extension accepts only `Genre` objects of the `genre` package it links. The README states no audit status. The 16 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/sources/genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/genre/tests/genre_tests.move).
