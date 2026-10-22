---
title: Recording
description: A particular master, its composition relationship, shares, and permissions.
---

A recording represents a particular fixed performance and production of a [composition](/protocol/composition/): a master. A studio version, live take, or cover can each be a separate recording of the same composition. The core `Recording<RecordingShare>` stores its own ID and an immutable `composition_id`. It does not contain audio, credits, version metadata, or license terms; those belong to extensions.

## Create and publish

Each recording uses its own `RecordingShare` coin type. After publishing and initializing that type, call `recording::new` with the shared `RecordingRegistry`, its currency and treasury cap, and an immutable reference to the composition. It returns the recording, a `RecordingAdminCap`, and the full initial share balance. Publish the recording in the same transaction with `recording::publish`.

The recording ID derives from the registry and its share type. `recording::derive_address<RecordingShare>` calculates it in advance. `recording::composition_id` reads the stored relationship, and `RecordingPublishedEvent` includes the recording, composition, and admin capability IDs.

## Rights and release participation

The composition reference fixes a relationship, not a license. The core lets a caller create a recording that points to a composition without checking recording rights. An application that requires authorization should check a recognized [recording license](/packages/recording-license/) or another agreement.

The recording admin capability controls extension writes and can issue [Release Consent](/protocol/releases/) for a particular release. It is separate from [recording shares](/protocol/shares/), which express fractional economic ownership through the packages that receive and distribute revenue. A [release](/protocol/release/) can include the recording only with consent for its exact release ID.

Source: [recording module](https://github.com/misofm/music-protocol/blob/main/sources/recording.move).
