---
title: Party Genre
description: Tag a Party with genres from the shared genre vocabulary.
---

This page is for developers who show or set the genres an artist or other [Party](/move/party-protocol/) works in. It explains how `party_genre` stores genre tags on a Party, what adding a tag proves, and how to list a Party's genres.

## Genre Tags on a Party

Suppose Dolly Parton's Party is tagged `COUNTRY`. The tag is a display claim by the Party's administrator about the Party as a whole, separate from the genres of any one release or recording.

Genres come from the [`genre`](/move/framework/genre/) vocabulary. Each genre is a frozen `Genre` object whose name is uppercase words joined by single underscores, such as `DRUM_AND_BASS`, and whose ID is derived from that name. The Party stores one dynamic field per genre ID, with the value `true`:

```move
public struct PartyGenreKey(ID) has copy, drop, store;
```

There is no list object and no ranking: any "primary genre" is a client convention. A Party's genres are the dynamic fields of the Party whose name type is `PartyGenreKey`; list them over RPC and resolve each ID to its `Genre` for the display name. `has_genre(party, genre_id)` checks one genre.

## Adding and Removing Genres

The `PartyAdminCap` holder adds a genre by passing the frozen `Genre` object itself:

```move
public fun add_genre(party: &mut Party, cap: &PartyAdminCap, genre: &Genre) {
    let party_id = object::id(party);
    let genre_id = object::id(genre);
    let uid = party.uid_mut(cap);
    assert!(!df::exists(uid, PartyGenreKey(genre_id)), EGenreAlreadyAdded);
    df::add(uid, PartyGenreKey(genre_id), true);
    emit(PartyGenreAddedEvent { party_id, genre_id, genre_name: *genre.name() });
}
```

Taking `&Genre` means every stored ID resolves to a real vocabulary entry. It does not mean the genre is curated: anyone can add a validated name to the vocabulary with `genre::new`, and spelling variants such as `HIPHOP` and `HIP_HOP` are distinct genres. Clients can compute a name's ID offline with `genre::derive_address(registry, name)`.

`remove_genre(party, cap, genre_id)` removes a tag by ID and does not need the `Genre` object.

The IDs are the vocabulary's own, so Party genres join directly with [`release_genre`](/move/music-protocol/extensions/release-genre/) and [`recording_genre`](/move/music-protocol/extensions/recording-genre/) tags.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another Party's admin cap | `add_genre` and `remove_genre` abort with `miso_party::party::EUnauthorized` (0) before any other check. |
| A genre the Party already has | `add_genre` aborts with `EGenreAlreadyAdded` (0). |
| A genre the Party does not have | `remove_genre` aborts with `EGenreNotFound` (1). |

## Events

| Event | Fields |
| --- | --- |
| `PartyGenreAddedEvent` | `party_id`, `genre_id`, `genre_name` |
| `PartyGenreRemovedEvent` | `party_id`, `genre_id` |

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre/Published.toml) records a mainnet publication at `0x4153be8d2c2f34b6f5263a3b101cf23ba5e58501d56dbe62e4c65c045671ae09`. It was recorded after the last change to this package's source and manifest and to its local dependency `genre`, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre/sources/party_genre.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_genre/tests/party_genre_tests.move).
