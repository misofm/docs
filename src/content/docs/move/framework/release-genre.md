---
title: Release Genre
description: Tag a Release with genres from the shared genre vocabulary.
---

`release_genre` tags a [Release](/move/music-protocol/release/) with genres from the shared vocabulary. Use it to classify releases or read their classifications.

## A Product-Level Genre

Tagging *The Bodyguard* soundtrack `SOUNDTRACK` describes the release as a product. Its recordings can carry different genres through [`recording_genre`](/move/framework/recording-genre/).

Genres come from the [`genre`](/move/framework/genre/) vocabulary: frozen `Genre` objects named in uppercase words joined by single underscores, such as `DRUM_AND_BASS`, with an ID derived from the name. The release stores one dynamic field per genre ID, with value `true`:

```move
public struct ReleaseGenreKey(ID) has copy, drop, store;
```

There is no list object, order, or primary genre. To list genres, read the release's dynamic fields of name type `ReleaseGenreKey` over RPC, then resolve each ID to its `Genre` for the display name. `has_genre(release, genre_id)` checks one.

## Adding and Removing Genres

The `ReleaseAdminCap` holder adds a genre by passing the frozen `Genre` object:

```move
public fun add_genre(release: &mut Release, cap: &ReleaseAdminCap, genre: &Genre) {
    let release_id = object::id(release);
    let genre_id = object::id(genre);
    let uid = release.uid_mut(cap);
    assert!(!df::exists(uid, ReleaseGenreKey(genre_id)), EGenreAlreadyAdded);
    df::add(uid, ReleaseGenreKey(genre_id), true);
    emit(ReleaseGenreAddedEvent { release_id, genre_id, genre_name: *genre.name() });
}
```

`&Genre` guarantees every stored ID is a real vocabulary entry, not that it is curated: anyone can add a validated name with `genre::new`, and variants such as `HIPHOP` and `HIP_HOP` are distinct genres. Compute a name's ID offline with `genre::derive_address(registry, name)` and check it exists before building the transaction.

`remove_genre(release, cap, genre_id)` removes a tag by ID and needs no `Genre` object.

IDs are the vocabulary's own, so release genres join with [`recording_genre`](/move/framework/recording-genre/) and [`party_genre`](/move/framework/party-genre/) tags. A genre is the admin's claim. The protocol does not verify it.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another release's admin cap | `add_genre` and `remove_genre` abort with `miso_music::release::EUnauthorized` (0) before any other check. |
| A genre the release already has | `add_genre` aborts with `EGenreAlreadyAdded` (0). |
| A genre the release does not have | `remove_genre` aborts with `EGenreNotFound` (1). |

## Events

| Event | Fields |
| --- | --- |
| `ReleaseGenreAddedEvent` | `release_id`, `genre_id`, `genre_name` |
| `ReleaseGenreRemovedEvent` | `release_id`, `genre_id` |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/Published.toml) records:

- Mainnet: `0x18c7df810308b167ddafc25a1e9b63c7fabfb354c4799a15dee402b4eaf2f648`. Postdates the last change to this package's source, manifest, and local dependency `genre`: matches this source.
- Testnet: recorded before the repin to the mainnet core. Predates this source.

Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The README does not mention an audit. The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/sources/release_genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/tests/release_genre_tests.move).
