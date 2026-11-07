---
title: Composition Lyrics
description: One zstd-compressed lyrics entry per ISO 639-1 language on a composition.
---

`composition_lyrics` stores one zstd-compressed lyrics entry per language on a composition. Use it to publish or display lyrics.

## One Entry per Language

To publish English lyrics for "I Will Always Love You", encode the text as UTF-8, compress it into one Zstandard (zstd) frame, and call `set_lyrics` with the composition's `CompositionAdminCap`, code `en`, and the bytes. A translation is a second entry under its own code. Every [recording](/move/music-protocol/recording/) of the composition shows the same text: lyrics belong to the work, not a master.

```move
public struct CompositionLyricsKey(LanguageCode) has copy, drop, store;
```

Each entry is a `vector<u8>` dynamic field on the composition's UID under this key. `LanguageCode` comes from the pinned [`language_code`](https://github.com/unconfirmedlabs/language_code/tree/0b317ca1e9122c75440e4d2c801079feb4b7a366) package, whose `new` accepts only a two-letter ISO 639-1 code such as `en` and otherwise aborts with `EInvalidLanguageCode`. The key is the language alone, so `en-GB` has no separate entry. Each language is added, replaced, or removed independently. There is no preferred language and no index of languages.

## What the Contract Checks

Convention: UTF-8 lyrics in one self-contained zstd frame, no external dictionary, any compression level. Clients preserve whitespace, line breaks, and punctuation exactly. The contract enforces only part:

| Checked on-chain | Not checked |
| --- | --- |
| The payload is not empty | That the bytes are a zstd frame, or that they decompress |
| The payload is at most 32,768 bytes | That the decompressed text is valid UTF-8 |
| The language is a valid ISO 639-1 code | That the text is in that language, or is lyrics at all |

The 32,768-byte limit applies to the stored compressed bytes, so malformed bytes can be stored. **Treat every payload as untrusted.** Bound decoder memory and output (a small frame can expand hugely), handle decode failures, and validate UTF-8 before display.

## Setting Lyrics

```move
public fun set_lyrics<CompositionShare>(
    composition: &mut Composition<CompositionShare>,
    cap: &CompositionAdminCap<CompositionShare>,
    language: LanguageCode,
    lyrics: vector<u8>,
) {
    assert!(!lyrics.is_empty(), EEmptyLyrics);
    assert!(lyrics.length() <= MAX_LYRICS_LENGTH, ELyricsTooLong);
    let composition_id = object::id(composition);
    let uid = composition.uid_mut(cap);
    let key = CompositionLyricsKey(language);
    if (df::exists(uid, key)) {
        let stored: &mut vector<u8> = df::borrow_mut(uid, key);
        if (*stored == lyrics) return;
        *stored = lyrics;
    } else {
        df::add(uid, key, lyrics);
    };
    emit(CompositionLyricsSetEvent { composition_id, language: language.code(), lyrics });
}
```

Size checks run before `uid_mut(cap)`, which accepts only the composition's own admin cap; another composition's cap does not type-check. A later call for the same language replaces the bytes. Bytes already stored neither write nor emit. Equality is on compressed bytes, so recompressing the same text at another level is a change. In one programmable transaction, build the language with `language_code::new` and pass it to `set_lyrics`.

`clear_lyrics(composition, cap, language)` removes one language's entry after the cap check; clearing an absent entry is a silent no-op. **Clearing does not unpublish.** Each `CompositionLyricsSetEvent` carried the full compressed bytes, which stay readable in event history and earlier object versions. Attaching lyrics is the cap holder's claim. The contract does not check that the holder may publish the text, and the entry licenses nobody to reproduce it.

## Reading Lyrics

`has_lyrics(composition, language)`, `lyrics(composition, language)`, and `max_lyrics_length()` are permissionless. `lyrics` borrows the stored bytes and aborts when that language has no entry, even if others do. To list languages, list the composition's dynamic fields (for example with `suix_getDynamicFields`) and keep those whose name type is this package's `CompositionLyricsKey`, or replay set and cleared events.

No entry means no lyrics supplied, not instrumental. Instrumental status and lyric timing belong to a recording, in [`recording_language`](/move/framework/recording-language/).

## Failure Cases

| Situation | Result |
| --- | --- |
| Reading `lyrics` for a language with no entry | Aborts with `ENoLyrics` (0). |
| `set_lyrics` with an empty payload | Aborts with `EEmptyLyrics` (1), before the cap is checked. |
| `set_lyrics` with more than 32,768 bytes | Aborts with `ELyricsTooLong` (2), before the cap is checked. |
| A code that is not ISO 639-1 | `language_code::new` aborts with `EInvalidLanguageCode`. |
| A cap for a different composition | Does not type-check: the cap's share type must match the composition's. |

## Events

| Event | Fields |
| --- | --- |
| `CompositionLyricsSetEvent` | `composition_id`, `language` (the code as a `String`), `lyrics` (the compressed bytes as stored); only when the stored bytes change |
| `CompositionLyricsClearedEvent` | `composition_id`, `language`; only when an entry was removed |

A set event for a full 32,768-byte payload is 32,806 bytes, under Sui's 250 KiB per-event limit, so indexers never need to read the dynamic field.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics/Published.toml) records a mainnet generation, `published-at = "0x92bca50b33f53b4ff4321e2bebe0df2dfdc25600b79a82fa61833c158905db0f"`, recorded after the last source change, so it matches this page. The testnet entry, `published-at = "0x9d4bd69f62c9744ec5ef9bba8a57a003b0ae79b4b00ab7e941b9ecb2ee5e6274"`, is an earlier generation that predates this source. No audit statement in the README. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `language_code` at `0b317ca1e9122c75440e4d2c801079feb4b7a366`. The 12 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics/sources/composition_lyrics.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/composition_lyrics/tests/composition_lyrics_tests.move).
