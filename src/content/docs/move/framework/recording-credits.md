---
title: Recording Credits
description: Credit Parties on a recording with a display name and roles, including primary and featured artists.
---

`recording_credits` stores one credit per [Party](/move/party-protocol/) on a [Recording](/move/music-protocol/recording/): a display name plus up to 10 of 33 roles. Use it to bill performers and producers, and to mark primary and featured artists.

## Crediting a Recording

Whitney Houston's master of "I Will Always Love You" holds two credits keyed by Party ID: her Party as `Whitney Houston` with roles `Primary` and `Vocalist` (level `Lead`), and a producer's Party as `Producer`.

```move
public struct RecordingCredits has store {
    credits: VecMap<ID, Credit<RecordingPartyRole>>,
}

public struct RecordingCreditsKey() has copy, drop, store;
```

One dynamic field under `RecordingCreditsKey()` maps Party ID to credit in insertion order: one credit per Party, 150 per recording. The first `add_credit` attaches it. The `remove_credit` that empties it detaches it. `has_credits(recording)` is true exactly when a credit exists.

Each credit is a [`credit`](/move/framework/credit/) `Credit<Role>`: a display name of 1 to 200 bytes and 1 to 10 distinct roles. The display name is stored, not read from the Party, so it can differ from the Party's [name](/move/framework/party-name/). Recordings do not inherit composition credits. Dolly Parton's songwriting credit belongs in [`composition_credits`](/move/framework/composition-credits/).

## Roles

`recording_party_role` defines a closed enum of 33 roles, in alphabetical order:

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

Each role and level has a constructor named for its variant: `new_vocalist_role(level)`, `new_mastering_engineer_role(level)`, `new_lead_role_level()`. Role kinds:

- **Most roles take an optional level.** `Vocalist` with `Lead` is a lead vocalist, `Producer` with `Executive` an executive producer, `Producer` with no level unqualified. `level(&role)` returns the level, or none.
- **`Instrumentalist` also names the instrument.** `new_instrumentalist_role(instrument, level)` requires a non-empty name of at most 100 bytes. Free text: `guitar` and `Guitar` differ.
- **Four roles take no level.** `ArtistsAndRepertoire`, `Copyist`, `Featured`, and `Primary` have no-argument constructors, such as `new_primary_role()`.

Roles compare by whole value, level and instrument included. `credit::new` rejects duplicates, but `Vocalist` with no level and `Vocalist` with `Lead` differ, as do `Instrumentalist` roles with different instruments. One credit can hold both.

A role's BCS encoding is its variant index in declaration order, then the instrument name for `Instrumentalist`, then the optional level. Decode event `roles` with the declaration order of your generation. The testnet generation in `Published.toml` predates `Primary` and `Featured`, so its indices differ.

## Primary and Featured Artists

The `Primary` and `Featured` roles bill a Party as primary or featured artist. The `Primary` and `Featured` levels differ: they qualify another role. A `Vocalist` with level `Featured` is a featured vocalist, but only the `Featured` role makes `is_featured_artist` true.

Both views share one private check. `borrow` aborts without a record, so `has_credits` is tested first:

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

`is_primary_artist(recording, party_id)` passes `new_primary_role()`. `is_featured_artist` passes `new_featured_role()`. Both are permissionless and return false, not abort, when the recording or Party has no credits.

- A credit cannot hold both artist roles. `add_credit` aborts with `EPrimaryAndFeatured`.
- An artist role combines with others: Whitney Houston's credit holds `Primary` and a leveled `Vocalist`.
- Any number of primary or featured artists, including none.
- Billing order is insertion order. Filter `credits(recording)` for the two roles in map order.

Release billing is separate. [`release_credits`](/move/framework/release-credits/) stores artists on a Release under the release admin's authority and never reads its recordings' credits.

## Adding a Credit

As recording admin, in one programmable transaction:

1. Build each role with its `recording_party_role` constructor and each level with `new_*_role_level()`.
2. Call `credit::new(display_name, roles)`.
3. Call `add_credit(recording, cap, party, credit)`.

Test excerpt (`credits` and `rpr` alias `recording_credits` and `recording_party_role`):

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

`add_credit` validates roles, authorizes, then checks stored state:

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

- **Role checks run before the cap.** More than 10 roles, or both artist roles, abort whatever cap is supplied. The [`credit`](/move/framework/credit/) library allows 50 roles. `ETooManyRoles` is this package's tighter limit.
- **Only the recording's admin writes.** `uid_mut(cap)` accepts only the `RecordingAdminCap` of the recording's share type. A cap for another recording does not type-check.
- **The Party must exist but is not asked.** `add_credit` takes `&Party`. Its admin does not sign, so a credit is the recording admin's attribution, not the Party's acknowledgement. It confers no shares or royalties, and no economics read it.
- **Capacity is checked before duplicates.** At 150 credits, re-crediting an existing Party reports `ETooManyCredits`.

## Changing and Removing Credits

There is no update. In one transaction, call `remove_credit(recording, cap, party_id)` then `add_credit`, so readers never see the Party uncredited. The re-added credit moves to the end, changing billing order. To keep order, also remove and re-add the later credits.

`remove_credit` checks the cap, then that a record exists and the Party has a credit. Removing the last credit detaches the record. Nothing is a silent no-op: crediting a Party twice, even identically, and removing an uncredited Party both abort.

## Reading Credits

`has_credits(recording)`, `credits(recording)`, `is_primary_artist`, and `is_featured_artist` are permissionless. `credits` returns `&VecMap<ID, Credit<RecordingPartyRole>>` in insertion order and aborts without a record, so check `has_credits` first. Read `display_name()` and `roles()` from [`credit`](/move/framework/credit/), and a level with `recording_party_role::level`.

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

Each successful write emits one event. Replaying them in order rebuilds credits, order, and artist roles. The largest added event (200-byte display name, ten instrumentalist roles with 100-byte names and levels) is 1,307 bytes. Events omit the composition ID. Join it from the core `RecordingCreatedEvent`.

## Deployment

At commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/Published.toml) records mainnet `published-at = "0x3fbde180089e62cef1666dc452bb6006cd2da0e948a2bfce27ce779b61b60a37"`, after the last source change, so it matches this page. The testnet entry, `published-at = "0x5e196e56a0e47c6f02e23737a5ea28a1a87f1df36936aa624f8bffeed95f2d7f"`, predates this source and the `Primary` and `Featured` roles. The README makes no audit statement. `Move.toml` pins `miso_music` at [`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c) and `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4), and depends on `credit` by local path. The 31 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/README.md), modules [`recording_credits`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/sources/recording_credits.move) and [`recording_party_role`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/sources/recording_party_role.move), and [tests](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/recording_credits/tests).
