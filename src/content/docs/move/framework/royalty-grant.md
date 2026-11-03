---
title: Royalty Grants
description: Lock a stake and pay part of its royalties to a recipient until an amount is repaid or a term ends, then return the stake.
---

This page is for developers who let a rights holder assign part of a stake's royalties to someone else, such as to recoup an off-chain advance, pay producer points, or make a pledge. It explains how `royalty_grant` locks the stake, how each sweep is split, and when the stake comes back.

## Locking a Stake for Someone Else

Suppose a studio paid the recording costs for Whitney Houston's master of "I Will Always Love You" in fiat. The recording's rights holder holds its shares as a [royalty pool](/move/framework/royalty-pool/) stake. To repay the studio from royalties, the rights holder creates a grant over that stake, with the studio as recipient, a `recipient_share` of 10,000 basis points, and a `repayment_value` equal to the costs in the pool's currency. Every sweep pays the stake's royalties to the studio until the costs are repaid; then the rights holder takes the stake back.

```move
public struct RoyaltyGrant<phantom Share, phantom Currency> has key {
    id: UID,
    stake: RoyaltyPoolStake<Share>,
    owner: address,
    recipient: address,
    recipient_share: BPS,
    repayment_value: Option<u64>,
    repaid_value: u64,
    remainders: VecMap<TypeName, u64>,
    ends_at_ms: Option<u64>,
}
```

The grant holds the stake itself, so nobody can unregister or claim it except through the grant. `owner` and `recipient` are the two payout addresses. `Share` is the work's share type, and `Currency` is the currency `repayment_value` is counted in. A grant with no `repayment_value` still names a `Currency`; it only selects the pool `new` registers the stake in. `repaid_value` tracks the recipient's progress, and `remainders` holds per-currency rounding.

No payment moves when a grant is created. An advance paid on-chain uses [`royalty_advance`](/move/framework/royalty-advance/), which pays the owner and creates the grant in one transaction.

## Terms

```move
public struct RoyaltyGrantTerms has copy, drop, store {
    recipient_share: BPS,
    repayment_value: Option<u64>,
    duration_ms: Option<u64>,
}
```

`new_terms(recipient_share, repayment_value, duration_ms)` checks and returns the terms. A grant ends when the recipient has been paid `repayment_value`, when `duration_ms` has passed since creation, or at whichever comes first when both are set. The terms cover the common schemes:

| Scheme | `recipient_share` | `repayment_value` | `duration_ms` |
| --- | --- | --- | --- |
| Recoup: all royalties in `Currency` until the amount is repaid | 10,000 | some | none |
| Revenue share up to a cap | below 10,000 | some | none |
| Term: a share of royalties for a fixed time | any | none | some |
| Capped term: repaid or the term ends, whichever comes first | any | some | some |

Terms need at least one of `repayment_value` and `duration_ms`. Without either, the stake could only come back if the recipient waived the grant.

## Two Roles, Two Caps

`new` derives two capabilities from the grant. Each is `key, store` and carries the `grant_id`:

- **`RoyaltyGrantOwnerCap`**, returned to the caller, changes the owner's payout address and reclaims the stake once the grant ends. `reclaim` consumes it; it cannot otherwise be destroyed.
- **`RoyaltyGrantRecipientCap`** is sent straight to the `recipient` address, so the caller never holds it. It changes the recipient's payout address and can waive the grant. Its holder can destroy it at any time, giving up those actions for good while payouts to the stored address continue.

Holding a cap is what lets its holder act for that role, so a Party, a vault, or any object that can receive the cap can play either role, and transferring the cap moves the role. The payout address is separate: the new holder changes it with `set_owner` or `set_recipient`. An object named as recipient can use its cap only if its module can receive objects sent to its address.

**The owner cannot end a grant early.** Only the recipient can, with `waive`, or anyone can with `buyout` when there is a `repayment_value`. That is what makes the grant binding on the owner.

## Creating a Grant

`new(pool, stake, owner, recipient, terms, root, clock, ctx)` requires an **unregistered** stake. A registered stake carries royalties it earned before the grant, and the first sweep would split them with the recipient. The rights holder unregisters the stake from each of its pools, which pays out what it has earned, then in the same programmable transaction:

1. Build the terms with `new_terms`.
2. Call `new` with the `Currency` pool. It registers the stake there, sends the recipient cap to `recipient`, emits `RoyaltyGrantCreatedEvent`, and returns the grant with its owner cap. The term starts now.
3. Call `register` for each other currency pool the stake should earn from.
4. Transfer the owner cap and call `share` on the grant.

A `duration_ms` that would end after the largest `u64` timestamp ends there instead, which is effectively never.

## Sweeping Royalties

Anyone can call `sweep(grant, pool, root, clock)`. It settles the pool, claims the stake's royalties, and splits them between the two payout addresses. How the recipient's part is chosen (excerpt; the rest pays both addresses and emits `RoyaltyGrantSweptEvent`):

```move
let now = clock.timestamp_ms();
let currency = type_name::with_defining_ids<PoolCurrency>();
let recipient_value = if (self.ends_at_ms.is_some_and!(|ends_at_ms| now >= *ends_at_ms)) 0
else if (self.repayment_value.is_none()) self.accrue(currency, value)
else if (currency == type_name::with_defining_ids<Currency>()) {
    let remaining_value = *self.repayment_value.borrow() - self.repaid_value;
    let recipient_value = self.accrue(currency, value).min(remaining_value);
    self.repaid_value = self.repaid_value + recipient_value;
    recipient_value
} else 0;
let owner_value = value - recipient_value;
```

The excerpt shows four rules:

- **After the term, the owner gets everything.** Once `now >= ends_at_ms`, the recipient's part is 0.
- **Without a `repayment_value`, the share applies in every currency.** `accrue` takes `recipient_share` of the swept value.
- **With a `repayment_value`, only `Currency` counts.** The recipient's part is capped at what remains to be repaid, and royalties in any other currency go wholly to the owner, with or without a term. An advance is repaid in the currency it was paid in.
- **Rounding carries forward.** `accrue` keeps the rounding remainder per pool currency, so the recipient's total is `recipient_share` of everything swept, rounded down once, however the royalties were split into sweeps. One sweep's `recipient_value` can therefore exceed `recipient_share` of that sweep by one unit. Indexers should take the split from `RoyaltyGrantSweptEvent` rather than recompute it.

The currency check runs at runtime, comparing `type_name::with_defining_ids` of the two types. A separate function for other currencies would let anyone sweep `Currency` through it and skip repayment.

`sweep` returns 0 when the stake is not registered in that pool. When the stake has nothing pending, it still settles the pool, returns 0, and emits no event. Payouts go only to the stored `owner` and `recipient` addresses.

## Ending a Grant

`is_reclaimable(grant, clock)` is true once `repaid_value` equals `repayment_value` or once the term has ended. Three operations get a grant there:

- **Repayment through sweeps.** Each sweep in `Currency` adds to `repaid_value`.
- **`buyout(grant, payment)`.** Anyone can pay exactly `remaining_value` in `Currency`. The payment goes to the recipient, and the grant becomes reclaimable. `buyout` does not check the term: after the term ends the grant is already reclaimable and `buyout` would still pay the recipient, so check `is_reclaimable` first.
- **`waive(grant, recipient_cap, clock)`.** The recipient ends the term now. Later sweeps pay the owner.

Then the owner cap's holder calls `reclaim(grant, owner_cap, clock)`, which deletes the grant and the cap and returns the stake to the caller, not to the `owner` payout address. The stake keeps its pool registrations and any pending royalties.

## Timing and Transfers

- **Sweep before changing the recipient.** `set_recipient` does not settle what has accrued, so the new recipient receives royalties earned before the change. A recipient selling its position should sweep every pool in the same transaction, before `set_recipient`.
- **Sweep before the end.** Royalties that accrue before `ends_at_ms` but are swept after it go to the owner, and so do those pending at `waive`. Royalties still pending at `reclaim` leave with the stake. A recipient owed them should sweep first.
- **Grant first, then pay off-chain.** A grant cannot prove that an off-chain payment was made, and a payer cannot make an artist create a grant after being paid. The safe order is for the artist to create the grant first. The payer checks that it is shared, that `recipient` is theirs, and that they hold the recipient cap at `derive_recipient_cap_address`, then pays. If the payer never pays, the stake stays locked until the term ends, the amount is repaid, or the payer waives. Use [`royalty_advance`](/move/framework/royalty-advance/) whenever the payment can be on-chain.

## Failure Cases

| Situation | Result |
| --- | --- |
| A zero `recipient_share` | `new_terms` aborts with `EZeroRecipientShare` (0). |
| A `repayment_value` of 0 | `new_terms` aborts with `EZeroRepaymentValue` (1). |
| A `duration_ms` of 0 | `new_terms` aborts with `EZeroDuration` (2). |
| Neither `repayment_value` nor `duration_ms` | `new_terms` aborts with `ENoTerms` (3). |
| A stake registered in any pool | `new` aborts with `EStakeRegistered` (4). |
| Another grant's cap | `reclaim`, `waive`, `set_owner`, and `set_recipient` abort with `EUnauthorized` (5). |
| Reclaiming before the grant is reclaimable | `reclaim` aborts with `ENotReclaimable` (6). |
| `buyout` on a grant with no `repayment_value` | Aborts with `ENoRepaymentValue` (7). |
| A `buyout` payment other than `remaining_value` | Aborts with `EWrongBuyout` (8). |

`set_owner` and `set_recipient` with the current address change nothing and emit no event.

## Events

| Event | Fields |
| --- | --- |
| `RoyaltyGrantCreatedEvent<Share, Currency>` | `grant_id`, `stake_id`, `pool_id`, `shares`, `owner`, `recipient`, `recipient_share_bps`, `repayment_value`, `ends_at_ms` |
| `RoyaltyGrantSweptEvent<PoolCurrency>` | `grant_id`, `pool_id`, `recipient_value`, `owner_value`, `repaid_value` (the total after the sweep); only when a sweep pays anything |
| `RoyaltyGrantBoughtOutEvent` | `grant_id`, `value` |
| `RoyaltyGrantReclaimedEvent` | `grant_id`, `stake_id` |
| `RoyaltyGrantWaivedEvent` | `grant_id`, `ends_at_ms` |
| `RoyaltyGrantOwnerSetEvent` | `grant_id`, `owner` |
| `RoyaltyGrantRecipientSetEvent` | `grant_id`, `recipient` |

The stake's registrations and claims also emit the [`royalty_pool` events](/move/framework/royalty-pool/#events), keyed by the same `stake_id`.

## Deployment

The package README states that it has not been audited, and at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` it records no deployed generation. A grant reaches only pools of the `royalty_pool` package it links, so a published grant package must link the same `royalty_pool` the live pools come from. The 51 unit tests pass locally; the unit-test VM does not settle accumulator funds into pools, so settlement of funds sent to a pool's address needs an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant/sources/royalty_grant.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/royalty_grant/tests/royalty_grant_tests.move).
