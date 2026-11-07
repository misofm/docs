---
title: Party Wallet
description: Take objects, coins, and accumulator funds sent to a Party's address, using the Party's admin capability.
---

`party_wallet` collects what others sent to a Party's address, using the `PartyAdminCap`, and returns it to the caller. It is an [Action](/move/framework/#actions-and-plugins): it takes the raw capability, stores no data, and composes with other calls or a [Vault](/move/framework/vault/).

## A Party's Two Inboxes

A [Party](/move/party-protocol/) is a shared object whose ID is also an address that can receive assets. If Whitney Houston's Party is the recipient of a [royalty grant](/move/framework/royalty-grant/), the grant sends it a `RoyaltyGrantRecipientCap` as an object and every sweep sends royalties as accumulator funds. Neither is usable where it lands. The `PartyAdminCap` holder takes both out:

- **Objects** sent with `transfer::public_transfer`, including `Coin<T>` objects, are received by ticket with `receive` or `receive_balance`.
- **Funds** sent with `balance::send_funds` accumulate at the address and are withdrawn by value with `redeem_balance`.

```move
public fun inbox_address(party: &Party): address {
    object::id(party).to_address()
}
```

Only `key + store` objects can be received. An object without `store` sent to a Party's address is unrecoverable through this package.

## Receiving Objects

```move
public fun receive<Item: key + store>(
    party: &mut Party,
    cap: &PartyAdminCap,
    object_to_receive: Receiving<Item>,
): Item {
    let party_id = object::id(party);
    let received = transfer::public_receive(party.uid_mut(cap), object_to_receive);
    emit(PartyObjectReceivedEvent<Item> { party_id, object_id: object::id(&received) });
    received
}
```

Every operation follows this pattern:

- Authorization is the core `uid_mut(cap)`, which aborts unless the cap belongs to this Party. `party_wallet` adds no check.
- The asset is returned, not transferred. The transaction decides where it goes.
- The `Receiving<Item>` ticket names one object currently owned by the Party's address, at its current version.

## Receiving Coins and Redeeming Funds

`receive_balance` receives any number of `Coin<Currency>` objects and merges them into one `Balance<Currency>`. `redeem_balance` withdraws `value` from the funds accumulated at the Party's address:

```move
public fun receive_balance<Currency>(
    party: &mut Party,
    cap: &PartyAdminCap,
    coins: vector<Receiving<Coin<Currency>>>,
): Balance<Currency> {
    assert!(!coins.is_empty(), EEmptyCoins);
    let party_id = object::id(party);
    let count = coins.length();
    let balance = hikida::receive_coins_as_balance(party.uid_mut(cap), coins);
    emit(PartyCoinsReceivedEvent<Currency> { party_id, value: balance.value(), coins: count });
    balance
}

public fun redeem_balance<Currency>(
    party: &mut Party,
    cap: &PartyAdminCap,
    value: u64,
): Balance<Currency> {
    let party_id = object::id(party);
    let uid = party.uid_mut(cap);
    assert!(value > 0, EZeroValue);
    let balance = hikida::redeem_balance<Currency>(uid, value);
    emit(PartyFundsRedeemedEvent<Currency> { party_id, value: balance.value() });
    balance
}
```

Both return a `Balance<Currency>`. Convert it with `coin::from_balance` or pass it to a call that takes a balance. Zero-value coins are accepted and counted. Mechanics come from [`hikida`](https://github.com/unconfirmedlabs/hikida/tree/e245b09f5cee183500c1878d8b34d7bf1b85e20d).

Over-redeeming fails in Sui's accumulator on a network. The Move unit-test VM does not enforce the limit. The [`e2e` localnet test](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/e2e) checks it on a real validator: fund a Party with 500 MIST, confirm redeeming 501 fails with no event or asset, then redeem exactly 500.

A redemption also produces the accumulator's own withdrawal effect. If you index that effect and `PartyFundsRedeemedEvent`, do not count one redemption twice.

## Composing in One Transaction

Each operation returns its asset, so combine it with other calls in one programmable transaction. The cap can be owned or borrowed from a [Vault](/move/framework/vault/). The tests show the Vault case (excerpt; `action` is `party_wallet`, `ticket` builds a `Receiving` for a coin sent to the Party):

```move
let (party_admin_cap, receipt) = vault.borrow_as_admin(&vault_admin_cap);
let cap_id = object::id(&party_admin_cap);
let received = action::receive_balance<SUI>(
    &mut party,
    &party_admin_cap,
    vector[ticket<Coin<SUI>>(coin_id)],
);
assert_eq!(balance::destroy_for_testing(received), 900);
vault.put_back(party_admin_cap, receipt);
```

Before the transaction ends, send the balance through `coin::from_balance` and a transfer, or into another package's call. Put the Party cap back in the same transaction; [Vault](/move/framework/vault/#leases) explains why.

The package has no recipient parameters, internal transfers, coin-returning wrappers, batch helpers, or `entry` functions. The caller's transaction decides.

## Why There Is No Wallet Plugin

A plugin borrows a capability from a Vault and calls an Action without the admin present, which suits operations whose result goes somewhere fixed. Every `party_wallet` operation returns an object or `Balance` to the caller, so a permissionless plugin would hand the Party's assets to any caller. The repository has no Party wallet plugin. `party_wallet` defines no witnesses, installation records, or Vault types. Vault appears only in its tests.

## Never Send the PartyAdminCap to Its Own Party

Each Party has exactly one `PartyAdminCap`, derived at creation, and receiving anything from the Party's address requires it. Sent to the Party's own address, the cap is locked there permanently (receiving it back requires itself) and the Party can never be administered again. The same lock applies to the `VaultAdminCap` of a Vault holding the Party's cap, unless a plugin authorized on that Vault can borrow the cap.

Before transferring a `PartyAdminCap`, or a `VaultAdminCap` for one, check that the recipient is not `inbox_address` of the Party it controls.

## Failure Cases

| Situation | Result |
| --- | --- |
| A `PartyAdminCap` for another Party | Every operation aborts in `miso_party::party` with `EUnauthorized` (0). |
| `receive_balance` with an empty vector | Aborts with `EEmptyCoins` (0), before the cap is checked. |
| `redeem_balance` with a `value` of 0 | Aborts with `EZeroValue` (1), after the cap is checked. |
| A receiving ticket for an object not owned by the Party's address, or at a stale version | Fails in Sui's native receive; no package abort code. |
| Redeeming more than the Party's address holds | Fails in Sui's accumulator on a network. |
| An object without `store` sent to the Party's address | Cannot be received through this package. |

## Events

| Event | Fields |
| --- | --- |
| `PartyObjectReceivedEvent<Item>` | `party_id`, `object_id` |
| `PartyCoinsReceivedEvent<Currency>` | `party_id`, `value` (the merged total), `coins` (the number of coins received) |
| `PartyFundsRedeemedEvent<Currency>` | `party_id`, `value` |

Events carry no coin IDs. The transaction's inputs and effects record them.

## Deployment

`party_wallet` pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4) and `hikida` at `e245b09f`, and uses `vault` only in test mode. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/Published.toml) records two generations:

- **Mainnet** `published-at = "0x19555c911bfdfe63b2efa3a942cf11f7b5dfe54c929f38fff754a16a3f51508c"`. Recorded after the last source and pin change, so it matches this source.
- **Testnet** `published-at = "0xbd3fbf4a6bb5c5a68f3060188f8ae17039fa8e38802bf8058230cf19812d3f59"`. Recorded before later source changes and core re-pins, so it predates this source.

The README states no audit status. The 15 unit tests pass locally. After changing the funds paths, run the `e2e` validator test with Sui 1.79.0 and Bun. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/sources/party_wallet.move), [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/tests/party_wallet_tests.move), and [localnet test](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/e2e/wallet.localnet.ts).
