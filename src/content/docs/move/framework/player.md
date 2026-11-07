---
title: Player
description: A listener's transferable on-chain root that holds Records and funds and that other packages extend.
---

`player` defines `Player`, a listener's root object. Attach data to it, or send it Records and funds.

## A Listener's Root Object

A [Party](/move/party-protocol/) is the business side. A `Player` is the listener side. A fan who buys a Record of *The Bodyguard* soundtrack through [`record_sale`](/move/framework/record-sale/) gets the `Record` back from `purchase` and can send it to the Player's address instead of the wallet. The collection and later attachments stay together.

```move
public struct Player has key, store {
    id: UID,
}
```

The Player holds only its `UID`. Other packages attach features, so this package never changes. No registry, per-address key, or creation number.

## Creating a Player

```move
public fun new(ctx: &mut TxContext): Player {
    let player = Player { id: object::new(ctx) };
    emit(PlayerCreatedEvent { player_id: object::id(&player) });
    player
}
```

- **Anyone can create one.** `new` returns it without transferring. The transaction decides where it goes, usually `transfer::public_transfer` to the sender.
- **An address can hold several.** List them over RPC as owned objects of type `Player`. The tests create two for one address.
- **No shared state.** Creations never contend.
- **No destroy.** Deleting would strand everything at its address.

## Ownership and Transfer

`Player` has `key` and `store`: the holder can `transfer::public_transfer` or wrap it. A listener can give away, lend, or sell their Player.

- **Holding it is the authority.** No admin cap. Only the owning address can pass it to a function.
- **Everything moves with it.** Extensions, objects at its address, and funds follow the Player. The test `a_player_and_its_holdings_move_to_a_new_owner` sends a coin to a Player, transfers it, and has the new holder receive the coin.
- **Never share or freeze a Player.** `store` lets `transfer::public_share_object` and `transfer::public_freeze_object` accept it. A shared Player lets anyone call `uid_mut` and take its holdings. A frozen one can never be passed mutably, so its holdings are locked forever.
- **History is not proof of fandom.** A Player can change hands, so attachments do not prove the current holder earned them. A feature needing that proof should require a separate lock recording how long the current holder has held the Player (README).

## Extending a Player

```move
public fun uid_mut(self: &mut Player): &mut UID {
    &mut self.id
}

public fun uid(self: &Player): &UID {
    &self.id
}
```

Extensions write with `uid_mut`. Anyone reads with `uid`.

- **Owner-written data** is a dynamic field. Each extension package has its own key, named for what it stores. This package defines none.
- **Anything with its own funds or public writes**, such as a streaming account anyone can settle receipts against, is a separate object derived with `derived_object::claim(player.uid_mut(), key)`. The test `extensions_attach_through_uid_mut` checks the child's address equals `derived_object::derive_address(object::id(&player), key)`.

**Passing `&mut Player` hands over everything at its address.** Its `UID` controls every object and fund held there. Pass it mutably only to packages you trust. Keep value-holding state in a separate derived object, not the Player's `UID`.

## Holdings

Objects sent to the Player's address (such as Records) and funds sent with `balance::send_funds` belong to the Player. List a collection over RPC as objects owned by that address.

This package cannot take them out. An extension does, through `uid_mut`, with `transfer::public_receive` for objects or `balance::withdraw_funds_from_object` for funds. [Player Wallet](/move/framework/player-wallet/) receives objects and coins and redeems funds, returning each to the caller. Until then, anything sent stays there.

## Failure Cases

| Situation | Result |
| --- | --- |
| Any call to `new`, `uid_mut`, or `uid` | Never aborts; the module defines no error constants. |
| A Player shared with `transfer::public_share_object` | Anyone can pass it mutably and take its holdings through `uid_mut`. |
| A Player frozen with `transfer::public_freeze_object` | It can no longer be passed mutably, so its holdings are locked forever. |

## Events

| Event | Fields |
| --- | --- |
| `PlayerCreatedEvent` | `player_id` |

The event carries no owner. The creator is the transaction sender. Later holders come from ownership changes.

## Deployment

`player` depends only on the Sui framework, neither core protocol. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/Published.toml) records one generation:

- **Mainnet** `published-at = "0x47137c6af0c5938d4d49a1c2e5af7cfe983ac50c9561d0863d2ee1d013b3ae53"`, version 1, toolchain 1.82.1. Recorded after the last source change, so it matches this source.

No Testnet generation. The README states no audit status. The 6 unit tests pass locally with Sui 1.82.2. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/player) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/sources/player.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/tests/player_tests.move).
