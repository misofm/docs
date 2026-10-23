---
title: Composition
description: Why the underlying song has its own identity, shares, and administration.
---

A composition represents the underlying music and, where present, lyrics: the work associated with publishing. It gives that work an identity independent of any particular [recording](/protocol/recording/).

In the [overview's example](/protocol/overview/), “I Will Always Love You” is one composition. Dolly Parton's original recording and Whitney Houston's cover are separate masters of that work. They can refer to the same composition without sharing recording ownership, credits, or commercial terms.

## One identity for the work

The core `Composition<CompositionShare>` contains only an object ID. Its type parameter identifies the work's unique [share type](/protocol/shares/). Titles, writers, and lyrics are deliberately outside this core identity: changing a preferred title or correcting a credit should not create a different underlying work.

The complete core object definition shows that separation:

```move
public struct Composition<phantom CompositionShare> has key {
    id: UID,
}
```

`phantom CompositionShare` ties the object to a particular share type without storing a share balance inside the composition.

Within a protocol package's registry, a composition's ID is derived from its share type. This gives the work and its shares a stable, programmatically verifiable association. A derived address predicts where the object belongs; the published object and its history establish whether it exists.

## One composition, many recordings

A composition does not maintain a list of every recording made from it. Each recording stores the composition's ID instead. This lets new studio versions, live performances, and covers refer to the work without changing the composition object.

That reference describes which work was recorded. Permission to record it, and any agreed payment to its rights holders, belongs to a [recording license](/packages/recording-license/) or another agreement. The core relationship alone does not impose a commission.

## Administration and shares

The `CompositionAdminCap` controls the composition's extension surface. An administrator can use supported extensions to attach or update titles, credits, lyrics, and other data. The capability is a transferable bearer object, so its custody determines who can exercise that authority.

The contract exposes mutable UID access only with the matching admin capability:

```move
public fun uid_mut<CompositionShare>(
    self: &mut Composition<CompositionShare>,
    _: &CompositionAdminCap<CompositionShare>,
): &mut UID {
    &mut self.id
}
```

Here the capability's type supplies the authorization: there is one composition per share type within the registry. Extensions use this UID to attach their own typed dynamic fields.

Composition shares are separate from this administrative control. Holding shares does not grant the admin capability, and holding the capability does not imply ownership of the shares. [Royalty pools](/packages/royalty-pool/) and other economic packages define how share holders participate in payments.

## A small core, richer extensions

Publication makes the composition a shared on-chain object. Its identity and share type remain fixed, while authorized [extensions](/packages/protocol-extensions/composition/) can maintain descriptive and economic data around it. Applications reading the same composition ID agree on the core identity while applying the relevant extension's rules to its metadata and rights claims.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/LICENSE).

Source: [composition module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/composition.move) and [protocol design](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/README.md).
