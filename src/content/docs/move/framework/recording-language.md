---
title: Recording Language
description: Store a recording's ordered ISO 639-1 languages, or an explicit instrumental claim.
---

`recording_language` stores the ordered ISO 639-1 language codes a recording is performed in, for filtering, search, and lyric matching. An empty list means instrumental; a missing list means nothing has been claimed.

## Three States

Whitney Houston's "I Will Always Love You" sets `[en]`. Its instrumental version, a separate Recording, sets an empty list. A recording with nothing set has no field.

| Stored value | `has_languages` | `languages` returns | Meaning |
| --- | --- | --- | --- |
| No field | `false` | aborts with `ENoLanguages` | No claim has been made. |
| `[]` | `true` | an empty vector | The admin asserts the recording is instrumental. |
| `[en, es]` | `true` | the codes in the stored order | Sung or spoken in these languages; first is conventionally predominant. |

Test for instrumental with `has_languages(recording) && languages(recording).is_empty()`. A missing field is never instrumental, and an empty list is never unknown. `clear_languages` removes the field, including an instrumental claim, returning to "no claim".

## Setting the Languages

The list is a `vector<LanguageCode>` from the pinned [`language_code`](https://github.com/unconfirmedlabs/language_code/tree/0b317ca1e9122c75440e4d2c801079feb4b7a366) package, stored under `RecordingLanguageKey()`. `language_code::new` accepts only ISO 639-1 codes, so every `LanguageCode` is valid. In a programmable transaction, call `language_code::language_code::new` per code, collect the results (empty for instrumental), and pass the vector to `set_languages`:

```move
public fun set_languages<RecordingShare>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    languages: vector<LanguageCode>,
) {
    assert!(languages.length() <= MAX_LANGUAGES, ETooManyLanguages);
    let mut seen = vec_set::empty<LanguageCode>();
    languages.do_ref!(|language| {
        assert!(!seen.contains(language), ELanguageAlreadyAdded);
        seen.insert(*language);
    });
    let recording_id = object::id(recording);
    let uid = recording.uid_mut(cap);
    if (df::exists(uid, RecordingLanguageKey())) {
        let current: &mut vector<LanguageCode> = df::borrow_mut(uid, RecordingLanguageKey());
        if (*current == languages) return;
        *current = languages;
    } else {
        df::add(uid, RecordingLanguageKey(), languages);
    };
    emit(RecordingLanguagesSetEvent {
        recording_id,
        languages: languages.map_ref!(|language| language.code()),
    });
}
```

- **At most 10 codes, no repeats.** `MAX_LANGUAGES` is 10. The count is checked before repeats.
- **Order is kept.** The same codes reordered are a new value that writes and emits.
- **Only the recording's admin can write.** Another recording's cap has a different share type, so the transaction is rejected before the call runs.
- **Every event is a real change.** Setting the held list writes and emits nothing.

Reads are permissionless. `languages(recording)` returns a reference to the stored vector. Check `has_languages` first.

## Failure Cases

| Situation | Result |
| --- | --- |
| A code outside ISO 639-1 | `language_code::new` aborts with its `EInvalidLanguageCode` before `set_languages` runs. |
| More than 10 codes | `set_languages` aborts with `ETooManyLanguages` (1). |
| A repeated code | `set_languages` aborts with `ELanguageAlreadyAdded` (2). |
| Reading a recording with no field | `languages` aborts with `ENoLanguages` (0). |
| A cap for another recording | The transaction is rejected before the call runs, because the cap's share type differs. |
| Setting the list already held, or clearing when absent | No write and no event. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingLanguagesSetEvent` | `recording_id`, `languages` (the two-letter codes as strings, in order; empty means instrumental) |
| `RecordingLanguagesClearedEvent` | `recording_id` |

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/Published.toml) records a mainnet generation at `0x7a7dbd0cf32b2822523bf0603464a92c017ae4119a137dfc83b517683253f415` and a testnet generation at `0x4bdef95a64af8900065f24c34a66ccf694c96de4324e7fadf491a5bf73a899bf`. Mainnet postdates the last source change and core pin, so it matches this source. Testnet predates both. Pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `language_code` at `0b317ca1e9122c75440e4d2c801079feb4b7a366`. The README states no audit status. The 20 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/sources/recording_language.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/tests).
