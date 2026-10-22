---
title: Royalty pools
description: Distribute a payout currency to registered holders of a work's share coin.
---

[`royalty_pool`](https://github.com/misofm/royalty-pool) turns a work's fixed-supply shares into a claim on a particular payout currency. `RoyaltyPool<Share, Currency>` is tied to one composition or recording and one `Currency`. The work's admin cap authorizes pool creation. The pool ID derives from the work and currency, so there is at most one canonical pool for that pair **within the package generation**.

A holder wraps a positive `Balance<Share>` in `Stake<Share>` and registers that stake with a matching pool. Deposits advance a cumulative per-share index; claims use the index and the stake's accounting position. The pool does not loop over holders on every deposit. A stake may register in multiple payout-currency pools, but only once in each.

## Integration sequence

1. Create the composition or recording's pool for each payout currency the product accepts, using `pool::new_for_composition` or `pool::new_for_recording` with the matching work and admin cap.
2. Create and register the initial stakes **before sharing the pool**, so incoming revenue has the intended recipients.
3. Route that payout currency to the pool's canonical address (`pool::derive_address<Currency>(work_id)`) or use the package's deposit API.
4. Call `pool::settle` with Sui's accumulator root and clock before claiming funds that arrived at the pool address. Then a holder with access to `&mut Stake` can claim.

Only registered shares participate in a pool's payouts. If no stake is registered, funds at the derived address wait; a positive direct deposit into an empty pool aborts. When a first stake registers, waiting funds can go to that registered set. This makes registration order a product concern. The package README explains settlement and rounding in detail.

A stake is a valuable bearer object. Anyone who gets mutable access to a stake can claim its royalties. Keep stakes address-owned or gate access in a wrapper. A recording license can hold the composition's recording-share stake and sweep its proceeds to the composition pool.

Pool accounting does not itself guarantee that sales or streams route revenue there. Use the relevant commerce or streaming package, and confirm its currency and revision match the pool you created.

Source: [royalty-pool README](https://github.com/misofm/royalty-pool/blob/main/README.md), [pool module](https://github.com/misofm/royalty-pool/blob/main/sources/pool.move), and [stake module](https://github.com/misofm/royalty-pool/blob/main/sources/stake.move).
