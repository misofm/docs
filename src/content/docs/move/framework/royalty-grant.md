---
title: Royalty Grant
description: Lock a stake and, once the recipient activates the grant, pay part of its royalties in one currency to that recipient until an amount is repaid or a term ends, then return the stake.
---

This page is for developers who let a rights holder assign part of a stake's royalties to someone else, such as to recoup an off-chain advance, pay producer points, or make a pledge. It explains how `royalty_grant` locks the stake, why a grant starts pending until the recipient activates it, how each sweep is split, and when the stake comes back.

## Locking a Stake for Someone Else

Suppose a studio paid the recording costs for Whitney Houston's master of "I Will Always Love You" in fiat. The recording's rights holder holds its shares as a [royalty pool](/move/framework/royalty-pool/) stake. To repay the studio from royalties, the rights holder creates a grant over that stake, with the studio's address as recipient, a `recipient_share` of 10,000 basis points, and a `repayment_value` equal to the costs in the pool's currency. The studio activates the grant from that address. From then on, every sweep pays the stake's royalties to the studio until the costs are repaid; then the rights holder takes the stake back.

```move
public struct RoyaltyGrant<phantom Share, phantom Currency> has key {
    id: UID,
    stake: RoyaltyPoolStake<Share>,
    owner: address,
    recipient: address,
    recipient_share: BPS,
    repayment_value: Option<u64>,
    repaid_value: u64,
    remainder: u64,
    duration_ms: Option<u64>,
    activated_at_ms: Option<u64>,
    ends_at_ms: Option<u64>,
}
```

The grant holds the stake itself, so nobody can unregister or claim it except through the grant. `owner` and `recipient` are the two payout addresses. `Share` is the work's share type.

**A grant covers one currency.** `Currency` is the only currency the grant shares: the stake is registered only in the work's `Currency` pool, and `repayment_value` is counted in it. While the grant holds the stake, the stake earns nothing in the work's pools in other currencies, and those royalties go to the work's other registered stakes.

`repaid_value` tracks the recipient's progress toward `repayment_value`, and `remainder` carries rounding between sweeps. `duration_ms` is the term from the terms. `activated_at_ms` is none while the grant is pending, and `ends_at_ms` is set at activation when the grant has a term, or by `waive`.

No payment moves when a grant is created. An advance paid on-chain uses [`royalty_advance`](/move/framework/royalty-advance/), which pays the owner and creates an already active grant in one transaction.

## Terms

```move
public struct RoyaltyGrantTerms has copy, drop, store {
    recipient_share: BPS,
    repayment_value: Option<u64>,
    duration_ms: Option<u64>,
}
```

`new_terms(recipient_share, repayment_value, duration_ms)` checks and returns the terms. Once the grant is active, it ends when the recipient has been paid `repayment_value`, when `duration_ms` has passed since activation, or at whichever comes first when both are set. The terms cover the common schemes:

| Scheme | `recipient_share` | `repayment_value` | `duration_ms` |
| --- | --- | --- | --- |
| Recoup: all royalties in `Currency` until the amount is repaid | 10,000 | some | none |
| Revenue share up to a cap | below 10,000 | some | none |
| Term: a share of royalties for a fixed time | any | none | some |
| Capped term: repaid or the term ends, whichever comes first | any | some | some |

Terms need at least one of `repayment_value` and `duration_ms`. Without either, the stake could only come back if the recipient waived the grant.

## Lifecycle

| State | Reached by | `sweep` pays the recipient | Owner cap | Recipient |
| --- | --- | --- | --- | --- |
| Pending | `new` | nothing | `cancel`, `set_owner` | `activate`, by signing as `recipient` |
| Active | `activate`, or `new_active` | `recipient_share`, until repaid or the term ends | `set_owner` | `waive`, `set_recipient` |
| Reclaimable | repaid, the term ended, waived, or bought out | nothing | `reclaim`, `set_owner` | `set_recipient` |

**A grant binds the owner only once it is active.** Until then the owner can cancel it, so a wrong `recipient` address, or a recipient who never activates, costs the owner nothing: the owner keeps every royalty while the grant is pending and takes the stake back with `cancel`. Once the grant is active, the owner cannot end it early. Only the recipient can, with `waive`, or anyone can with `buyout` when there is a `repayment_value`.

`is_active(grant)` is true once the grant has been activated, and stays true after the grant becomes reclaimable.

## Two Roles, Two Caps

Each role has a capability. Both are `key, store`, carry the `grant_id`, and are derived from the grant, so each grant has at most one of each:

- **`RoyaltyGrantOwnerCap`**, at `derive_owner_cap_address(grant)`, is returned by `new`. It cancels a pending grant, changes the owner's payout address, and reclaims the stake once the grant ends. `cancel` or `reclaim` consumes it together with the grant; it cannot otherwise be destroyed.
- **`RoyaltyGrantRecipientCap`**, at `derive_recipient_cap_address(grant)`, does not exist while the grant is pending. `activate` returns it to the recipient. It changes the recipient's payout address and can waive the grant. Its holder can destroy it with `destroy_recipient_cap` at any time, giving up those actions for good while payouts to the stored address continue. After `reclaim` it refers to a deleted grant, and its holder destroys it to get the storage rebate.

Holding a cap is what lets its holder act for that role, so a Party, a [Vault](/move/framework/vault/), or any object that can hold the cap can play either role, and transferring the cap moves the role. The payout address is separate: the new holder changes it with `set_owner` or `set_recipient`.

## Creating a Grant

`new` requires an **unregistered** stake (excerpt; the rest builds the owner cap, emits `RoyaltyGrantCreatedEvent`, and returns the pending grant with that cap):

```move
public fun new<Share, Currency>(
    pool: &mut RoyaltyPool<Share, Currency>,
    mut stake: RoyaltyPoolStake<Share>,
    owner: address,
    recipient: address,
    terms: RoyaltyGrantTerms,
    root: &AccumulatorRoot,
    clock: &Clock,
    ctx: &mut TxContext,
): (RoyaltyGrant<Share, Currency>, RoyaltyGrantOwnerCap) {
    assert!(stake.pool_ids().is_empty(), EStakeRegistered);
    pool.register_stake(&mut stake, root, clock);
```

A registered stake carries royalties it earned before the grant, and a sweep after activation would split them with the recipient. The rights holder unregisters the stake from each of its pools, which pays out what it has earned, then in the same programmable transaction:

1. Builds the terms with `new_terms`.
2. Calls `new` with the work's `Currency` pool. It registers the stake there and nowhere else, and returns the pending grant with its owner cap. No term runs yet.
3. Transfers the owner cap with `transfer::public_transfer` and calls `share` on the grant.

The package has no function to register the grant's stake in another pool.

## Activating

The recipient checks the grant, its terms, and its `recipient` address, then activates it:

```move
public fun activate<Share, Currency>(
    self: &mut RoyaltyGrant<Share, Currency>,
    pool: &mut RoyaltyPool<Share, Currency>,
    root: &AccumulatorRoot,
    clock: &Clock,
    ctx: &mut TxContext,
): RoyaltyGrantRecipientCap {
    assert!(self.activated_at_ms.is_none(), ENotPending);
    assert!(ctx.sender() == self.recipient, ENotRecipient);
    pool.settle(root, clock);
    assert!(pool.pending_royalties(&self.stake) == 0, EPendingRoyalties);
    self.start(clock)
}
```

The function shows three rules:

- **Only the `recipient` address can activate.** The transaction's sender must be `recipient`, which proves the recipient controls that address and accepted the grant.
- **Royalties earned while pending stay with the owner.** `activate` settles the pool and aborts while the stake has unswept royalties. The recipient calls `sweep` and then `activate` in one programmable transaction; that sweep pays the owner everything.
- **The term starts at activation.** The private `start` records `activated_at_ms`, sets `ends_at_ms` to now plus `duration_ms` when there is a term, emits `RoyaltyGrantActivatedEvent`, and returns the recipient cap. An end past the largest `u64` timestamp saturates there, which is effectively never.

A recipient that is an object, such as a Party, cannot sign. Its grant names a signer's address as `recipient`; that signer activates, then moves the cap to the object and calls `set_recipient` with the object's address in the same transaction.

`new_active` is `new` followed by activation in one call, and returns the grant with both caps. It does not check the sender: it is for callers whose `recipient` address the recipient supplied themselves, such as [`royalty_advance`](/move/framework/royalty-advance/), where the provider names its own address in the offer.

## Sweeping Royalties

Anyone can call `sweep(grant, pool, root, clock)` with the grant's `Currency` pool. It settles the pool, claims the stake's royalties, splits them between the two payout addresses, and returns the total value swept. How the recipient's part is chosen (excerpt; the rest pays both addresses and emits `RoyaltyGrantSweptEvent`):

```move
let now = clock.timestamp_ms();
let recipient_value = if (
    self.activated_at_ms.is_none() || self.ends_at_ms.is_some_and!(|ends_at_ms| now >= *ends_at_ms)
) 0 else self.accrue(value).min(self.remaining_value().destroy_or!(value));
if (self.repayment_value.is_some()) self.repaid_value = self.repaid_value + recipient_value;
let owner_value = value - recipient_value;
```

The excerpt shows four rules:

- **While the grant is pending, the owner gets everything.**
- **After the term, the owner gets everything.** Once `now >= ends_at_ms`, the recipient's part is 0.
- **While active, the recipient gets `recipient_share`, capped at what remains to be repaid.** With a `repayment_value`, the recipient's part never exceeds `repayment_value - repaid_value`, and it counts toward `repaid_value`. The owner gets the rest.
- **Rounding carries forward.** `accrue` keeps the rounding remainder between sweeps, so the recipient's total is `recipient_share` of everything swept while active, rounded down once, however the royalties were split into sweeps. One sweep's `recipient_value` can therefore exceed `recipient_share` of that sweep by one unit. Indexers should take the split from `RoyaltyGrantSweptEvent` rather than recompute it.

When the stake has nothing pending, `sweep` still settles the pool, returns 0, and emits no event. Payouts go only to the stored `owner` and `recipient` addresses, with `send_funds`.

## Ending a Grant

`is_reclaimable(grant, clock)` is false while the grant is pending, and true once `repaid_value` equals `repayment_value` or once `now >= ends_at_ms`, whichever comes first. An active grant gets there in one of three ways:

- **Repayment through sweeps.** Each sweep adds the recipient's part to `repaid_value`.
- **`buyout(grant, payment, clock)`.** While the grant is active and not yet reclaimable, anyone can pay exactly the remaining value in `Currency`. The payment goes to the recipient, and `repaid_value` becomes `repayment_value`. The stake stays locked until it is reclaimed.
- **`waive(grant, recipient_cap, clock)`.** The recipient ends the term now. Later sweeps pay the owner.

`waive` is guarded so it cannot move an end date that has already passed or run twice:

```move
public fun waive<Share, Currency>(
    self: &mut RoyaltyGrant<Share, Currency>,
    cap: &RoyaltyGrantRecipientCap,
    clock: &Clock,
) {
    let grant_id = object::id(self);
    assert!(cap.grant_id == grant_id, EUnauthorized);
    assert!(!self.is_reclaimable(clock), EAlreadyReclaimable);
    let ends_at_ms = clock.timestamp_ms();
    self.ends_at_ms = option::some(ends_at_ms);
    emit(RoyaltyGrantWaivedEvent { grant_id, ends_at_ms });
}
```

Then the owner cap's holder calls `reclaim(grant, owner_cap, clock)`, which deletes the grant and the cap and returns the stake to the caller, not to the `owner` payout address. A pending grant is ended with `cancel(grant, owner_cap)` instead, which does the same without waiting for the grant to become reclaimable. Either way, the stake keeps its `Currency` pool registration and any pending royalties.

## Timing and Transfers

- **Sweep before changing the recipient.** `set_recipient` does not settle what has accrued, so the new recipient receives royalties earned before the change. A recipient selling its position should sweep in the same transaction, before `set_recipient`.
- **Sweep before the end.** Royalties that accrue before `ends_at_ms` but are swept after it go to the owner, and so do those pending at `waive`. Royalties still pending at `reclaim` leave with the stake. A recipient owed them should sweep first.
- **Grant, activate, then pay off-chain.** A grant cannot prove that an off-chain payment was made. The safe order is for the owner to create the grant, for the payer to check its terms and activate it, and only then to pay: once active, the grant binds the owner. If the payer never pays, the stake stays locked until the term ends, the amount is repaid, or the payer waives. Use [`royalty_advance`](/move/framework/royalty-advance/) whenever the payment can be on-chain, and off-chain grants only between parties who trust each other.
- **Keep the owner cap.** Without it a grant can be neither cancelled nor reclaimed, so the stake stays locked and later sweeps keep paying the `owner` address. Keep the cap in a wallet, Party, or [Vault](/move/framework/vault/) you control.
- **Pool linkage.** A grant reaches only pools of the `royalty_pool` package it links, so a published grant package must link the same `royalty_pool` the live pools come from.

## Failure Cases

| Situation | Result |
| --- | --- |
| A zero `recipient_share` | `new_terms` aborts with `EZeroRecipientShare` (0). |
| A `repayment_value` of 0 | `new_terms` aborts with `EZeroRepaymentValue` (1). |
| A `duration_ms` of 0 | `new_terms` aborts with `EZeroDuration` (2). |
| Neither `repayment_value` nor `duration_ms` | `new_terms` aborts with `ENoTerms` (3). |
| A stake registered in any pool | `new` and `new_active` abort with `EStakeRegistered` (4). |
| Another grant's cap | `cancel`, `reclaim`, `waive`, `set_owner`, and `set_recipient` abort with `EUnauthorized` (5). |
| Reclaiming a grant that is not reclaimable, including a pending one | `reclaim` aborts with `ENotReclaimable` (6). |
| `buyout` on a grant with no `repayment_value` | Aborts with `ENoRepaymentValue` (7). |
| A `buyout` payment other than the remaining value | Aborts with `EWrongBuyout` (8). |
| `buyout` or `waive` once the grant is reclaimable | Aborts with `EAlreadyReclaimable` (9). |
| `activate` or `cancel` on an active grant | Aborts with `ENotPending` (10). |
| `buyout` on a pending grant | Aborts with `ENotActive` (11). |
| `activate` from any sender other than `recipient` | Aborts with `ENotRecipient` (12). |
| `activate` while the stake has unswept royalties | Aborts with `EPendingRoyalties` (13). |

`activate` checks `ENotPending` before the sender, and `buyout` checks the grant's state before the payment. `set_owner` and `set_recipient` with the current address change nothing and emit no event.

## Events

| Event | Fields |
| --- | --- |
| `RoyaltyGrantCreatedEvent<Share, Currency>` | `grant_id`, `stake_id`, `pool_id`, `shares`, `owner`, `recipient`, `recipient_share_bps`, `repayment_value`, `duration_ms` |
| `RoyaltyGrantActivatedEvent` | `grant_id`, `recipient`, `activated_at_ms`, `ends_at_ms` |
| `RoyaltyGrantSweptEvent<Currency>` | `grant_id`, `pool_id`, `recipient`, `recipient_value`, `owner`, `owner_value`, `repaid_value` (the total after the sweep); only when a sweep pays anything |
| `RoyaltyGrantBoughtOutEvent` | `grant_id`, `recipient`, `value` |
| `RoyaltyGrantCancelledEvent` | `grant_id`, `stake_id` |
| `RoyaltyGrantReclaimedEvent` | `grant_id`, `stake_id` |
| `RoyaltyGrantWaivedEvent` | `grant_id`, `ends_at_ms` |
| `RoyaltyGrantOwnerSetEvent` | `grant_id`, `owner` |
| `RoyaltyGrantRecipientSetEvent` | `grant_id`, `recipient` |

The `recipient` and `owner` fields of the swept and bought-out events are the addresses actually paid, so an indexer does not need to replay earlier `set_owner` and `set_recipient` calls to attribute a payout. `new_active` emits `RoyaltyGrantCreatedEvent` and `RoyaltyGrantActivatedEvent` together. The stake's registration and claims also emit the [`royalty_pool` events](/move/framework/royalty-pool/#events), keyed by the same `stake_id`.

## Deployment

`royalty_grant` depends on `royalty_pool` from the same repository by local path and pins `bps` at `4ca1972a`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/Published.toml) records one generation:

- **Mainnet** `published-at = "0xd19ccfe528c8397c0bcf8a76e6113a13724dc2c4897f7893e2722bff975061ba"`, recorded after the last change to the package's sources and dependencies, so it corresponds to the source on this page. `royalty_pool`'s own mainnet generation, `0x155434bddf7ccc477e3a03676900b49b295a031230b5e19021cfa5b092a8bcbf`, was recorded before it and after that package's last source change.

No Testnet generation is recorded. The README states that the package has not had a third-party audit and points to formal verification evidence in [`misofm/audits`](https://github.com/misofm/audits). The 61 unit tests pass locally; the unit-test VM does not settle accumulator funds into pools, so settlement of funds sent to a pool's address needs an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/sources/royalty_grant.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/tests/royalty_grant_tests.move).
