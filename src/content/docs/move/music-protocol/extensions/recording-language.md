---
title: Recording Language
description: Record the ordered ISO 639-1 languages sung or spoken on a recording, or an explicit instrumental claim, written by the recording's admin.
---

This page is for developers who record which languages a recording is performed in, or who read them to filter, search, or match lyrics. It explains how `recording_language` stores an ordered list of language codes, why an empty list means instrumental while a missing list means nothing has been said, and how the recording admin sets and clears it.

## Three States

Suppose the admin of Whitney Houston's recording of "I Will Always Love You" sets `[en]`. Suppose also that an instrumental version is published as its own Recording of the same composition; its admin sets an empty list. A third recording whose admin has set nothing carries no field at all.

| Stored value | `has_languages` | `languages` returns | Meaning |
| --- | --- | --- | --- |
| No field | `false` | aborts with `ENoLanguages` | No claim has been made. |
| `[]` | `true` | an empty vector | The admin asserts the recording is instrumental. |
| `[en, es]` | `true` | the codes in the stored order | Sung or spoken in these languages; first is conventionally predominant. |

A client tests for instrumental with `has_languages(recording) && languages(recording).is_empty()`. Treating a missing field as instrumental, or an empty list as unknown, misreads the admin. `clear_languages` removes the field entirely, including an instrumental claim, and returns the recording to "no claim".

## Setting the Languages

The list is a `vector<LanguageCode>` from the pinned [`language_code`](https://github.com/unconfirmedlabs/language_code/tree/0b317ca1e9122c75440e4d2c801079feb4b7a366) package, stored under the package's `RecordingLanguageKey()` dynamic field. `language_code::new` accepts only ISO 639-1 codes, so every `LanguageCode` is valid by construction. In a programmable transaction, call `language_code::language_code::new` once per code, collect the results into a vector (an empty one for instrumental), and pass it to `set_languages`:

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

The function shows four rules:

- **At most 10 codes, no repeats.** `MAX_LANGUAGES` is 10. The count is checked before repeats.
- **Order is the caller's.** The list is stored as given, and the same codes in a different order are a different value that writes and emits.
- **Only the recording's admin can write.** Each share type belongs to exactly one recording, so a cap for another recording has a different type and the transaction is rejected before the call runs.
- **Every event is a real change.** Setting the list already held returns without writing or emitting.

Reads are permissionless. `languages(recording)` returns a reference to the stored vector; check `has_languages` first.

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

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/Published.toml) records a mainnet generation at `0x7a7dbd0cf32b2822523bf0603464a92c017ae4119a137dfc83b517683253f415` and a testnet generation at `0x4bdef95a64af8900065f24c34a66ccf694c96de4324e7fadf491a5bf73a899bf`. The mainnet entry was recorded after the module's last source change and its current core pin, so it matches this source; the testnet entry predates both and is an earlier generation. The package pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `language_code` at `0b317ca1e9122c75440e4d2c801079feb4b7a366`. The README does not say whether the package has been audited. The 20 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/sources/recording_language.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_language/tests).
