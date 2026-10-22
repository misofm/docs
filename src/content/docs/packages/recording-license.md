---
title: Recording Licenses
description: A composition's optional standing policy for licensing recordings and routing its share of revenue.
---

The core `Recording` points to a `Composition`, but that link alone grants no license. [`recording_license`](https://github.com/misofm/recording-license) provides an optional standing policy: the composition admin publishes a `RecordingLicensePolicy` with a rate in basis points, and a recording admin may accept it by transferring the exact required amount of recording shares.

The rate can range from 0 to 10,000 BPS in the current source. `issue` checks the supplied cut against the recording currency's fixed supply and the policy's current rate. A rate change affects future licenses; an already issued license retains its terms. The license holds a `Stake<RecordingShare>` for the composition's cut and records the licensed recording on the policy. A composition without a policy has not opted in, although the core still permits a recording to reference it.

## Revenue path

```text
Recording revenue → recording pool → composition's recording-share stake
                                         ↓ sweep
                       composition pool → composition-share stakes
```

For each payout currency, the composition and recording need matching canonical royalty pools. Register the license's stake in the recording pool **before revenue arrives**. `sweep` claims that stake's recording royalties and sends them to the composition pool address; `pool::settle` then credits registered composition-share stakes. `sweep` does not settle the recording pool first, so call `pool::settle` before sweeping if you need the latest arrived funds.

The composition admin can withdraw its stake for migration. This makes the admin cap a trust-bearing object for composition shareholders. Opening pools, routing revenue, custody of the stake, and settling are separate responsibilities; license issuance alone does not distribute income.

The license rate covers the composition's agreed share of revenue through this route. The package README calls out revenue categories handled elsewhere, such as sync and live performance, and warns against taking the cut again where the composition is already separately paid.

Pin the license package's exact commit and check its `Move.toml` for the supported core and pool revisions. Its current source may be newer than an immutable deployed package generation.

Source: [recording-license README](https://github.com/misofm/recording-license/blob/main/README.md) and [Move source](https://github.com/misofm/recording-license/blob/main/sources/recording_license.move).
