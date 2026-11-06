---
title: Recording Credits
description: Credit each Party that performed on or produced a recording, including its primary and featured artists, with a display name and roles.
---

This page is for developers who display or set a recording's credits. It explains how `recording_credits` stores one credit per [Party](/move/party-protocol/) on a [Recording](/move/music-protocol/recording/), the 33 roles a credit can carry, how primary and featured artists are marked, and the rules for adding and removing credits.

## Crediting a Recording

Whitney Houston's master of "I Will Always Love You" is one Recording of the composition Dolly Parton wrote. Suppose its recording admin credits Whitney Houston's Party with the display name `Whitney Houston` and two roles: `Primary`, which bills her as the recording's primary artist, and `Vocalist` with the `Lead` level. Suppose the admin also credits a producer's Party as `Producer`. The recording then holds two credits keyed by Party ID:

```move
public struct RecordingCredits has store {
    credits: VecMap<ID, Credit<RecordingPartyRole>>,
}

public struct RecordingCreditsKey() has copy, drop, store;
```

The record is one dynamic field on the recording under `RecordingCreditsKey()`. It maps each credited Party ID to its credit, in the order the credits were added, with at most one credit per Party and at most 150 per recording. The first `add_credit` attaches the record and the `remove_credit` that empties it detaches it, so `has_credits(recording)` is true exactly when at least one credit exists.

Each credit is a [`credit`](/move/framework/credit/) `Credit<Role>`: a display name of 1 to 200 bytes and one or more distinct roles, at most 10 on a recording. The display name is stored on the credit; it is not read from the Party, so it can differ from the Party's [name](/move/framework/party-name/). Dolly Parton's songwriting credit belongs on the composition, in [`composition_credits`](/move/framework/composition-credits/); a recording does not inherit the composition's credits.

## Roles

`recording_party_role` defines a closed enum of 33 performance and production roles, in alphabetical order:

```move
public enum RecordingPartyRole has copy, drop, store {
    Actor(Option<RecordingPartyRoleLevel>),
    Arranger(Option<RecordingPartyRoleLevel>),
    ArtistsAndRepertoire,
    BandLeader(Option<RecordingPartyRoleLevel>),
    Choir(Option<RecordingPartyRoleLevel>),
    ChoirMaster(Option<RecordingPartyRoleLevel>),
    ConcertMaster(Option<RecordingPartyRoleLevel>),
    Conductor(Option<RecordingPartyRoleLevel>),
    Contractor(Option<RecordingPartyRoleLevel>),
    Copyist,
    Dj(Option<RecordingPartyRoleLevel>),
    Editor(Option<RecordingPartyRoleLevel>),
    Engineer(Option<RecordingPartyRoleLevel>),
    Ensemble(Option<RecordingPartyRoleLevel>),
    Featured,
    Instrumentalist(String, Option<RecordingPartyRoleLevel>),
    MasteringEngineer(Option<RecordingPartyRoleLevel>),
    MixingEngineer(Option<RecordingPartyRoleLevel>),
    MusicDirector(Option<RecordingPartyRoleLevel>),
    MusicSupervisor(Option<RecordingPartyRoleLevel>),
    Narrator(Option<RecordingPartyRoleLevel>),
    Orchestra(Option<RecordingPartyRoleLevel>),
    Orchestrator(Option<RecordingPartyRoleLevel>),
    Performer(Option<RecordingPartyRoleLevel>),
    Primary,
    Producer(Option<RecordingPartyRoleLevel>),
    Programmer(Option<RecordingPartyRoleLevel>),
    RecordingEngineer(Option<RecordingPartyRoleLevel>),
    RemixingEngineer(Option<RecordingPartyRoleLevel>),
    Soloist(Option<RecordingPartyRoleLevel>),
    SoundDesigner(Option<RecordingPartyRoleLevel>),
    Speaker(Option<RecordingPartyRoleLevel>),
    Vocalist(Option<RecordingPartyRoleLevel>),
}

public enum RecordingPartyRoleLevel has copy, drop, store {
    Additional,
    Assistant,
    Associate,
    Backing,
    Executive,
    Featured,
    Lead,
    Primary,
    Principal,
}
```

Each role has a constructor in `recording_party_role`, named for the variant, such as `new_vocalist_role(level)` or `new_mastering_engineer_role(level)`, and each level has one such as `new_lead_role_level()`. The enum shows three kinds of role:

- **Most roles take an optional level.** `Vocalist` with the `Lead` level is a lead vocalist, `Producer` with `Executive` an executive producer, and `Producer` with no level a producer without a qualifier. `level(&role)` returns the level, or none for a role without one.
- **`Instrumentalist` also names the instrument.** `new_instrumentalist_role(instrument, level)` requires a non-empty name of at most 100 bytes. The name is free text, so `guitar` and `Guitar` are different instruments.
- **Four roles take no level.** `ArtistsAndRepertoire`, `Copyist`, `Featured`, and `Primary` have constructors with no arguments, such as `new_primary_role()`.

Roles compare by their whole value, level and instrument included. `credit::new` rejects a duplicate role, but `Vocalist` with no level and `Vocalist` with `Lead` are different roles, as are two `Instrumentalist` roles with different instruments, so one credit can hold both.

The BCS encoding of a role is its variant index in the declaration order above, followed by the instrument name for `Instrumentalist` and then the optional level. Indexers decoding `roles` from events must use the declaration order of the generation they follow; the testnet generation recorded in `Published.toml` predates the `Primary` and `Featured` roles, so its indices differ.

## Primary and Featured Artists

The `Primary` and `Featured` roles bill a Party as a primary or featured artist of the recording. They are separate from the `Primary` and `Featured` levels, which qualify another role: `Vocalist` with the `Featured` level is a featured vocalist, but only the `Featured` role makes `is_featured_artist` true.

Both artist views share one private check, which compares the whole role value. `borrow` aborts when no record is attached, which the `has_credits` test rules out first:

```move
fun has_role<RecordingShare>(
    recording: &Recording<RecordingShare>,
    party_id: ID,
    role: RecordingPartyRole,
): bool {
    has_credits(recording) &&
        borrow(recording.uid()).credits.try_get(&party_id).is_some_and!(|credit| credit.roles().contains(&role))
}
```

`is_primary_artist(recording, party_id)` calls it with `new_primary_role()` and `is_featured_artist` with `new_featured_role()`. Both are permissionless and return false, rather than abort, for a recording with no credits or a Party with none.

What the contract enforces about artists:

- **A credit cannot hold both artist roles.** `add_credit` aborts with `EPrimaryAndFeatured`.
- **An artist role combines with others.** Whitney Houston's credit above holds `Primary` and a leveled `Vocalist`.
- **The count is free.** A recording can have several primary artists, several featured artists, or none; nothing requires a primary artist.
- **Billing order is insertion order.** To list the artists, filter `credits(recording)` for the two roles in map order.

A release's top-line billing is separate. [`release_credits`](/move/framework/release-credits/) stores primary and featured artists on a Release under the release admin's authority, and it neither reads nor checks the credits of the release's recordings.

## Adding a Credit

The recording admin builds the credit and adds it in one programmable transaction:

1. Build each role with its `recording_party_role` constructor, and each level with its `new_*_role_level()` constructor.
2. Call `credit::new(display_name, roles)`.
3. Call `add_credit(recording, cap, party, credit)` with the recording's admin cap and the credited Party.

A test builds and adds a credit with an artist role and a role without a level (test excerpt; `credits` and `rpr` alias `recording_credits` and `recording_party_role`):

```move
credits::add_credit(
    &mut rec,
    &cap,
    &p,
    credit::new(
        b"Both".to_string(),
        vector[rpr::new_primary_role(), rpr::new_vocalist_role(option::none())],
    ),
);
```

`add_credit` validates the roles, authorizes, then checks stored state:

```move
public fun add_credit<RecordingShare>(
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    party: &Party,
    credit: Credit<RecordingPartyRole>,
) {
    assert!(credit.roles().length() <= MAX_ROLES_PER_CREDIT, ETooManyRoles);
    assert!(
        !(
            credit.roles().contains(&new_primary_role()) && credit.roles().contains(&new_featured_role()),
        ),
        EPrimaryAndFeatured,
    );
    let recording_id = object::id(recording);
    let party_id = object::id(party);
    let display_name = *credit.display_name();
    let roles = *credit.roles();
    let uid = recording.uid_mut(cap);
    if (!df::exists(uid, RecordingCreditsKey())) {
        df::add(uid, RecordingCreditsKey(), RecordingCredits { credits: vec_map::empty() });
    };
    let record: &mut RecordingCredits = df::borrow_mut(uid, RecordingCreditsKey());
    assert!(record.credits.length() < MAX_CREDITS, ETooManyCredits);
    assert!(!record.credits.contains(&party_id), EPartyAlreadyCredited);
    record.credits.insert(party_id, credit);
    emit(RecordingCreditAddedEvent { recording_id, party_id, display_name, roles });
}
```

- **The role checks run before the cap.** More than 10 roles, or both artist roles, abort whatever cap is supplied. The [`credit`](/move/framework/credit/) library allows up to 50 roles; this package's tighter limit has its own `ETooManyRoles`.
- **Only the recording's admin writes.** `uid_mut(cap)` accepts only the `RecordingAdminCap` of the recording's share type; a cap for another recording does not type-check.
- **The Party must exist, but it is not asked.** `add_credit` takes `&Party` and keys the credit by its object ID. The credited Party's admin does not sign, so a credit is the recording admin's attribution, not the Party's acknowledgement. It confers no shares or royalties; no economics read it.
- **Capacity is checked before duplicates.** At 150 credits, re-crediting a Party already present reports `ETooManyCredits`.

## Changing and Removing Credits

There is no update function. To change a credit, call `remove_credit(recording, cap, party_id)` and then `add_credit` with the new credit, in the same transaction so readers never see the Party uncredited. The re-added credit moves to the end of the order, which changes artist billing order; to keep an order, remove and re-add the credits after it as well.

`remove_credit` checks the cap, then that a record exists and that the Party has a credit. Removing the last credit detaches the record. No write is a silent no-op: crediting a Party twice, even with an identical credit, and removing an uncredited Party both abort.

## Reading Credits

`has_credits(recording)`, `credits(recording)`, `is_primary_artist`, and `is_featured_artist` are permissionless. `credits` returns the `&VecMap<ID, Credit<RecordingPartyRole>>` in insertion order and aborts when no record is attached, so check `has_credits` first. Read each credit's `display_name()` and `roles()` from the [`credit`](/move/framework/credit/) library, and each role's level with `recording_party_role::level`.

## Failure Cases

| Situation | Result |
| --- | --- |
| A credit with more than 10 roles | `add_credit` aborts with `ETooManyRoles` (0), before the cap is checked. |
| `add_credit` with 150 credits already held | Aborts with `ETooManyCredits` (1). |
| Crediting a Party that already has a credit | `add_credit` aborts with `EPartyAlreadyCredited` (2). |
| `credits` or `remove_credit` with no record attached | Aborts with `ENoCredits` (3). |
| Removing a Party that has no credit | `remove_credit` aborts with `EPartyNotFound` (4). |
| A credit with both the `Primary` and `Featured` roles | `add_credit` aborts with `EPrimaryAndFeatured` (5), before the cap is checked. |
| An empty instrument name | `new_instrumentalist_role` aborts with `recording_party_role::EEmptyInstrument` (0). |
| An instrument name over 100 bytes | `new_instrumentalist_role` aborts with `recording_party_role::EInstrumentTooLong` (1). |
| An invalid display name, no roles, more than 50 roles, or a duplicate role | `credit::new` aborts; see [`credit`](/move/framework/credit/). |
| A cap for a different recording | Does not type-check: the cap's share type must match the recording's. |

## Events

| Event | Fields |
| --- | --- |
| `RecordingCreditAddedEvent` | `recording_id`, `party_id`, `display_name`, `roles` (in stored order, with instrument names and levels) |
| `RecordingCreditRemovedEvent` | `recording_id`, `party_id` |

Every successful write emits exactly one event. Replaying them in order rebuilds the credit list, its order, and each Party's artist roles. The largest added event, with a 200-byte display name and ten instrumentalist roles with 100-byte names and levels, is 1,307 bytes. The events omit the composition ID, which an indexer joins from the core `RecordingCreatedEvent`.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/Published.toml) records a mainnet generation, `published-at = "0x3fbde180089e62cef1666dc452bb6006cd2da0e948a2bfce27ce779b61b60a37"`, recorded after the last change to the package's sources, so it is the generation this page describes. Its testnet entry, `published-at = "0x5e196e56a0e47c6f02e23737a5ea28a1a87f1df36936aa624f8bffeed95f2d7f"`, was recorded for an earlier generation that predates this source, before the `Primary` and `Featured` roles were added. The package README makes no statement about an audit. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), and depends on `credit` by local path. The 31 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/README.md), modules [`recording_credits`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/sources/recording_credits.move) and [`recording_party_role`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/sources/recording_party_role.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/tests).
