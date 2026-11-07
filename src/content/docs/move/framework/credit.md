---
title: Credit
description: The shared Credit<Role> value, a display name with distinct roles.
---

`credit` defines `Credit<Role>`, the value the composition, recording, and release credits extensions store: a display name plus one or more distinct roles.

## One Value, Three Role Types

Dolly Parton is credited as songwriter on the [Composition](/move/music-protocol/composition/) of "I Will Always Love You", Whitney Houston as artist on her [Recording](/move/music-protocol/recording/). Both are a `Credit`, with a role vocabulary per work type:

```move
public struct Credit<Role: copy + drop + store> has copy, drop, store {
    display_name: String,
    roles: vector<Role>,
}
```

`Credit` is a plain value, not an object: no admin, ID, or events. `display_name` is how the credit reads on that work. It is not checked against the Party's name in [`party_name`](/move/framework/party-name/). `Role` is the extension's role enum:

| Extension | Stored as | Role type | Extra limits |
| --- | --- | --- | --- |
| [`composition_credits`](/move/framework/composition-credits/) | `VecMap<ID, Credit<CompositionPartyRole>>` on a Composition | `CompositionPartyRole` | none beyond `credit` |
| [`recording_credits`](/move/framework/recording-credits/) | `VecMap<ID, Credit<RecordingPartyRole>>` on a Recording | `RecordingPartyRole` | at most 10 roles, not both primary and featured |
| [`release_credits`](/move/framework/release-credits/) | `VecMap<ID, Credit<ReleasePartyRole>>` on a Release | `ReleasePartyRole` | exactly one role |

Each extension keys its map by Party ID: one credit per Party per work. Attaching one requires the work's admin cap and a reference to the Party.

## Constructing a Credit

`new` is public: anyone can build a `Credit`. The extension call that attaches it is the gate.

```move
public fun new<Role: copy + drop + store>(display_name: String, roles: vector<Role>): Credit<Role> {
    assert!(!display_name.is_empty(), EEmptyDisplayName);
    assert!(display_name.length() <= MAX_DISPLAY_NAME_LENGTH, EDisplayNameTooLong);
    assert!(roles.length() >= MIN_ROLES, EEmptyRoles);
    assert!(roles.length() <= MAX_ROLES, ETooManyRoles);
    let mut seen = vec_set::empty();
    roles.do_ref!(|role| {
        assert!(!seen.contains(role), ERoleAlreadyAdded);
        seen.insert(*role);
    });
    Credit { display_name, roles }
}
```

The display name is non-empty and at most 200 bytes of UTF-8, not 200 characters. A credit has 1 to 50 distinct roles, kept in the order given. Extensions apply tighter limits.

A `Credit` has no setters. To change one, the work's admin calls the extension's `remove_credit` then `add_credit`, in one transaction. Views: `display_name` and `roles`.

In a programmable transaction, call the extension's role constructors, then `credit::new`, then the extension's `add_credit` with the work, its admin cap, and the Party.

## Failure Cases

| Situation | Result |
| --- | --- |
| A display name longer than 200 bytes | `new` aborts with `EDisplayNameTooLong` (0). |
| An empty display name | `new` aborts with `EEmptyDisplayName` (1). |
| No roles | `new` aborts with `EEmptyRoles` (2). |
| More than 50 roles | `new` aborts with `ETooManyRoles` (3). |
| The same role twice | `new` aborts with `ERoleAlreadyAdded` (4). |

## Events

`credit` emits no events. Each credits extension's added event carries the work ID, the Party ID, the display name, and the roles (`role` for `release_credits`).

## Deployment

Depends only on the Sui framework, not the core protocol. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit/Published.toml) records a mainnet generation at `published-at = "0xf6c09b6b20a514c9494b6b31443642841441d2965c8c49968315b54f27bc2222"`, postdating the last source change, so it matches this source. The testnet generation, `published-at = "0xe3fa36c9dd8cf22d0b622c49b3f566520aefb93cbf417ed2416dbdb6dae65dd4"`, predates the latest source change, which renamed the error constants and kept their codes. A credits extension accepts only the `Credit` type of the `credit` package it links. The README states no audit status. The 9 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit/sources/credit.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/credit/tests/credit_tests.move).
