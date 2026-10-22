---
title: Composition
description: The written work, its on-chain identity, shares, and extension surface.
---

A composition represents the underlying music and, where present, lyrics. It is the work associated with publishing, separate from any particular [recording](/protocol/recording/) of it. The core `Composition<CompositionShare>` object is deliberately small: it contains an ID and is parameterized by that work's unique share coin type. Titles, writers, lyrics, and other descriptive details live in extension packages.

## Create and publish

For each composition, publish and initialize a fresh `CompositionShare` coin type from the [share template](/protocol/shares/#create-a-works-coin). Pass its `Currency<CompositionShare>` and `TreasuryCap<CompositionShare>` to `composition::new` with the shared `CompositionRegistry`. The constructor validates and fixes the share supply, then returns the composition, its `CompositionAdminCap`, and the full initial share balance. Publish the composition in the same transaction with `composition::publish`.

The composition ID is derived from its registry and share type. `composition::derive_address<CompositionShare>` lets an integration calculate it from the registry before creation. Publishing emits `CompositionPublishedEvent` with the composition and admin capability IDs.

## Control and extensions

The admin capability authorizes `composition::uid_mut`, which extension packages use to attach dynamic fields. Holding composition [shares](/protocol/shares/) does not grant that capability. The core does not assign writers, set publishing terms, or open a royalty pool; an integration must use the relevant extension and payment packages for those behaviors.

One composition can have multiple recordings. A recording stores the composition ID when it is created, but that relationship alone does not prove permission to record or distribute the work. See [Recording](/protocol/recording/) and [Recording Licenses](/packages/recording-license/).

Source: [composition module](https://github.com/misofm/music-protocol/blob/main/sources/composition.move).
