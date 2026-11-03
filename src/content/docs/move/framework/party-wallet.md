---
title: Party Wallet
description: Take objects, coins, and accumulator funds sent to a Party's address and return them to the holder of the Party's admin capability.
---

This page is for developers who send assets or payouts to a Party, or who administer a Party that has received them. It explains the Party's two inboxes, how `party_wallet` takes assets out of each with the `PartyAdminCap`, how to compose it with other calls or a [Vault](/move/framework/vault/), and why the package has deliberately no plugin.

`party_wallet` is an [Action](/move/framework/#actions-and-libraries): each function accepts the raw capability and returns the asset to the caller. It stores no data.

## A Party's Two Inboxes

A [Party](/move/party-protocol/) is a shared object, and its object ID is also an address that can receive assets. Suppose Whitney Houston's Party is named as the recipient of a [royalty grant](/move/framework/royalty-grant/). The grant transfers its `RoyaltyGrantRecipientCap` to the Party's address as an object, and every sweep sends the recipient's royalties to the same address as accumulator funds. Neither can be used where it lands. `party_wallet` lets the holder of the Party's `PartyAdminCap` take both out:

- **Objects** sent with `transfer::public_transfer` to the Party's address, including `Coin<T>` objects, are received by ticket with `receive` or `receive_balance`.
- **Funds** sent with `balance::send_funds` to the Party's address accumulate there and are withdrawn by value with `redeem_balance`.

```move
public fun inbox_address(party: &Party): address {
    object::id(party).to_address()
}
```

`inbox_address` is the Party's ID as an address. Only objects with `key + store` can be received; an object without `store` sent to a Party's address cannot be recovered through this package.

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

The function shows the pattern every operation follows. Authorization is the core Party's `uid_mut(cap)`, which aborts unless the cap belongs to this Party; `party_wallet` adds no check of its own. The received object is returned, not transferred, so the same programmable transaction decides where it goes. The `Receiving<Item>` ticket names one object currently owned by the Party's address, at its current version.

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

Both return a `Balance<Currency>`, not a `Coin<Currency>`; convert it with `coin::from_balance` in the same transaction, or pass it to another call that takes a balance. Zero-value coins are accepted and counted. The coin and funds mechanics come from [`hikida`](https://github.com/unconfirmedlabs/hikida/tree/e245b09f5cee183500c1878d8b34d7bf1b85e20d).

Redeeming more than the Party's address holds fails in Sui's accumulator on a network. The Move unit-test VM does not enforce that limit, so the package's [`e2e` localnet test](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/e2e) checks it against a real validator: it funds a Party with 500 MIST, confirms that redeeming 501 fails with no event or asset, and then redeems exactly 500.

A redemption also produces the accumulator's own withdrawal effect. Indexers that read both that effect and `PartyFundsRedeemedEvent` must not count one redemption twice.

## Composing in One Transaction

Because each operation returns its asset, a caller combines it with other calls in one programmable transaction. The cap can be owned directly or borrowed from a [Vault](/move/framework/vault/) for the transaction. The package tests show the Vault case (excerpt from the tests; `action` is `party_wallet`, and `ticket` builds a `Receiving` for a coin sent to the Party):

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

In a real transaction, the balance would go on to `coin::from_balance` and a transfer, or into another package's call, before the transaction ends. The Party cap must be put back in the same transaction; [Vault](/move/framework/vault/#leases) explains why.

The package deliberately has no recipient parameters, internal transfers, coin-returning wrappers, batch helpers, or `entry` functions. Those choices belong to the caller's transaction.

## Why There Is No Wallet Plugin

A plugin is installed automation that borrows a capability from a Vault and calls an Action without the admin present. That suits operations whose result goes somewhere fixed. Every useful `party_wallet` operation instead returns an object or a `Balance` to whoever calls it. A permissionless plugin wrapping it would hand the Party's assets to any caller, creating a way to extract them rather than a safe crank. The repository therefore has no Party wallet plugin, and `party_wallet` defines no witnesses, installation records, or Vault types. Vault appears only in its tests.

## Never Send the PartyAdminCap to Its Own Party

Each Party has exactly one `PartyAdminCap`, derived from the Party when it is created. Receiving anything from the Party's address requires that cap. If the cap itself is sent to the Party's own address, receiving it back would require the cap it is trying to receive, so it is locked there permanently and the Party can never be administered again. The same lock applies to the `VaultAdminCap` of a Vault holding the Party's cap, unless a plugin authorized on that Vault can borrow the cap.

Before transferring a `PartyAdminCap`, or a `VaultAdminCap` for one, check that the recipient address is not `inbox_address` of the Party it controls.

## Failure Cases

| Situation | Result |
| --- | --- |
| A `PartyAdminCap` for another Party | Every operation aborts in `miso_party::party` with `EUnauthorized` (0). |
| `receive_balance` with an empty vector | Aborts with `EEmptyCoins` (0), before the cap is checked. |
| `redeem_balance` with a `value` of 0 | Aborts with `EZeroValue` (1), after the cap is checked. |
| A receiving ticket for an object not owned by the Party's address, or at a stale version | The transaction fails in Sui's native receive; there is no package abort code. |
| Redeeming more than the Party's address holds | Fails in Sui's accumulator on a network. |
| An object without `store` sent to the Party's address | Cannot be received through this package. |

## Events

| Event | Fields |
| --- | --- |
| `PartyObjectReceivedEvent<Item>` | `party_id`, `object_id` |
| `PartyCoinsReceivedEvent<Currency>` | `party_id`, `value` (the merged total), `coins` (the number of coins received) |
| `PartyFundsRedeemedEvent<Currency>` | `party_id`, `value` |

The events carry no list of coin IDs; the transaction's inputs and effects record which coins were received.

## Deployment

`party_wallet` pins `miso_party` at [`b16e0598`](https://github.com/misofm/party-protocol/tree/b16e05982844453b286937cc085d573a92d7cea4) and `hikida` at `e245b09f`, and uses `vault` only in test mode. Its [`Published.toml`](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/Published.toml) records two generations:

- **Mainnet** `published-at = "0x19555c911bfdfe63b2efa3a942cf11f7b5dfe54c929f38fff754a16a3f51508c"`, recorded after the last change to the package's sources and dependency pins, so it corresponds to the source on this page.
- **Testnet** `published-at = "0xbd3fbf4a6bb5c5a68f3060188f8ae17039fa8e38802bf8058230cf19812d3f59"`, recorded before later source changes and core re-pins, so it predates this source.

The README does not state an audit status. The 15 unit tests pass locally; run the `e2e` validator test with Sui 1.79.0 and Bun after changes to the funds paths. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/sources/party_wallet.move), [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/tests/party_wallet_tests.move), and [localnet test](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/party_wallet/e2e/wallet.localnet.ts).
