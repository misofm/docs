---
title: Release Genre
description: Tag a Release with genres from the shared genre vocabulary.
---

This page is for developers who classify releases by genre or read those classifications. It explains how `release_genre` stores genre tags on a [Release](/move/music-protocol/release/), what adding a tag proves, and how to list a release's genres.

## A Product-Level Genre

Suppose the release admin of *The Bodyguard* soundtrack tags the release `SOUNDTRACK`. The tag describes the release as a product. Each recording on it can carry its own, different genres through [`recording_genre`](/move/framework/recording-genre/): a compilation can be filed as one genre even when its tracks are not.

Genres come from the [`genre`](/move/framework/genre/) vocabulary. Each genre is a frozen `Genre` object whose name is uppercase words joined by single underscores, such as `DRUM_AND_BASS`, and whose ID is derived from that name. The release stores one dynamic field per genre ID, with the value `true`:

```move
public struct ReleaseGenreKey(ID) has copy, drop, store;
```

There is no list object and no order or primary genre. A release's genres are the dynamic fields of the release whose name type is `ReleaseGenreKey`; list them over RPC and resolve each ID to its `Genre` for the display name. `has_genre(release, genre_id)` checks one genre.

## Adding and Removing Genres

The `ReleaseAdminCap` holder adds a genre by passing the frozen `Genre` object itself:

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

Taking `&Genre` means every stored ID resolves to a real vocabulary entry. It does not mean the genre is curated: anyone can add a validated name to the vocabulary with `genre::new`, and spelling variants such as `HIPHOP` and `HIP_HOP` are distinct genres. Clients can compute a name's ID offline with `genre::derive_address(registry, name)` and check whether it exists before building the transaction.

`remove_genre(release, cap, genre_id)` removes a tag by ID and does not need the `Genre` object.

The IDs are the vocabulary's own, so release genres join directly with [`recording_genre`](/move/framework/recording-genre/) and [`party_genre`](/move/framework/party-genre/) tags. Genre is a presentation claim by the release admin, not something the protocol verifies.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/Published.toml) records a mainnet publication at `0x18c7df810308b167ddafc25a1e9b63c7fabfb354c4799a15dee402b4eaf2f648`. It was recorded after the last change to this package's source and manifest and to its local dependency `genre`, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c). The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/sources/release_genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_genre/tests/release_genre_tests.move).
