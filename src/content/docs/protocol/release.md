---
title: Release
description: Why recordings are grouped into ordered releases and how recording admins consent to that grouping.
---

A release groups [recordings](/protocol/recording/) into an ordered track list, such as a single, EP, album, or compilation. The same recording may appear on multiple releases. A release establishes a catalog and distribution grouping; it does not create another class of composition or master rights.

For example, a single and an album can both include the same master. Each release has its own identity, while the recording and its connection to the underlying composition remain the same.

## Identity includes the track order

A published `Release` holds an ordered list of **1 to 1,000 distinct recording IDs**. Its identity derives from that list and a **32-byte salt** under the protocol's release registry. The salt allows separate releases to use the same track list without sharing an identity.

Order is part of the commitment. A release containing tracks A then B has a different target identity from one containing B then A. Changing the salt also changes the identity. Once published, a release's track list is fixed.

The core object stores that order directly:

```move
public struct Release has key {
    id: UID,
    state: ReleaseState,
    recording_ids: vector<ID>,
}
```

`state` tracks the transition from initialization to publication. `recording_ids` holds references to existing masters, so a release does not duplicate their audio, shares, or composition links.

The identity can be calculated before the release exists. That is what makes it possible for recording admins to approve a specific proposed release in advance.

## Release Consent

Each recording admin grants a `ReleaseConsent` for a particular recording and target release ID. Because the target ID commits to the ordered track list and salt, the approval is bound to that exact proposal.

```move
public struct ReleaseConsent has drop, store {
    release_id: ID,
    recording_id: ID,
}
```

The consent stores only the target release and recording IDs. Its `store` ability allows another contract to hold it, while the absence of `copy` prevents duplicating the approval.

Consider a compilation containing recordings A and B. Both admins approve the same target release ID. Swapping the track order or adding a third recording changes the target ID, so those approvals cannot authorize the revised proposal. The release must gather consent for its new identity.

During assembly, the protocol consumes the consents, rejects duplicate recordings, and checks that every approval targets the release being created. An extension can hold these approvals for an offer or escrow workflow, allowing recording admins and a release organizer to coordinate without requiring the same party to control every recording.

Inside the release constructor, this check ties every collected approval to the actual release ID:

```move
let release_id = object::id(&release);
consented_release_ids.do!(|consented| {
    assert!(consented == release_id, EUnauthorizedAssignment)
});
```

A mismatched approval aborts the transaction instead of producing a release with a different track list.

## What consent covers

Consent approves **membership and order**. It does not approve artwork, titles, prices, payment terms, or revenue splits. A sales or distribution package must define and collect approval for its own commercial terms.

The `ReleaseAdminCap` controls the release's extension surface. It does not grant administration over the included recordings or replace their admins' consent. Likewise, a release has no core share type or automatic release-wide revenue split; payment packages define how release revenue reaches the recordings and their share holders.

## Fixed relationships, extensible presentation

Titles, artwork, credits, and other presentation data belong to [extensions](/packages/protocol-extensions/release/). They can be managed around the fixed track list without expanding the core release model.

Publication records the release ID, admin capability ID, ordered recording IDs, and salt in `ReleasePublishedEvent`. Readers can verify the release's identity from those values and follow each recording to its composition.

Contract excerpts © Miso Labs, Inc., licensed under [Apache-2.0](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/LICENSE).

Source: [release module](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/sources/release.move) and [release consent design](https://github.com/misofm/music-protocol/blob/3bd54d135058324ce3e326e027eb300e0ceca2d8/README.md#release-consent).
