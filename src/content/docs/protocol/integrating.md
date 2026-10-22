---
title: Move Integration
description: Start a Sui Move integration against the current protocol generation.
---

Start from the [Miso Music Protocol repository](https://github.com/misofm/music-protocol) and pin a **40-character commit** in `Move.toml`. Use the Move package name `miso_music`. A schematic dependency entry is:

```toml
[dependencies]
miso_music = { git = "https://github.com/misofm/music-protocol.git", rev = "<40-character-commit>" }
```

Choose the commit from the exact package generation you intend to deploy against. An extension's `Move.toml` pins its own core revision; align these revisions and verify the published package IDs before composing packages. The current main-branch API can differ from immutable Mainnet or Testnet deployments and from a dependent package's pin.

## Core creation flow

For each work, first publish its [share coin template](/protocol/shares/) and initialize the currency. With those values and the correct shared registries, the current source API has this shape:

```move
let (composition, composition_cap, composition_shares) =
    composition::new(&mut composition_registry, &mut composition_currency, composition_treasury_cap);
let (recording, recording_cap, recording_shares) =
    recording::new(&mut recording_registry, &mut recording_currency, recording_treasury_cap, &composition);

composition.publish(&composition_cap);
recording.publish(&recording_cap);
// Transfer or wrap both capabilities and both returned share balances.
```

This is a flow sketch, not a standalone module: your transaction must create the two currencies and handle every returned value. Recording creation needs only an immutable composition reference. For existing works, fetch the shared composition and registry objects for the same published generation.

To publish a release, derive its target ID from the ordered recording IDs and salt, collect a `ReleaseConsent` from each recording admin, then call `release::new` and `publish`. See [Release Consent](/protocol/release/#release-consent) for the scope of that approval.

## Read and extend

- `recording::composition_id` returns the immutable parent work ID.
- `release::recording_ids` returns the ordered list.
- `composition::uid_mut`, `recording::uid_mut`, and `release::uid_mut` expose the typed dynamic-field extension surface after verifying the matching admin cap.
- `CompositionPublishedEvent`, `RecordingPublishedEvent`, and `ReleasePublishedEvent` carry core identities and relationships. Use extension events for optional metadata and economic state.

For paid flows, follow [Royalty pools](/packages/royalty-pool/) and [Recording licenses](/packages/recording-license/). Creating a core object alone neither opens a pool nor licenses a recording. Verify that the chosen source revisions and deployed identities compose before wiring payments.

Source: [core README](https://github.com/misofm/music-protocol/blob/main/README.md), [Move.toml](https://github.com/misofm/music-protocol/blob/main/Move.toml), and [source modules](https://github.com/misofm/music-protocol/tree/main/sources).
