---
title: Recording
description: How a master has its own identity and ownership while remaining linked to its composition.
---

A recording represents a particular fixed performance and production of a [composition](/protocol/composition/): a master. A studio version, a live take, and a cover can each be distinct recordings of the same song.

In the [overview's example](/protocol/overview/), Dolly Parton's and Whitney Houston's recordings of “I Will Always Love You” would have separate recording IDs and separate share types. Both would point to the same composition.

## A permanent composition relationship

The core `Recording<RecordingShare>` contains its own object ID and an immutable `composition_id`. Once published, a recording cannot be redirected to another composition. Integrations reading that recording agree on which underlying work it references.

That relationship is visible in the complete object definition:

```move
public struct Recording<phantom RecordingShare> has key {
    id: UID,
    composition_id: ID,
}
```

`RecordingShare` identifies this master's share type; `composition_id` points to the separate composition object. The two relationships serve different purposes.

The relationship is stored on the recording rather than maintained as a mutable list on the composition. Adding a recording therefore does not require changing the composition or obtaining its admin capability. The core is permissionless: an application that needs recording authorization must check a recognized [recording license](/packages/recording-license/) or another agreement.

## Independent ownership and administration

Every recording has its own [fixed-supply share type](/protocol/shares/). Recording shares and composition shares are distinct types, reflecting the separate economic interests in the master and the underlying work. Recording royalties do not automatically flow to composition share holders simply because the objects are linked.

The `RecordingAdminCap` is separate from those shares. It authorizes extension writes and can issue [Release Consent](/protocol/release/#release-consent). Share ownership alone does not grant either power.

## One recording, multiple releases

A recording can appear on a single, an album, and a later compilation while retaining the same recording ID. Those releases refer to the existing master rather than creating copies of it.

Each release needs the recording admin's consent for its exact identity. Consent to one release does not authorize a different track list or another release. This preserves the distinction between identifying a master and approving how it is grouped for distribution.

## Audio and metadata live in extensions

The core recording does not contain audio, artist credits, a version name, or license terms. [Extension packages](/packages/#metadata-extensions) attach those details under the recording admin's authority. They can evolve without changing the master object's identity or its composition relationship.

Publication emits the recording, composition, and admin capability IDs together, giving indexers a direct record of the core relationship.

```move
public struct RecordingPublishedEvent<phantom RecordingShare> has copy, drop {
    recording_id: ID,
    composition_id: ID,
    admin_cap_id: ID,
}
```

Metadata and economic packages provide their own state and events.

Source: [recording module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/recording.move) and [protocol design](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/README.md).
