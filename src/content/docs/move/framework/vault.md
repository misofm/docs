---
title: Vault
description: Hold a capability in a permanent, discoverable shared object and lend the exact capability out for one transaction at a time.
---

This page is for developers who want an admin capability, such as a `ReleaseAdminCap` or `PartyAdminCap`, held in a shared object rather than in a wallet. It explains how `vault` takes custody of a capability, how anyone can find the Vault for a given capability, how a lease lends the exact capability out and forces it back within the same transaction, and how plugins, withdrawal, and destruction work.

`vault` is a library. It knows nothing about Parties or works, and any `key + store` object can be vaulted.

## A Vault Holds One Capability

Suppose the release admin of *The Bodyguard* soundtrack wants its `ReleaseAdminCap` held somewhere permanent and discoverable instead of in a personal wallet. The admin calls `new` with the cap. The cap moves into a shared `Vault<ReleaseAdminCap>` at an address anyone can derive from the cap's ID, and the admin receives a `VaultAdminCap<ReleaseAdminCap>` in its place. From then on, the admin borrows the release cap from the Vault whenever it needs to act on the release, and must put it back before the transaction ends.

```move
public struct Vault<Cap: key + store> has key {
    id: UID,
    vaulted_cap_id: ID,
    vaulted_cap: Option<Referent<Cap>>,
    authorized_plugins: VecSet<TypeName>,
}

public struct VaultAdminCap<phantom Cap: key + store> has key, store {
    id: UID,
    vault_id: ID,
}

public struct VaultRegistry has key {
    id: UID,
}

public struct VaultKey<phantom Cap: key + store>(ID) has copy, drop, store;

public struct VaultAdminCapKey() has copy, drop, store;
```

The definitions show the custody model:

- **`vaulted_cap_id` is fixed.** A Vault belongs to one capability object for its whole life, whether or not it currently holds it.
- **`vaulted_cap` wraps the capability in a [`sui::borrow::Referent`](https://github.com/MystenLabs/sui/blob/2a0becb2fcc6989e492981104af67f62f2c9511a/crates/sui-framework/packages/sui-framework/sources/borrow.move).** The outer `Option` is present while the Vault is active and absent after withdrawal. The `Referent` provides the lease mechanics described below.
- **`authorized_plugins` is a set of witness types**, each allowed to borrow the capability.
- **`Vault` has `key` but not `store`.** Only this module can share it, and nothing can wrap it.
- **`VaultAdminCap` has `key + store`.** It can be transferred, wrapped, or held by another custody system.

The naming is consistent across the API: `cap` and `cap_id` mean the `VaultAdminCap`; `vaulted_cap`, `vaulted_cap_id`, and the type parameter `Cap` mean the capability in custody.

## Creating and Finding a Vault

`init` creates one shared `VaultRegistry` when the package is published. `new` derives the Vault's ID from the registry and the capability, and the `VaultAdminCap`'s ID from the Vault (excerpt; the rest builds the Vault, emits `VaultCreatedEvent`, and returns both):

```move
let mut vault_id = derived_object::claim(
    &mut registry.id,
    VaultKey<Cap>(vaulted_cap_id),
);
let vault_id_value = vault_id.to_inner();
let cap = VaultAdminCap<Cap> {
    id: derived_object::claim(&mut vault_id, VaultAdminCapKey()),
    vault_id: vault_id_value,
};
```

The key includes both the capability's type and its object ID, so each capability has exactly one canonical Vault per registry. A claimed derived ID is never released: once a capability has had a Vault, calling `new` with it again aborts, even after the capability was withdrawn or the Vault destroyed.

Create, share, and keep the admin cap in one programmable transaction:

1. Call `new(registry, vaulted_cap)`. It returns `(Vault<Cap>, VaultAdminCap<Cap>)` and emits `VaultCreatedEvent<Cap>`.
2. Call `share` on the Vault. Sharing emits nothing.
3. Transfer the `VaultAdminCap` to whoever should administer the Vault.

Anyone can then compute the Vault's address from the registry and the capability's ID:

```move
public fun derive_address<Cap: key + store>(registry: &VaultRegistry, vaulted_cap_id: ID): address {
    derived_object::derive_address(object::id(registry), VaultKey<Cap>(vaulted_cap_id))
}
```

A derived address is not proof that a Vault exists. Fetch the object at that address and check its exact type and stored `vaulted_cap_id` before relying on it. The registry's ID is in the `VaultRegistryCreatedEvent` emitted by the publish transaction of the package generation you use.

## Leases

A lease lends the capability out for the rest of the current transaction. The admin borrows with `borrow_as_admin(vault, cap)`, and an authorized plugin borrows with `borrow_as_plugin(vault, witness)`. Both return the capability and a `Borrow` receipt, and `put_back` ends the lease:

```move
public fun borrow_as_plugin<Cap: key + store, Witness: drop>(
    self: &mut Vault<Cap>,
    _: Witness,
): (Cap, Borrow) {
    assert!(
        self.authorized_plugins.contains(&type_name::with_defining_ids<Witness>()),
        EPluginNotAuthorized,
    );
    let (vaulted_cap, receipt) = self.vaulted_cap.borrow_mut().borrow();
    (vaulted_cap, receipt)
}

public fun put_back<Cap: key + store>(self: &mut Vault<Cap>, vaulted_cap: Cap, receipt: Borrow) {
    assert!(self.vaulted_cap.is_some(), EVaultEmpty);
    self.vaulted_cap.borrow_mut().put_back(vaulted_cap, receipt);
}
```

`Borrow` comes from Sui's `sui::borrow` module and is a hot potato: it has no abilities, so it cannot be stored, dropped, or carried past the transaction. That gives a lease these guarantees:

- **The capability comes back in the same transaction.** The only way to consume `Borrow` is `put_back`. A transaction that still holds it at the end fails, and none of its effects apply.
- **The exact object comes back.** The receipt records the borrowed object's ID, and `put_back` aborts if a different capability of the same type is returned.
- **It comes back to the same Vault.** The receipt records which `Referent` it came from, so a capability borrowed from one Vault cannot be returned to another.
- **One lease at a time.** While the capability is out, a second borrow or a withdrawal aborts, because the `Referent` is empty.

`put_back` needs no further authorization: the receipt already proves which Vault and which object, and gating the return would only risk leaving the capability out. `is_active` stays true during a lease, because the outer `Option` is still present.

A lease limits custody, not use. While the capability is borrowed, the borrower can do anything the capability authorizes, so authorizing a plugin trusts that plugin's code with the full power of the capability. Borrowing and returning are silent; the operations performed with the capability report their own outcomes.

For example, a Party admin who keeps its `PartyAdminCap` in a Vault calls [`party_wallet`](/move/framework/party-wallet/) like this:

```text
1. vault::borrow_as_admin<PartyAdminCap>(vault, vault_admin_cap)   -> (party_admin_cap, receipt)
2. party_wallet::redeem_balance<SUI>(party, party_admin_cap, value) -> Balance<SUI>
3. vault::put_back<PartyAdminCap>(vault, party_admin_cap, receipt)
```

## Plugins

`authorize_plugin(vault, cap, witness)` adds a witness type, identified by `type_name::with_defining_ids<Witness>()`; `revoke_plugin<Cap, Witness>(vault, cap)` removes one without the plugin's cooperation, even during a live lease. Plugins can be authorized only while the Vault is active.

The Vault accepts any type with `drop` as a witness and does not check its name, constructor visibility, or issuer. Whoever can construct a value of the witness type can borrow the capability. Authorizing a type anyone can construct, such as `u64`, lets anyone borrow it. Choose a witness whose constructor only the plugin's own module can call.

In this framework, a plugin is a separate entry-only package that borrows a capability from a Vault and calls an [Action](/move/framework/#actions-and-plugins) rather than reimplementing it. There is deliberately no Party wallet plugin; [Party Wallet](/move/framework/party-wallet/) explains why.

## Withdrawing, Restoring, and Destroying

The admin can take the capability out for good with `withdraw_vaulted_cap(vault, cap)`, which requires that no plugins remain. The Vault becomes an empty shell with the same ID, and `restore_vaulted_cap(vault, cap, vaulted_cap)` later puts the same capability back. Only the original object can restore it (excerpt; the rest emits `VaultCapabilityRestoredEvent`):

```move
self.authorize(cap);
assert!(object::id(&vaulted_cap) == self.vaulted_cap_id, EWrongCapability);
self.vaulted_cap.fill(borrow::new(vaulted_cap, ctx));
```

Once withdrawn, the capability follows its own API: it can be transferred, wrapped, frozen, destroyed, or lost. Anything that makes the exact object unavailable leaves the Vault permanently empty. When control should follow a sale, transfer the withdrawn capability and its `VaultAdminCap` together.

`destroy(vault, cap)` takes both the Vault and its `VaultAdminCap` by value and deletes them. The Vault must be empty and have no plugins. Destroying a Vault does not release its derived ID, so the capability can never be vaulted in that registry again.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another Vault's `VaultAdminCap` | `borrow_as_admin`, `withdraw_vaulted_cap`, `restore_vaulted_cap`, `authorize_plugin`, `revoke_plugin`, and `destroy` abort with `EUnauthorized` (0). |
| Authorizing a witness type that is already authorized | Aborts with `EPluginAlreadyAuthorized` (1). |
| Borrowing with a witness type that is not authorized, including on an empty Vault | `borrow_as_plugin` aborts with `EPluginNotAuthorized` (2). |
| Revoking a witness type that is not authorized | Aborts with `EPluginNotAuthorized` (2). |
| Withdrawing or destroying while any plugin is authorized | Aborts with `EPluginsRemain` (3). |
| `borrow_as_admin`, `authorize_plugin`, or `put_back` on a withdrawn Vault | Aborts with `EVaultEmpty` (4). |
| Restoring a different object than the original capability | Aborts with `EWrongCapability` (5). |
| Destroying a Vault that still holds its capability | Aborts with `EVaultNotEmpty` (6). |
| Returning a different capability of the same type | `put_back` aborts in `sui::borrow` with `EWrongValue` (1). |
| Returning a capability to a Vault it did not come from | `put_back` aborts in `sui::borrow` with `EWrongBorrow` (0). |
| Borrowing or withdrawing during a live lease, or withdrawing from an empty Vault | Aborts in `std::option` with `EOPTION_NOT_SET` (0x40001). |
| Restoring into an active Vault | Aborts in `std::option` with `EOPTION_IS_SET` (0x40000). |
| Calling `new` for a capability that has already had a Vault in this registry | Aborts in `sui::derived_object` with `EObjectAlreadyExists`. |
| Ending a transaction with a `Borrow` still held | The transaction fails to execute; nothing applies. |

## Events

| Event | Fields |
| --- | --- |
| `VaultRegistryCreatedEvent` | `registry_id`; once, at publish |
| `VaultCreatedEvent<Cap>` | `registry_id`, `vault_id`, `vaulted_cap_id`, `cap_id` |
| `VaultCapabilityWithdrawnEvent<Cap>` | `vault_id`, `vaulted_cap_id` |
| `VaultCapabilityRestoredEvent<Cap>` | `vault_id`, `vaulted_cap_id` |
| `PluginAuthorizedEvent<Cap, Witness>` | `vault_id`, `vaulted_cap_id`, `authorized_plugin_count` |
| `PluginRevokedEvent<Cap, Witness>` | `vault_id`, `vaulted_cap_id`, `authorized_plugin_count` |
| `VaultDestroyedEvent` | `vault_id` |

Only `VaultCreatedEvent` carries `cap_id`; the other events identify the admin cap through `vault_id`, from which its ID is derived with `VaultAdminCapKey()`. Authorization events carry the witness type as a type parameter, so each plugin's events form a separate typed stream. Sharing, borrowing, and `put_back` emit nothing.

## Deployment

`vault` has no dependency on `miso_music` or `miso_party`. Its [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/Published.toml) records two generations:

- **Mainnet** `published-at = "0x58dde377276ef4b67670c1ce471e122350b94dc30472ff6d082fa9e5361a9520"`, recorded after the last change to the package's sources, so it corresponds to the source on this page.
- **Testnet** `published-at = "0x9909927b5fc7d02a8b4eaf26170bcb08760d8ae67c58998650460900185f15ff"`, recorded before later source changes. The README warns that this source's state layout is incompatible with the published testnet v1 package; use a fresh publication and a fresh `VaultRegistry` rather than that one.

Each generation has its own `VaultRegistry`, created by `init` at publish, so Vault addresses differ between generations. The README does not state an audit status. The 41 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/sources/vault.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/tests/vault_tests.move).
