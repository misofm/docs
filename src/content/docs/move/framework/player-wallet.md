---
title: Player Wallet
description: Take objects, coins, and accumulator funds sent to a Player's address, by holding the Player.
---

`player_wallet` collects what others sent to a Player's address and returns it to the caller. Use it for the wallet side of a listener app.

It is an [Action](/move/framework/#actions-and-plugins) and the [Player](/move/framework/player/) counterpart of [Party Wallet](/move/framework/party-wallet/). A Party is shared, so `party_wallet` takes its `PartyAdminCap`. A Player is owned, so `player_wallet` takes `&mut Player`, which only its holder can pass. It stores no data.

## A Player's Two Inboxes

A Player's object ID is also an address that can receive assets. If a fan's [`record_sale`](/move/framework/record-sale/) purchase of a *The Bodyguard* Record sends the `Record` to the Player address, and a friend later sends SUI the same way, neither is usable where it lands. The holder takes both out:

- **Objects** sent with `transfer::public_transfer`, including Records and `Coin<T>` objects, are received by ticket with `receive` or `receive_balance`.
- **Funds** sent with `balance::send_funds` accumulate at the address and are withdrawn by value with `redeem_balance`.

```move
public fun inbox_address(player: &Player): address {
    object::id(player).to_address()
}
```

Only `key + store` objects can be received. An object without `store` sent to a Player's address is unrecoverable through this package.

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

Every operation follows this pattern:

- Authorization is the `&mut Player` argument. The package adds no check; `uid_mut` supplies the `UID` that owns the inbox.
- The asset is returned, not transferred. The transaction decides where it goes.
- The `Receiving<Item>` ticket names one object currently owned by the Player's address, at its current version.

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

Both return a `Balance<Currency>`. Convert it with `coin::from_balance` or pass it to a call that takes a balance. Mechanics come from [`hikida`](https://github.com/unconfirmedlabs/hikida/tree/e245b09f5cee183500c1878d8b34d7bf1b85e20d), the same paths `party_wallet` uses.

Over-redeeming fails in Sui's accumulator on a network. The Move unit-test VM runs the credit and redemption paths but does not enforce the limit, and its `AccumulatorRoot` snapshot stays at zero (test `funded_accumulator_snapshot_documents_zero_vm_result`). `player_wallet` has no validator test. Its README relies on the [`party_wallet` localnet test](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/party_wallet/e2e), which exercises the same `hikida::redeem_balance` path on a real validator.

A redemption also produces the accumulator's own withdrawal effect. If you index that effect and `PlayerFundsRedeemedEvent`, do not count one redemption twice.

## Composing in One Transaction

Each operation returns its asset, so combine it with other calls in one programmable transaction. The tests show the merge case (excerpt; `wallet` is `player_wallet`, `ticket` builds a `Receiving` for a coin sent to the Player):

```move
let mut player = scenario.take_from_sender<Player>();
let received = wallet::receive_balance<SUI>(
    &mut player,
    vector[ticket<Coin<SUI>>(first), ticket<Coin<SUI>>(second)],
);
assert_eq!(received.value(), 1_000);
```

Before the transaction ends, send the balance through `coin::from_balance` and a transfer, or into another package's call.

The package has no recipient parameters, internal transfers, coin-returning wrappers, batch helpers, or `entry` functions. The caller's transaction decides.

## The Inbox Moves with the Player

A [Player](/move/framework/player/#ownership-and-transfer) has `store` and can change hands. Its address is its object ID, so the inbox goes with it. Whoever holds the Player can receive what was sent to it, including items sent before they got it. The tests check this (excerpt; the coin was sent before the transfer):

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

Receiving from a Player's address requires `&mut` access to that Player. Sent to its own `inbox_address`, the Player cannot be received back without itself, so it is locked there permanently with everything it holds. Before transferring a Player, check that the recipient is not its own `inbox_address`.

## Failure Cases

| Situation | Result |
| --- | --- |
| `receive_balance` with an empty vector | Aborts with `EEmptyCoins` (0). |
| `redeem_balance` with a `value` of 0 | Aborts with `EZeroValue` (1). |
| A receiving ticket for an object not owned by the Player's address, or at a stale version | Fails in Sui's native receive; no package abort code. |
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

Events carry no coin IDs. The transaction's inputs and effects record them.

## Deployment

`player_wallet` depends on [`player`](/move/framework/player/) by local path and pins `hikida` at `e245b09f`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/Published.toml) records one generation:

- **Mainnet** `published-at = "0xca2ef929d600602e2a274171c840efa15e87b6d89b284d290bbcf04f5a6d03a7"`, version 1, toolchain 1.82.1. Recorded after the package was added and after the last `player` change, so it matches this source.

No Testnet generation. The README states no audit status. The 11 unit tests pass locally with Sui 1.82.2. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/sources/player_wallet.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player_wallet/tests/player_wallet_tests.move).
