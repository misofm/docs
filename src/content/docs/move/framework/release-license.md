---
title: Release Licenses
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

The license is derived from the Release, so each release has at most one, at `derive_address(release)`. `splits` has one basis-point value per track, in track-list order, totalling exactly 10,000. A split may be zero; that track receives nothing.

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

- **The authorization is written on the recording.** `uid_mut(cap)` requires that recording's admin cap, and the `ReleaseAuthorizationKey(release_id)` field lives on the recording that grants it. "Which releases has this recording authorized?" is a lookup on the recording, via `has_release_authorization`.
- **The recording admin authorizes the splits they saw.** If the release admin changed them in between, `authorize` aborts with `ESplitsChanged`.
- **Each track authorizes once.** Only this module writes the key, so the count is exact. When it reaches the track count, the license becomes `Authorized` and emits `ReleaseLicenseAuthorizedEvent`.

Each party can change their mind until someone else relies on them. The release admin can `set_splits` until the first recording authorizes. Each recording admin can `revoke` while the license is still `Authorizing`. Once every track has authorized, the license is `Authorized` permanently and no recording can revoke, which protects the release admin and the fans who bought it. If every authorizing recording revokes, the count returns to 0 and the splits can change again.

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

Track `i` receives `revenue × splits[i] ÷ 10,000`, rounded down, sent to the canonical address of that recording's [royalty pool](/move/framework/royalty-pool/) in the same currency. The funds wait there until the pool exists and has registered stakes; `royalty_pool::settle` folds them in. Rounding remainders go to the license's own address.

**Payment does not depend on authorization.** `forward` pays every track in any state, so money owed under the license always reaches the recordings. Whether a release may be *sold* is the distributor's check: [`record_shop`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/record_shop) refuses to sell unless `is_authorized` is true.

`forward` reads the license and the release immutably, so concurrent sales don't contend. Payers that can't call `forward`, such as a wallet or a payout service, send to `derive_address(release)`. Anyone can then call `redeem_and_forward(license, release, root, clock)` for funds sent there, or `receive_and_forward(license, release, coins)` for coin objects, to pay them out by the splits. Each pass also re-splits earlier remainders. Like `royalty_pool::settle`, `redeem_and_forward` redeems at most once per currency per clock millisecond and returns 0 otherwise.

## Failure Cases

| Situation | Result |
| --- | --- |
| A second license for the same release | `new` aborts with `derived_object::EObjectAlreadyExists`. |
| Not exactly one split per track | Aborts with `EWrongSplitCount` (0). |
| Splits that don't total 10,000 | Aborts with `ESplitNotFull` (1). |
| A release other than the license's | `forward`, `redeem_and_forward`, `receive_and_forward`, and `authorize` abort with `EWrongRelease` (2). |
| A recording that is not on the track list | `authorize` aborts with `ERecordingNotFound` (3). |
| Revoking without an authorization | Aborts with `EAuthorizationNotFound` (4). |
| Revoking after the license is `Authorized` | Aborts with `ELicenseAlreadyAuthorized` (5). |
| `set_splits` after any recording has authorized | Aborts with `ESplitsLocked` (6). |
| `set_splits` with another release's cap | Aborts with `EUnauthorized` (7). |
| Authorizing twice | Aborts with `ERecordingAlreadyAuthorized` (8). |
| Splits that differ from the license's | `authorize` aborts with `ESplitsChanged` (9). |

`authorize` and `revoke` check the recording cap first, through the core's `uid_mut`.

## Events

| Event | Fields |
| --- | --- |
| `ReleaseLicenseCreatedEvent` | `release_id`, `license_id`, `splits_bps` |
| `ReleaseLicenseSplitsSetEvent` | `release_id`, `license_id`, `splits_bps` |
| `ReleaseAuthorizationGrantedEvent` | `recording_id`, `release_id`, `splits_bps` |
| `ReleaseLicenseAuthorizedEvent` | `release_id`, `license_id`, once, when the last track authorizes |
| `ReleaseAuthorizationRevokedEvent` | `recording_id`, `release_id` |
| `ReleaseRevenueForwardedEvent<Currency>` | `release_id`, `values` (per track), `remainder`, only when some track receives funds |

## Deployment

The package README states that it has not been audited, and at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` it records no deployed generation. The unit tests check amounts through the forwarded event; funds arriving at pool addresses and a funded `redeem_and_forward` need an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license/sources/release_license.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/release_license/tests/release_license_tests.move).
