---
title: Recording Genre
description: Classify a recording under genres from the shared vocabulary, set by its admin.
---

`recording_genre` stores genre references on a recording for browsing and search. Every genre must come from the [`genre`](/move/framework/genre/) vocabulary.

## Genre Belongs to the Recording

Whitney Houston's recording of "I Will Always Love You" adds `POP` and `SOUL`; Dolly Parton's adds `COUNTRY`. The masters share a composition but are classified separately by their own admins. A recording's genres travel with it across every release.

A release such as *The Bodyguard* soundtrack can carry product-level genres through [`release_genre`](/move/framework/release-genre/). To resolve a track's genre, read the recording's genres first and fall back to the release's only when it has none (README recommendation).

## Storage

```move
public struct RecordingGenreKey(ID) has copy, drop, store;
```

Each genre is one dynamic field on the recording, keyed by the `Genre` object's ID, with value `true`. No on-chain list, ordering, or primary genre. `has_genre(recording, genre_id)` checks one genre. To list all, list the recording's dynamic fields of key type `RecordingGenreKey`.

## Adding and Removing Genres

`add_genre` takes the `RecordingAdminCap<RecordingShare>` and the `Genre` object:

```move
public fun add_genre<RecordingShare>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    genre: &Genre,
) {
    let recording_id = object::id(recording);
    let genre_id = object::id(genre);
    let uid = recording.uid_mut(cap);
    assert!(!df::exists(uid, RecordingGenreKey(genre_id)), EGenreAlreadyAdded);
    df::add(uid, RecordingGenreKey(genre_id), true);
    emit(RecordingGenreAddedEvent { recording_id, genre_id, genre_name: *genre.name() });
}
```

- **Only vocabulary genres can be added.** The ID comes from a `&Genre`, a frozen object.
- **Only the recording's admin can write.** Another recording's cap has a different share type, so the transaction is rejected before the call runs.
- **The event carries the name.** `genre_name` is copied from the `Genre`; indexers need no lookup.

Anyone can create a missing genre. `genre::new` returns the `Genre` and `genre::freeze_genre` must consume it in the same transaction, so run `add_genre` between them in one programmable transaction. A `Genre` from a different `genre` deployment has a different type and is rejected.

`remove_genre(recording, cap, genre_id)` takes only the genre ID, removes its field, and emits `RecordingGenreRemovedEvent`.

## Failure Cases

| Situation | Result |
| --- | --- |
| Adding a genre already on the recording | `add_genre` aborts with `EGenreAlreadyAdded` (0). |
| Removing a genre not on the recording | `remove_genre` aborts with `EGenreNotFound` (1). |
| A cap for another recording | The transaction is rejected before the call runs, because the cap's share type differs. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingGenreAddedEvent` | `recording_id`, `genre_id`, `genre_name` |
| `RecordingGenreRemovedEvent` | `recording_id`, `genre_id` |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre/Published.toml) records a mainnet generation at `0x390574601f94f3c90d4989ff06ec9bb477ca12556fea7bda440c4b17dd154b1b` and a testnet generation at `0x3d4751aec7ece56e51f82a7d725b6ce47768f36a41beba475e2cca269e7cf732`. Mainnet postdates the last change to this module, `genre`, and the core pin, so it matches this source. Testnet predates them. Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and depends on `genre` by local path, so it accepts only `Genre` objects of the `genre` package it was published against. The README states no audit status. The 5 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre/sources/recording_genre.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_genre/tests/recording_genre_tests.move).
