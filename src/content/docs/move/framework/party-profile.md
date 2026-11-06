---
title: Party Profile
description: Store a Party's profile card of biographies, country, and languages, replaced as a whole.
---

This page is for developers who render or edit a [Party](/move/party-protocol/)'s profile page. It explains what the `party_profile` card holds, the limits it enforces, and how to replace or clear it.

## The Profile Card

Suppose Dolly Parton's Party, credited as the writer of "I Will Always Love You", sets a profile with a one-line biography, the country `US`, and the language `en`. The whole card is one value stored on the Party:

```move
public struct Profile has drop, store {
    bio_short: String,
    bio_long: Option<String>,
    country: Option<CountryCode>,
    languages: vector<LanguageCode>,
}
```

| Field | Rule |
| --- | --- |
| `bio_short` | Required, 1 to 300 bytes. |
| `bio_long` | Optional; 1 to 8,192 bytes when present. The limit is a storage backstop, not an editorial one. |
| `country` | Optional ISO 3166-1 alpha-2 code, such as `US`. |
| `languages` | Up to 10 ISO 639-1 codes, such as `en`, with no duplicates. |

Lengths count UTF-8 bytes, so text with multibyte characters reaches them sooner. `CountryCode` and `LanguageCode` come from the pinned `country_code` and `language_code` packages, whose `new` functions abort unless the string is an assigned code, so a stored value is always a real code.

Each Party has at most one card, under `PartyProfileKey()`. The card holds no name, genres, or join date: the name is in [`party_name`](/move/framework/party-name/), genres are in [`party_genre`](/move/framework/party-genre/), and the join date comes from the Party's `PartyCreatedEvent`.

## Replacing the Card

`set_profile(party, cap, bio_short, bio_long, country, languages)` writes the whole card; there are no per-field setters. To change one field, read the current card, change it in the client, and send every field again. Build the codes in the same transaction with `country_code::new` and `language_code::new`.

Validation runs before the cap is checked (excerpt; the rest builds the event, checks the cap with `uid_mut`, and writes the card):

```move
assert!(!bio_short.is_empty(), EEmptyBioShort);
assert!(bio_short.length() <= MAX_BIO_SHORT_LENGTH, EBioShortTooLong);
bio_long.do_ref!(|bio| {
    assert!(!bio.is_empty(), EEmptyBioLong);
    assert!(bio.length() <= MAX_BIO_LONG_LENGTH, EBioLongTooLong);
});
assert!(languages.length() <= MAX_LANGUAGES, ETooManyLanguages);
let mut seen = vec_set::empty<LanguageCode>();
languages.do_ref!(|language| {
    assert!(!seen.contains(language), ELanguageAlreadyListed);
    seen.insert(*language);
});
```

The new card overwrites any existing one. If it equals the stored card, nothing is written and no event is emitted.

`clear_profile(party, cap)` removes the card and reclaims its storage; it is silent when no card is set. Read the card with `has_profile(party)` and `profile(party)`, which aborts when none is set, then the field accessors `bio_short`, `bio_long`, `country`, and `languages`.

Biographies are user-controlled text: sanitize them before rendering. Like a name, a profile is a claim by the Party's administrator, not verified information.

The published layout of `Profile` will not change. The [Party roadmap](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/ROADMAP.md) plans fields such as pronouns in a separate successor package with an explicit migration.

## Failure Cases

| Situation | Result |
| --- | --- |
| An empty `bio_short` | `set_profile` aborts with `EEmptyBioShort` (0). |
| A `bio_short` over 300 bytes | `set_profile` aborts with `EBioShortTooLong` (1). |
| A `bio_long` of `some("")` | `set_profile` aborts with `EEmptyBioLong` (2). |
| A `bio_long` over 8,192 bytes | `set_profile` aborts with `EBioLongTooLong` (3). |
| More than 10 languages | `set_profile` aborts with `ETooManyLanguages` (4). |
| A language listed twice | `set_profile` aborts with `ELanguageAlreadyListed` (6). |
| Another Party's admin cap | `set_profile` and `clear_profile` abort with `miso_party::party::EUnauthorized` (0), after the validation above. |
| Reading a Party with no card | `profile` aborts with `ENoProfile` (5). |

## Events

| Event | Fields |
| --- | --- |
| `PartyProfileSetEvent` | `party_id`, `bio_short`, `bio_long`, `country`, `languages`; only when the card changes |
| `PartyProfileClearedEvent` | `party_id`; only when a card was removed |

The set event carries the whole card, with `country` and `languages` as plain code strings, so an indexer never needs to read the Party.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile/Published.toml) records a mainnet publication at `0x64ad526937620a110d20884027ff268505c76b3a19910619f3afca1f516d46ca`. It was recorded after the last change to this package's source and manifest, so the recorded mainnet generation matches this source. The testnet entry was recorded earlier, before the package was repinned to the mainnet core, and predates this source. The package README does not mention an audit. The package pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), and `country_code` and `language_code` at exact Git revisions. The 23 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile/LICENSE.md). Core Party remains Apache-2.0. The docs' Apache license does not relicense the excerpts.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile/sources/party_profile.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_profile/tests/party_profile_tests.move).
