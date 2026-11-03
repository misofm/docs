---
title: Composition Lyrics
description: Attach zstd-compressed lyrics to a composition, one entry per ISO 639-1 language, written by its admin.
---

This page is for developers who publish or display a composition's lyrics. It explains how `composition_lyrics` stores one compressed lyrics entry per language, what the contract checks about those bytes and what it leaves to clients, and how to list, update, and remove entries.

## One Entry per Language

Suppose the admin of the composition "I Will Always Love You" publishes its English lyrics. The client encodes the text as UTF-8, compresses it into one Zstandard (zstd) frame, and calls `set_lyrics` with the composition's `CompositionAdminCap`, the language code `en`, and the compressed bytes. A translation would be a second entry under its own language code. Every [recording](/move/music-protocol/recording/) of the composition can then show the same text, since lyrics belong to the written work rather than to a master.

```move
public struct CompositionLyricsKey(LanguageCode) has copy, drop, store;
```

Each entry is a `vector<u8>` dynamic field on the composition's UID under this key. `LanguageCode` comes from the pinned [`language_code`](https://github.com/unconfirmedlabs/language_code/tree/0b317ca1e9122c75440e4d2c801079feb4b7a366) package, whose `new` accepts only a two-letter ISO 639-1 code such as `en` and aborts with `EInvalidLanguageCode` otherwise. The key holds the language alone, so regional and script variants such as `en-GB` have no separate entry. Languages are independent: each is added, replaced, or removed on its own, with no preferred language and no index of attached languages on the composition.

## What the Contract Checks

The payload convention is UTF-8 lyrics compressed into one standard, self-contained zstd frame with no external dictionary, at any compression level. Clients preserve whitespace, line breaks, and punctuation exactly. The contract enforces only part of that:

| Checked on-chain | Not checked |
| --- | --- |
| The payload is not empty | That the bytes are a zstd frame, or that they decompress |
| The payload is at most 32,768 bytes | That the decompressed text is valid UTF-8 |
| The language is a valid ISO 639-1 code | That the text is in that language, or is lyrics at all |

The 32,768-byte limit applies to the stored, compressed bytes, not to the decoded text. Malformed bytes can therefore be stored. A reader must treat each payload as untrusted: bound the decoder's memory and output size, since a small frame can expand to a very large text, handle decoding failures, and validate the UTF-8 before display.

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

The size checks run before `uid_mut(cap)`, which accepts only the composition's own admin cap; a cap for another composition does not type-check. A later call for the same language replaces the bytes, and a call with the bytes already stored neither writes nor emits. Equality is on the compressed bytes, so recompressing the same text at another level can count as a change. In one programmable transaction, the client builds the key with `language_code::new` and passes it to `set_lyrics`.

`clear_lyrics(composition, cap, language)` removes one language's entry after the cap check; clearing a language with no entry is a silent no-op. **Clearing does not unpublish.** Every `CompositionLyricsSetEvent` carried the full compressed bytes, and they remain readable in event history and earlier object versions. Attaching lyrics is a claim by the cap holder; the contract does not check that the holder may publish the text, and the entry does not license anyone to reproduce it.

## Reading Lyrics

`has_lyrics(composition, language)`, `lyrics(composition, language)`, and `max_lyrics_length()` are permissionless. `lyrics` borrows the stored bytes and aborts when that language has no entry, even if others do. To list the attached languages, list the composition's dynamic fields (for example with `suix_getDynamicFields`) and keep those whose name type is this package's `CompositionLyricsKey`, or replay the set and cleared events per composition and language.

No entry for any language does not mean the composition is instrumental; it means none has been supplied. A recording's instrumental status belongs in [`recording_language`](/move/music-protocol/extensions/recording-language/), and lyric timing belongs to a recording rather than to this text.

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

A set event for a full 32,768-byte payload is 32,806 bytes, under Sui's 250 KiB per-event limit, so an indexer never needs to read the dynamic field.

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics/Published.toml) records a mainnet generation, `published-at = "0x92bca50b33f53b4ff4321e2bebe0df2dfdc25600b79a82fa61833c158905db0f"`, recorded after the last change to the package's sources, so it is the generation this page describes. Its testnet entry, `published-at = "0x9d4bd69f62c9744ec5ef9bba8a57a003b0ae79b4b00ab7e941b9ecb2ee5e6274"`, was recorded for an earlier generation and predates this source. The package README makes no statement about an audit. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `language_code` at `0b317ca1e9122c75440e4d2c801079feb4b7a366`. The 12 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics/sources/composition_lyrics.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/composition_lyrics/tests/composition_lyrics_tests.move).
