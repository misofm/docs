---
title: Player
description: A listener's transferable on-chain root that holds Records and funds and that other packages extend.
---

This page is for developers who build listener-side features: attaching data or objects to a listener, or sending Records and funds to one. It explains how `player` creates a `Player`, who controls it, what moves with it when it changes hands, and how other packages extend it.

## A Listener's Root Object

A [Party](/move/party-protocol/) is the business side: an artist or label that administers works. A `Player` is the listener side. Suppose a fan buys a Record of *The Bodyguard* soundtrack through [`record_sale`](/move/framework/record-sale/). `purchase` returns the `Record` to the transaction, so the same transaction can send it to the fan's Player address instead of the fan's wallet. The collection, and anything later attached to the Player, then stays together.

```move
public struct Player has key, store {
    id: UID,
}
```

The Player holds only its `UID`. Features attach from other packages, so this package never changes as the Player grows. There is no registry, no per-address key, and no creation number.

## Creating a Player

The complete function:

```move
public fun new(ctx: &mut TxContext): Player {
    let player = Player { id: object::new(ctx) };
    emit(PlayerCreatedEvent { player_id: object::id(&player) });
    player
}
```

The function shows how creation works:

- **Anyone can create one, and it is returned to the caller.** `new` does not transfer the Player; the programmable transaction decides where it goes, usually to the sender with `transfer::public_transfer`.
- **An address can hold several.** Nothing limits an address to one Player. List an address's Players over RPC as the objects of type `Player` it owns. The package tests create two for one address.
- **No shared state.** `new` takes no shared object, so creations never contend with each other.
- **No destroy.** The package has no delete function. Deleting a Player would strand everything held at its address.

## Ownership and Transfer

`Player` has `key` and `store`, so whoever holds it can transfer it with `transfer::public_transfer` or wrap it in another object. The README describes this as letting a listener give away, lend, or sell their Player.

- **Holding it is the authority.** There is no admin cap. A Player that is owned by an address can only be passed to a function by that address.
- **Everything moves with it.** Its extensions, the objects owned by its address, and the funds sent there all follow the Player to its new holder. The test `a_player_and_its_holdings_move_to_a_new_owner` sends a coin to a Player, transfers the Player, and has the new holder receive the coin.
- **Never share or freeze a Player.** Because `Player` has `store`, `transfer::public_share_object` and `transfer::public_freeze_object` accept it. A shared Player lets anyone call `uid_mut` and take its holdings; a frozen one can never be passed mutably again, so its holdings are locked forever.
- **History is not proof of fandom.** A Player can change hands, so nothing should treat what is attached to it as proof that the current holder earned it. According to the README, a feature that needs that proof should require a separate lock that records how long the current holder has had the Player.

## Extending a Player

```move
public fun uid_mut(self: &mut Player): &mut UID {
    &mut self.id
}

public fun uid(self: &Player): &UID {
    &self.id
}
```

`uid_mut` is how other packages extend a Player, and `uid` is how anyone reads what they attached:

- **Owner-written data** attaches as a dynamic field. Each extension is its own package with its own key, named for what it stores. This package defines no extension keys.
- **Anything with its own funds or public writes**, such as a streaming account that anyone can settle receipts against, is a separate object derived from the Player with `derived_object::claim(player.uid_mut(), key)`. The test `extensions_attach_through_uid_mut` checks that the derived child's address equals `derived_object::derive_address(object::id(&player), key)`.

**Passing `&mut Player` hands over everything at its address.** The Player's `UID` controls every object and fund held at the Player's address. Pass a Player mutably only to packages you trust, and keep anything that holds value in a separate derived object rather than sharing the Player's `UID`.

## Holdings

Objects sent to the Player's address, such as Records, and funds sent with `balance::send_funds` belong to the Player. A collection can be listed over RPC as the objects owned by the Player's address.

This package has no function to take them out. An extension does that through `uid_mut`, with `transfer::public_receive` for objects or `balance::withdraw_funds_from_object` for funds. [Player Wallet](/move/framework/player-wallet/) is the package that does this: it receives objects and coins and redeems funds, returning each to the caller. Until the holder uses such a package, anything sent to the Player's address stays there.

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

The event carries no owner. The creator is the transaction sender, and later holders come from object ownership changes, so an indexer can track every Player's creation from events and the transaction envelope alone.

## Deployment

`player` depends on neither core protocol, only the Sui framework. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/Published.toml) records one generation:

- **Mainnet** `published-at = "0x47137c6af0c5938d4d49a1c2e5af7cfe983ac50c9561d0863d2ee1d013b3ae53"`, version 1, toolchain 1.82.1, recorded after the last change to the package's sources, so it corresponds to the source on this page.

There is no Testnet generation. The README does not state an audit status. The 6 unit tests pass locally with Sui 1.82.2. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/player) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/sources/player.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/player/tests/player_tests.move).
