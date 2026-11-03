---
title: Miso Player
description: One non-transferable Player per address, a listener's on-chain root that holds Records and funds and that other packages extend.
---

This page is for developers who build listener-side features: attaching data or objects to a listener, or sending Records and funds to one. It explains how `miso_player` gives each address exactly one `Player`, who controls it, and how other packages extend it.

## One Player per Listener

A [Party](/move/party-protocol/) is the business side: an artist or label that administers works. A `Player` is the listener side. Suppose a fan buys a Record of *The Bodyguard* soundtrack from [`record_shop`](/move/framework/record-shop/). The purchase transaction can send that Record to the fan's player address instead of the fan's wallet, so the collection, and anything later attached to the Player, stays together.

```move
public struct Player has key {
    id: UID,
}

public struct PlayerRegistry has key {
    id: UID,
}

public struct PlayerKey(address) has copy, drop, store;
```

The Player holds only its `UID`. Features attach from other packages, so this package never changes as the Player grows. The package's `init` shares one `PlayerRegistry`, and every Player is derived from it under `PlayerKey(owner)`. `derive_address(registry, owner)` computes any listener's player ID without a lookup.

## Creating a Player

The complete function:

```move
public fun new(registry: &mut PlayerRegistry, ctx: &mut TxContext) {
    let owner = ctx.sender();
    let player = Player { id: derived_object::claim(&mut registry.id, PlayerKey(owner)) };
    emit(PlayerCreatedEvent { player_id: object::id(&player), owner });
    transfer::transfer(player, owner);
}
```

The function shows the Player's guarantees:

- **One per address, for the sender only.** The key is the transaction sender, so nobody can create a Player for someone else, and a second `new` from the same address aborts in `sui::derived_object`.
- **Never transferable.** `Player` has `key` but not `store`, and this module transfers it once, to its creator, and offers no other transfer or share. History attached to a Player, such as listening totals, cannot be bought or sold.
- **Holding it is the authority.** A Player is address-owned, so only its owner can pass it to a function. There is no admin cap.
- **No destroy.** A derived ID cannot be claimed again, so a deleted Player could never be replaced; the package has no delete function.

## Extending a Player

```move
public fun uid_mut(self: &mut Player): &mut UID {
    &mut self.id
}
```

`uid_mut` is how other packages extend a Player:

- **Owner-written data** attaches as a dynamic field. Each extension is its own package with its own key, named for what it stores. This package defines no extension keys.
- **Anything with its own funds or public writes**, such as an account that anyone can settle against, is a separate object derived from the Player with `derived_object::claim(player.uid_mut(), key)`.

**Passing `&mut Player` hands over everything at its address.** The Player's `UID` controls every object and fund held at the player's address. Pass a Player mutably only to packages you trust, and keep anything that holds value in a separate derived object rather than sharing the Player's `UID`.

## Holdings

Objects sent to the player's address, such as Records, and funds sent with `balance::send_funds` belong to the Player. A collection can be listed over RPC as the objects owned by the player's address.

This package has no function to take them out. An extension does that through `uid_mut`, with `transfer::public_receive` for objects or `balance::withdraw_funds_from_object` for funds. Until the owner uses an extension that does so, anything sent to the player's address stays there.

## Failure Cases

| Situation | Result |
| --- | --- |
| A second `new` from the same address | Aborts with `derived_object::EObjectAlreadyExists`. |

The module defines no error constants.

## Events

| Event | Fields |
| --- | --- |
| `PlayerCreatedEvent` | `player_id`, `owner` |

`init` emits no event. The `PlayerRegistry` ID comes from the publish transaction's effects.

## Deployment

At commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0` the package has no `Published.toml` and records no deployed generation, so there is no `PlayerRegistry` ID to use yet. The README makes no statement about an audit. The package depends on neither core protocol, only the Sui framework. The 7 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player) at commit `3a7d223b94f566d9e714a0a6b26efe2549e7bad0`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player/README.md), [module](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player/sources/player.move), and [tests](https://github.com/misofm/framework/blob/3a7d223b94f566d9e714a0a6b26efe2549e7bad0/miso_player/tests/player_tests.move).
