---
title: Royalty Grant
description: Lock a stake and pay a recipient part of its royalties in one currency until repaid or a term ends.
---

Assign part of a stake's royalties to someone else: recoup an off-chain advance, pay producer points, make a pledge. `royalty_grant` locks the stake, holds the grant pending until the recipient activates, splits each sweep, and returns the stake at the end.

## Locking a Stake for Someone Else

A studio paid in fiat for the recording costs of Whitney Houston's master of "I Will Always Love You". The rights holder creates a grant over the master's [royalty pool](/move/framework/royalty-pool/) stake: the studio as `recipient`, `recipient_share` of 10,000 basis points, `repayment_value` equal to the costs in the pool's currency. The studio activates. Every sweep pays the studio until repaid, then the rights holder takes the stake back.

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

Only the grant can unregister or claim its stake.

- `owner`, `recipient`: payout addresses.
- `Share`: the work's share type.
- `repaid_value`: recipient's progress toward `repayment_value`.
- `remainder`: rounding carried between sweeps.
- `duration_ms`: the term.
- `activated_at_ms`: none while pending.
- `ends_at_ms`: set at activation when there is a term, or by `waive`.

**A grant covers one currency.** The stake is registered only in the work's `Currency` pool, and `repayment_value` counts in `Currency`. The stake earns nothing in other-currency pools. Those royalties go to the other registered stakes.

Creating a grant moves no payment. For an on-chain advance use [`royalty_advance`](/move/framework/royalty-advance/): it pays the owner and creates an active grant in one transaction.

## Terms

```move
public struct RoyaltyGrantTerms has copy, drop, store {
    recipient_share: BPS,
    repayment_value: Option<u64>,
    duration_ms: Option<u64>,
}
```

`new_terms(recipient_share, repayment_value, duration_ms)` validates and returns the terms. An active grant ends at `repayment_value` paid or `duration_ms` since activation, whichever comes first.

| Scheme | `recipient_share` | `repayment_value` | `duration_ms` |
| --- | --- | --- | --- |
| Recoup: all royalties in `Currency` until the amount is repaid | 10,000 | some | none |
| Revenue share up to a cap | below 10,000 | some | none |
| Term: a share of royalties for a fixed time | any | none | some |
| Capped term: repaid or the term ends, whichever comes first | any | some | some |

Terms need `repayment_value` or `duration_ms`. With neither, the stake returns only if the recipient waives.

## Lifecycle

| State | Reached by | `sweep` pays the recipient | Owner cap | Recipient |
| --- | --- | --- | --- | --- |
| Pending | `new` | nothing | `cancel`, `set_owner` | `activate`, by signing as `recipient` |
| Active | `activate`, or `new_active` | `recipient_share`, until repaid or the term ends | `set_owner` | `waive`, `set_recipient` |
| Reclaimable | repaid, the term ended, waived, or bought out | nothing | `reclaim`, `set_owner` | `set_recipient` |

**A grant binds the owner only once active.** While pending, the owner keeps every royalty and can `cancel`, so a wrong `recipient` or one who never activates costs nothing. Once active, only the recipient can end it early with `waive`. Anyone can with `buyout` when there is a `repayment_value`.

`is_active(grant)` stays true after the grant becomes reclaimable.

## Two Roles, Two Caps

Both caps are `key, store`, carry the `grant_id`, and derive from the grant: at most one of each.

- **`RoyaltyGrantOwnerCap`**, at `derive_owner_cap_address(grant)`, is returned by `new`. It cancels a pending grant, changes the owner's payout address, and reclaims the stake after the end. `cancel` or `reclaim` consumes it with the grant. Nothing else destroys it.
- **`RoyaltyGrantRecipientCap`**, at `derive_recipient_cap_address(grant)`, does not exist while pending. `activate` returns it to the recipient. It changes the recipient's payout address and can waive. `destroy_recipient_cap` gives up those actions for good while payouts to the stored address continue. After `reclaim` the cap points to a deleted grant. Destroy it for the storage rebate.

Whoever holds a cap plays the role, so a Party, a [Vault](/move/framework/vault/), or any object can hold either. Transferring the cap moves the role, not the payout address: the new holder calls `set_owner` or `set_recipient`.

## Creating a Grant

`new` requires an **unregistered** stake (excerpt; the rest builds the owner cap, emits `RoyaltyGrantCreatedEvent`, and returns the pending grant and cap):

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

A registered stake carries earlier royalties that a post-activation sweep would split with the recipient. Unregister it from each pool first, which pays out what it earned. Then, in one programmable transaction:

1. Build the terms with `new_terms`.
2. Call `new` with the work's `Currency` pool. It registers the stake there only (no function registers it in another pool) and returns the pending grant and owner cap. No term runs.
3. Transfer the owner cap with `transfer::public_transfer` and call `share` on the grant.

## Activating

The recipient checks the grant, terms, and `recipient` address, then activates:

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

- **Only the `recipient` address can activate.** The sender must be `recipient`, proving it controls the address and accepted the grant.
- **Royalties earned while pending stay with the owner.** `activate` settles the pool and aborts while the stake has unswept royalties, so `sweep` then `activate` in one transaction. That sweep pays the owner everything.
- **The term starts at activation.** The private `start` records `activated_at_ms`, sets `ends_at_ms` to now plus `duration_ms` when there is a term (saturating at the largest `u64`, effectively never), emits `RoyaltyGrantActivatedEvent`, and returns the recipient cap.

An object recipient, such as a Party, cannot sign. Name a signer's address as `recipient`. In one transaction the signer activates, moves the cap to the object, and calls `set_recipient` with the object's address.

`new_active` is `new` plus activation, returning the grant and both caps. It does not check the sender. Use it only when the recipient supplied its own address, as in [`royalty_advance`](/move/framework/royalty-advance/), where the provider names its address in the offer.

## Sweeping Royalties

Anyone can call `sweep(grant, pool, root, clock)` with the grant's `Currency` pool. It settles the pool, claims the stake's royalties, splits them between the payout addresses, and returns the total swept. The recipient's part is chosen here (excerpt; the rest pays both and emits `RoyaltyGrantSweptEvent`):

```move
let now = clock.timestamp_ms();
let recipient_value = if (
    self.activated_at_ms.is_none() || self.ends_at_ms.is_some_and!(|ends_at_ms| now >= *ends_at_ms)
) 0 else self.accrue(value).min(self.remaining_value().destroy_or!(value));
if (self.repayment_value.is_some()) self.repaid_value = self.repaid_value + recipient_value;
let owner_value = value - recipient_value;
```

- **Pending, or once `now >= ends_at_ms`: the owner gets everything.**
- **Active: the recipient gets `recipient_share`, capped at `repayment_value - repaid_value`,** counted toward `repaid_value`. The owner gets the rest.
- **Rounding carries forward.** `accrue` keeps the remainder between sweeps, so the recipient's total is `recipient_share` of everything swept while active, rounded down once, however the sweeps were split. One sweep's `recipient_value` can exceed `recipient_share` of that sweep by one unit. Indexers read the split from `RoyaltyGrantSweptEvent`, never recompute it.

With nothing pending, `sweep` still settles the pool, returns 0, and emits no event. Payouts go only to the stored `owner` and `recipient`, with `send_funds`.

## Ending a Grant

`is_reclaimable(grant, clock)` is false while pending, and true once `repaid_value` equals `repayment_value` or `now >= ends_at_ms`. An active grant gets there three ways:

- **Sweeps.** Each adds the recipient's part to `repaid_value`.
- **`buyout(grant, payment, clock)`.** While active and not yet reclaimable, anyone can pay exactly the remaining value in `Currency`. It goes to the recipient, and `repaid_value` becomes `repayment_value`. The stake stays locked until reclaimed.
- **`waive(grant, recipient_cap, clock)`.** The recipient ends the term now. Later sweeps pay the owner.

`waive` cannot move a past end date or run twice:

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

The owner cap's holder then calls `reclaim(grant, owner_cap, clock)`, which deletes the grant and cap and returns the stake to the caller, not to the `owner` address. `cancel(grant, owner_cap)` does the same for a pending grant. Either way the stake keeps its `Currency` pool registration and pending royalties.

## Timing and Transfers

- **Sweep before changing the recipient.** `set_recipient` does not settle accrued royalties, so the new recipient gets those earned before the change. A recipient selling its position sweeps first, in the same transaction.
- **Sweep before the end.** Royalties accrued before `ends_at_ms` but swept after it go to the owner, as do those pending at `waive`. Royalties pending at `reclaim` leave with the stake. A recipient owed them sweeps first.
- **Off-chain payment: grant, activate, then pay.** A grant cannot prove off-chain payment. The owner creates the grant, the payer checks its terms and activates, and only then pays, because an active grant binds the owner. If the payer never pays, the stake stays locked until the term ends, the amount is repaid, or the payer waives. Use [`royalty_advance`](/move/framework/royalty-advance/) whenever payment can be on-chain. Use off-chain grants only between parties who trust each other.
- **Keep the owner cap.** Without it the grant can be neither cancelled nor reclaimed. The stake stays locked and sweeps keep paying `owner`. Hold it in a wallet, Party, or [Vault](/move/framework/vault/) you control.
- **Pool linkage.** A grant reaches only pools of the `royalty_pool` package it links. Link the `royalty_pool` the live pools come from.

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

`activate` checks `ENotPending` before the sender. `buyout` checks state before payment. `set_owner` and `set_recipient` with the current address change nothing and emit no event.

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

- `recipient` and `owner` in the swept and bought-out events are the addresses paid. Indexers need not replay `set_owner` and `set_recipient`.
- `new_active` emits `RoyaltyGrantCreatedEvent` and `RoyaltyGrantActivatedEvent` together.
- The stake's registration and claims also emit [`royalty_pool` events](/move/framework/royalty-pool/#events), keyed by the same `stake_id`.

## Deployment

`royalty_grant` depends on `royalty_pool` by local path and pins `bps` at `4ca1972a`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/Published.toml) records one generation:

- **Mainnet** `published-at = "0xd19ccfe528c8397c0bcf8a76e6113a13724dc2c4897f7893e2722bff975061ba"`, recorded after the last change to sources and dependencies, so it matches this source. `royalty_pool`'s mainnet generation, `0x155434bddf7ccc477e3a03676900b49b295a031230b5e19021cfa5b092a8bcbf`, was recorded before it and after that package's last source change.

No Testnet generation is recorded. The README states no third-party audit and points to formal verification evidence in [`misofm/audits`](https://github.com/misofm/audits). The 61 unit tests pass locally. The unit-test VM does not settle accumulator funds into pools, so settlement of funds sent to a pool's address needs an end-to-end test on a Sui network. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/sources/royalty_grant.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/royalty_grant/tests/royalty_grant_tests.move).
