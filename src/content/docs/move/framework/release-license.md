---
title: Release License
description: How a release's recording admins authorize it, and how its revenue is split into each track's recording pool.
---

This page is for developers who sell or distribute a release. It explains how `release_license` records each recording admin's authorization of a release, fixes the release's revenue splits, and forwards release revenue to each track's recording pool.

## Why a Release Needs a License

A core `Release` is an ordered list of recording IDs. At the core revision the framework pins ([`bc547c79`](https://github.com/misofm/music-protocol/tree/bc547c79a2d3a6db6543ba7b12260ce70b93731c)), creating one needs no permission from the recordings' admins, and the Release stores nothing else. Whether those admins agreed to the release, and how its revenue divides among tracks, live in this package. [Release](/move/music-protocol/release/#authorization-lives-in-a-release-license) explains why the core leaves them out.

Suppose a release puts Whitney Houston's "I Will Always Love You" first among three tracks. Its release admin creates the release's license with one split per track, and each track's recording admin authorizes that release on their own recording.

```move
public struct ReleaseLicense has key {
    id: UID,
    state: ReleaseLicenseState,
    release_id: ID,
    splits: vector<BPS>,
}

public enum ReleaseLicenseState has copy, drop, store {
    Authorizing { authorized_recording_count: u8 },
    Authorized,
}
```

The license is derived from the Release, so each release has at most one, at `derive_address(release)`, and `has_license(release)` says whether it exists. `splits` has one basis-point value per track, in track-list order, totalling exactly 10,000. A split may be zero; that track receives nothing. The license is never removed: its address is also where the release's money is collected.

## Authorization

The release admin calls `new(release, cap, splits)`, which returns the license unshared in the `Authorizing` state with a count of 0, so the same transaction can authorize tracks that the sender's caps control before `share`. Each recording admin then calls `authorize` (excerpt; the rest emits `ReleaseAuthorizationGrantedEvent` and raises the count):

```move
public fun authorize<RecordingShare>(
    self: &mut ReleaseLicense,
    recording: &mut Recording<RecordingShare>,
    cap: &RecordingAdminCap<RecordingShare>,
    release: &Release,
    splits: vector<BPS>,
) {
    let uid = recording.uid_mut(cap);
    let release_id = self.release_id;
    assert!(object::id(release) == release_id, EWrongRelease);
    assert!(self.splits == splits, ESplitsChanged);
    let recording_id = uid.to_inner();
    assert!(release.recording_ids().contains(&recording_id), ERecordingNotFound);
    let key = ReleaseAuthorizationKey(release_id);
    assert!(!df::exists(uid, key), ERecordingAlreadyAuthorized);
    df::add(uid, key, true);
```

The excerpt shows three design choices:

- **The authorization is written on the recording.** `uid_mut(cap)` requires that recording's admin cap, and the `ReleaseAuthorizationKey(release_id)` field lives on the recording that grants it. "Which releases has this recording authorized?" is a lookup on the recording, via `has_release_authorization(recording, release_id)`.
- **The recording admin authorizes the splits they saw.** If the release admin changed them in between, `authorize` aborts with `ESplitsChanged`.
- **Each track authorizes once.** Only this module writes the key, so the count is exact. This also relies on core: `miso_music::release::new` rejects a track list that names a recording twice, so the track count equals the number of distinct recordings. When the count reaches the track count, the license becomes `Authorized` and emits `ReleaseLicenseAuthorizedEvent`.

Each party can change their mind until someone else relies on them. The release admin can `set_splits` until the first recording authorizes. Each recording admin can `revoke` while the license is still `Authorizing`, which removes the field from their recording and reclaims its storage. Once every track has authorized, the license is `Authorized` permanently and no recording can revoke, which protects the release admin and the fans who bought it. If every authorizing recording revokes, the count returns to 0 and the splits can change again: nobody holds an authorization of the old ones.

`is_authorized(license)` reads the state, and `authorized_recording_count(license)` returns the count, or the track count once the license is `Authorized`. Core caps a release at 255 tracks.

## Forwarding Revenue

The start of `forward` (excerpt; the rest emits `ReleaseRevenueForwardedEvent` and sends any remainder to the license's address):

```move
public fun forward<Currency>(
    self: &ReleaseLicense,
    release: &Release,
    mut revenue: Balance<Currency>,
) {
    assert!(object::id(release) == self.release_id, EWrongRelease);
    if (revenue.value() == 0) return revenue.destroy_zero();
    let pool_addresses = royalty_pool::derive_release_recording_pool_addresses<Currency>(release);
    let total_value = revenue.value();
    let values = vector::tabulate!(pool_addresses.length(), |i| {
        let value = self.splits[i].apply(total_value);
        if (value > 0) {
            revenue.split(value).send_funds(pool_addresses[i])
        };
        value
    });
```

Track `i` receives `revenue × splits[i] ÷ 10,000`, rounded down and computed in `u128` by [`bps`](https://github.com/unconfirmedlabs/bps), sent to the canonical address of that recording's [royalty pool](/move/framework/royalty-pool/) in the same currency. A track whose amount rounds to zero is skipped. The funds wait at the pool address until the pool exists and has registered stakes; `royalty_pool::settle` folds them in. Rounding remainders go to the license's own address.

**Payment does not depend on authorization.** `forward` pays every track in any state, so money owed under the license always reaches the recordings. Whether a release may be *sold* is the distributor's check: [`record_sale`](/move/framework/record-sale/) refuses to sell unless `is_authorized` is true.

`forward` reads the license and the release immutably, so a sale can pass its payment straight to it and concurrent sales don't contend with each other. `redeem_and_forward`, `receive_and_forward`, `authorize`, and `revoke` take the license mutably and are sequenced with sales.

## Collecting at the License's Address

Payers that can't call `forward`, such as a wallet or a payout service, send to `derive_address(release)`, and the rounding remainder of every forward goes there too. Anyone can pay it out by the splits: `receive_and_forward(license, release, coins)` for coin objects sent there, and `redeem_and_forward(license, release, root, clock)` for accumulator funds. Each returns the value it forwarded. Each pass also re-splits earlier remainders and leaves fewer units than there are tracks; between passes, deposits and the remainders of further forwards build up at the address.

```move
public fun redeem_and_forward<Currency>(
    self: &mut ReleaseLicense,
    release: &Release,
    root: &AccumulatorRoot,
    clock: &Clock,
): u64 {
    assert!(object::id(release) == self.release_id, EWrongRelease);
    let now = clock.timestamp_ms();
    let key = ReleaseLicenseRedeemedAtKey<Currency>();
    if (df::exists(&self.id, key)) {
        let redeemed_at_ms = df::borrow_mut(&mut self.id, key);
        if (*redeemed_at_ms == now) return 0;
        *redeemed_at_ms = now;
    } else {
        df::add(&mut self.id, key, now);
    };
    let value = hikida::settled_balance_value<Currency>(&self.id, root);
    if (self.splits.all!(|split| (*split).apply(value) == 0)) return 0;
    let revenue = hikida::redeem_balance<Currency>(&mut self.id, value);
    forward(self, release, revenue);
    value
}
```

The settled snapshot is written only by the settlement system transaction, so it is constant for every transaction in a commit. Like `royalty_pool::settle`, `redeem_and_forward` therefore redeems at most once per currency per clock millisecond:

- **A stamp per currency.** A dynamic field `ReleaseLicenseRedeemedAtKey<Currency>()` on the license holds the time of the last call. A second call for the same `Currency` in the same transaction, or from another cranker in the same millisecond, returns 0 instead of withdrawing twice. One transaction can still redeem one currency and then another.
- **A snapshot too small to pay any track stays put.** The function returns 0 without redeeming, and the funds wait at the address until more arrive. The stamp is still written, so a second call in the same millisecond also returns 0.
- **Zero revenue sends and emits nothing.** This covers `forward` with an empty balance, `redeem_and_forward` on an empty snapshot, and an empty `receive_and_forward`.

`receive_and_forward` has no stamp; each coin can be received only once.

## Failure Cases

| Situation | Result |
| --- | --- |
| A second license for the same release | `new` aborts with `derived_object::EObjectAlreadyExists`. |
| A `ReleaseAdminCap` for another release | `new` aborts in `miso_music::release` with `EUnauthorized` (0). |
| Not exactly one split per track | `new` and `set_splits` abort with `EWrongSplitCount` (0). |
| Splits that don't total 10,000 | `new` and `set_splits` abort with `ESplitNotFull` (1). |
| A release other than the license's | `forward`, `redeem_and_forward`, `receive_and_forward`, and `authorize` abort with `EWrongRelease` (2). |
| A recording that is not on the track list | `authorize` aborts with `ERecordingNotFound` (3). |
| Revoking without an authorization | `revoke` aborts with `EAuthorizationNotFound` (4). |
| Revoking after the license is `Authorized` | `revoke` aborts with `ELicenseAlreadyAuthorized` (5). |
| `set_splits` after any recording has authorized | Aborts with `ESplitsLocked` (6). |
| `set_splits` with another release's cap | Aborts with `EUnauthorized` (7). |
| Authorizing twice | `authorize` aborts with `ERecordingAlreadyAuthorized` (8). |
| Splits that differ from the license's | `authorize` aborts with `ESplitsChanged` (9). |

`new` checks the splits before the cap. `authorize` and `revoke` take the recording cap through the core Recording's `uid_mut`, which binds the cap to the recording by its `RecordingShare` type rather than by a runtime check; core allows one Recording per share type. `set_splits` with the current splits changes nothing and emits no event.

## Events

| Event | Fields |
| --- | --- |
| `ReleaseLicenseCreatedEvent` | `release_id`, `license_id`, `splits_bps` (each split as its `u16` basis points) |
| `ReleaseLicenseSplitsSetEvent` | `release_id`, `license_id`, `splits_bps` |
| `ReleaseAuthorizationGrantedEvent` | `recording_id`, `release_id`, `license_id`, `splits_bps` (the splits the recording agreed to), `authorized_recording_count` (the count after the grant) |
| `ReleaseLicenseAuthorizedEvent` | `release_id`, `license_id`; once, when the last track authorizes |
| `ReleaseAuthorizationRevokedEvent` | `recording_id`, `release_id`, `license_id`, `authorized_recording_count` (the count after the revocation) |
| `ReleaseRevenueForwardedEvent<Currency>` | `release_id`, `license_id`, `values` (what each track received), `remainder` (what went back to the license's address); only when some track receives funds |

Every event carries the `license_id`, and the authorization events carry the resulting count, so an indexer can follow a license's state from its events alone.

## Deployment

`release_license` pins `miso_music` at `bc547c79`, `bps` at `4ca1972a`, and `hikida` at `e245b09f`, and depends on `royalty_pool` from the same repository by local path. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license/Published.toml) records one generation:

- **Mainnet** `published-at = "0x767a4ccea4c995b84124dd971e6bbc322db141cfe0d2fb4fcd8b36a6b1a707be"`, recorded after the last change to the package's sources and dependency pins, so it corresponds to the source on this page. Later commits changed only its README. `royalty_pool`'s mainnet generation was recorded before it, after that package's last source change.

No Testnet generation is recorded. The README states that the package has not had a third-party audit and points to formal verification evidence in [`misofm/audits`](https://github.com/misofm/audits). The 50 unit tests pass locally. The unit-test VM does not settle accumulators, so the tests check amounts through the forwarded event, up to a 255-track release; funds arriving at pool addresses, a funded `redeem_and_forward`, and gas at 255 tracks need an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license/sources/release_license.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/release_license/tests/release_license_tests.move).
