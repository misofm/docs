---
title: Player Wallet
description: Take objects, coins, and accumulator funds sent to a Player's address and return them to whoever holds the Player.
---

This page is for developers who send Records, coins, or payouts to a listener's Player, or who build the wallet side of a listener app. It explains a Player's two inboxes, how `player_wallet` takes assets out of each by holding the Player, how a transfer of the Player moves its inboxes with it, and the one mistake that locks a Player for good.

`player_wallet` is an [Action](/move/framework/#actions-and-libraries) and the [Player](/move/framework/player/) counterpart of [Party Wallet](/move/framework/party-wallet/). The difference is the authority: a Party is shared, so `party_wallet` takes the Party's `PartyAdminCap`; a Player is owned, so `player_wallet` takes `&mut Player`, which only its holder can pass. Each function returns the asset to the caller. The package stores no data and has no installation surface.

## A Player's Two Inboxes

A Player's object ID is also an address that can receive assets. Suppose a fan buys a Record of *The Bodyguard* soundtrack through [`record_sale`](/move/framework/record-sale/) and the purchase transaction sends the `Record` to the fan's Player address. Later, a friend sends the fan some SUI the same way. Neither can be used where it lands. `player_wallet` lets the Player's holder take both out:

- **Objects** sent with `transfer::public_transfer` to the Player's address, including Records and `Coin<T>` objects, are received by ticket with `receive` or `receive_balance`.
- **Funds** sent with `balance::send_funds` to the Player's address accumulate there and are withdrawn by value with `redeem_balance`.

```move
public fun inbox_address(player: &Player): address {
    object::id(player).to_address()
}
```

`inbox_address` is the Player's ID as an address. Only objects with `key + store` can be received; an object without `store` sent to a Player's address cannot be recovered through this package.

## Receiving Objects

```move
public fun receive<Item: key + store>(
    player: &mut Player,
    object_to_receive: Receiving<Item>,
): Item {
    let player_id = object::id(player);
    let received = transfer::public_receive(player.uid_mut(), object_to_receive);
    emit(PlayerObjectReceivedEvent<Item> { player_id, object_id: object::id(&received) });
    received
}
```

The function shows the pattern every operation follows. Authorization is the `&mut Player` argument itself: the package performs no check of its own, and the Player's `uid_mut` gives it the `UID` that owns the inbox. The received object is returned, not transferred, so the same programmable transaction decides where it goes. The `Receiving<Item>` ticket names one object currently owned by the Player's address, at its current version.

## Receiving Coins and Redeeming Funds

`receive_balance` receives any number of `Coin<Currency>` objects and merges them into one `Balance<Currency>`. `redeem_balance` withdraws `value` from the funds accumulated at the Player's address:

```move
public fun receive_balance<Currency>(
    player: &mut Player,
    coins: vector<Receiving<Coin<Currency>>>,
): Balance<Currency> {
    assert!(!coins.is_empty(), EEmptyCoins);
    let player_id = object::id(player);
    let count = coins.length();
    let balance = hikida::receive_coins_as_balance(player.uid_mut(), coins);
    emit(PlayerCoinsReceivedEvent<Currency> { player_id, value: balance.value(), coins: count });
    balance
}

public fun redeem_balance<Currency>(player: &mut Player, value: u64): Balance<Currency> {
    assert!(value > 0, EZeroValue);
    let player_id = object::id(player);
    let balance = hikida::redeem_balance<Currency>(player.uid_mut(), value);
    emit(PlayerFundsRedeemedEvent<Currency> { player_id, value: balance.value() });
    balance
}
```

Both return a `Balance<Currency>`, not a `Coin<Currency>`; convert it with `coin::from_balance` in the same transaction, or pass it to another call that takes a balance. The coin and funds mechanics come from [`hikida`](https://github.com/unconfirmedlabs/hikida/tree/e245b09f5cee183500c1878d8b34d7bf1b85e20d), the same paths `party_wallet` uses.

Redeeming more than the Player's address holds fails in Sui's accumulator on a network. The Move unit-test VM runs the credit and redemption paths but does not enforce that limit, and its `AccumulatorRoot` snapshot stays at zero; the test `funded_accumulator_snapshot_documents_zero_vm_result` records that. `player_wallet` has no validator test of its own. Its README relies on the [`party_wallet` localnet test](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/e2e), which exercises the same `hikida::redeem_balance` path against a real validator.

A redemption also produces the accumulator's own withdrawal effect. Indexers that read both that effect and `PlayerFundsRedeemedEvent` must not count one redemption twice.

## Composing in One Transaction

Because each operation returns its asset, a caller combines it with other calls in one programmable transaction. The package tests show the merge case (excerpt from the tests; `wallet` is `player_wallet`, and `ticket` builds a `Receiving` for a coin sent to the Player):

```move
let mut player = scenario.take_from_sender<Player>();
let received = wallet::receive_balance<SUI>(
    &mut player,
    vector[ticket<Coin<SUI>>(first), ticket<Coin<SUI>>(second)],
);
assert_eq!(received.value(), 1_000);
```

In a real transaction, the balance would go on to `coin::from_balance` and a transfer, or into another package's call, before the transaction ends.

The package deliberately has no recipient parameters, internal transfers, coin-returning wrappers, batch helpers, or `entry` functions. Those choices belong to the caller's transaction.

## The Inbox Moves with the Player

A [Player](/move/framework/player/#ownership-and-transfer) has `store` and can change hands. Its address is its object ID, so the inbox goes with it: whoever holds the Player can receive what was sent to it, including items sent before they got it. The package tests check this (excerpt from the tests; the coin was sent to the Player's address before the transfer):

```move
let player = scenario.take_from_sender<Player>();
transfer::public_transfer(player, OTHER);
scenario.next_tx(OTHER);
let mut player = scenario.take_from_sender<Player>();
let coin = wallet::receive(&mut player, ticket<Coin<SUI>>(coin_id));
assert_eq!(coin.value(), 5);
```

Before transferring or selling a Player, take out anything that should stay with the current holder.

## Never Send a Player to Its Own Address

Receiving anything from a Player's address requires `&mut` access to that Player. If the Player itself is sent to its own `inbox_address`, receiving it back would require the Player it is trying to receive, so it is locked there permanently along with everything it holds. Before transferring a Player, check that the recipient is not its own `inbox_address`.

## Failure Cases

| Situation | Result |
| --- | --- |
| `receive_balance` with an empty vector | Aborts with `EEmptyCoins` (0). |
| `redeem_balance` with a `value` of 0 | Aborts with `EZeroValue` (1). |
| A receiving ticket for an object not owned by the Player's address, or at a stale version | The transaction fails in Sui's native receive; there is no package abort code. |
| Redeeming more than the Player's address holds | Fails in Sui's accumulator on a network. |
| An object without `store` sent to the Player's address | Cannot be received through this package. |
| A Player sent to its own address | Locked permanently with everything it holds. |

There is no wrong-authority case: a caller who does not hold the Player cannot pass it.

## Events

| Event | Fields |
| --- | --- |
| `PlayerObjectReceivedEvent<Item>` | `player_id`, `object_id` |
| `PlayerCoinsReceivedEvent<Currency>` | `player_id`, `value` (the merged total), `coins` (the number of coins received) |
| `PlayerFundsRedeemedEvent<Currency>` | `player_id`, `value` |

The events carry no list of coin IDs; the transaction's inputs and effects record which coins were received.

## Deployment

`player_wallet` depends on [`player`](/move/framework/player/) by local path and pins `hikida` at `e245b09f`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/Published.toml) records one generation:

- **Mainnet** `published-at = "0xca2ef929d600602e2a274171c840efa15e87b6d89b284d290bbcf04f5a6d03a7"`, version 1, toolchain 1.82.1, recorded after the package was added and after the last change to `player`, so it corresponds to the source on this page.

There is no Testnet generation. The README does not state an audit status. The 11 unit tests pass locally with Sui 1.82.2. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/sources/player_wallet.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/tests/player_wallet_tests.move).
