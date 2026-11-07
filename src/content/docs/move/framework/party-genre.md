---
title: Party Genre
description: Tag a Party with genres from the shared genre vocabulary.
---

`party_genre` tags a [Party](/move/party-protocol/) with genres from the shared vocabulary. Use it to show or set the genres an artist or other Party works in.

## Genre Tags on a Party

Tagging Dolly Parton's Party `COUNTRY` is the admin's display claim about the Party as a whole, separate from release and recording genres.

Genres come from the [`genre`](/move/framework/genre/) vocabulary: frozen `Genre` objects named in uppercase words joined by single underscores, such as `DRUM_AND_BASS`, with an ID derived from the name. The Party stores one dynamic field per genre ID, with value `true`:

```move
public struct PartyGenreKey(ID) has copy, drop, store;
```

There is no list object or ranking. A "primary genre" is a client convention. To list genres, read the Party's dynamic fields of name type `PartyGenreKey` over RPC, then resolve each ID to its `Genre` for the display name. `has_genre(party, genre_id)` checks one.

## Adding and Removing Genres

The `PartyAdminCap` holder adds a genre by passing the frozen `Genre` object:

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

`&Genre` guarantees every stored ID is a real vocabulary entry, not that it is curated: anyone can add a validated name with `genre::new`, and variants such as `HIPHOP` and `HIP_HOP` are distinct genres. Compute a name's ID offline with `genre::derive_address(registry, name)`.

`remove_genre(party, cap, genre_id)` removes a tag by ID and needs no `Genre` object.

IDs are the vocabulary's own, so Party genres join with [`release_genre`](/move/framework/release-genre/) and [`recording_genre`](/move/framework/recording-genre/) tags.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre/Published.toml) records:

- Mainnet: `0x4153be8d2c2f34b6f5263a3b101cf23ba5e58501d56dbe62e4c65c045671ae09`. Postdates the last change to this package's source, manifest, and local dependency `genre`: matches this source.
- Testnet: recorded before the repin to the mainnet core. Predates this source.

Pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4). The README does not mention an audit. The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre/sources/party_genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_genre/tests/party_genre_tests.move).
