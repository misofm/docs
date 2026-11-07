---
title: Vault
description: Hold a capability in a shared, discoverable object and lend it out one transaction at a time.
---

`vault` holds an admin capability, such as a `ReleaseAdminCap` or `PartyAdminCap`, in a shared object instead of a wallet. Anyone can find the Vault for a capability. A lease lends the exact capability out and forces it back within the same transaction.

`vault` is a library that knows nothing about Parties or works. Any `key + store` object can be vaulted.

## A Vault Holds One Capability

The release admin of *The Bodyguard* soundtrack calls `new` with its `ReleaseAdminCap`. The cap moves into a shared `Vault<ReleaseAdminCap>` at an address anyone can derive from the cap's ID. The admin receives a `VaultAdminCap<ReleaseAdminCap>`, borrows the release cap to act, and must return it before the transaction ends.

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

- **`vaulted_cap_id`** is fixed. A Vault belongs to one capability object for life, held or not.
- **`vaulted_cap`** wraps the capability in a [`sui::borrow::Referent`](https://github.com/MystenLabs/sui/blob/2a0becb2fcc6989e492981104af67f62f2c9511a/crates/sui-framework/packages/sui-framework/sources/borrow.move), which provides the lease mechanics. The outer `Option` is present while the Vault is active, absent after withdrawal.
- **`authorized_plugins`** is the set of witness types allowed to borrow.
- **`Vault`** has `key` but not `store`: only this module can share it, and nothing can wrap it.
- **`VaultAdminCap`** has `key + store`: transfer or wrap it, or hand it to another custody system.

Naming: `cap` and `cap_id` mean the `VaultAdminCap`. `vaulted_cap`, `vaulted_cap_id`, and `Cap` mean the capability in custody.

## Creating and Finding a Vault

`init` creates one shared `VaultRegistry` at publish. `new` derives the Vault's ID from the registry and capability, and the `VaultAdminCap`'s ID from the Vault (excerpt; the rest builds the Vault, emits `VaultCreatedEvent`, and returns both):

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

The key includes the capability's type and object ID, so each capability has one canonical Vault per registry. A claimed ID is never released: once a capability has had a Vault, `new` aborts for it, even after withdrawal or destruction.

In one programmable transaction:

1. Call `new(registry, vaulted_cap)`. It returns `(Vault<Cap>, VaultAdminCap<Cap>)` and emits `VaultCreatedEvent<Cap>`.
2. Call `share` on the Vault. Sharing emits nothing.
3. Transfer the `VaultAdminCap` to whoever should administer the Vault.

Anyone can then compute the Vault's address:

```move
public fun derive_address<Cap: key + store>(registry: &VaultRegistry, vaulted_cap_id: ID): address {
    derived_object::derive_address(object::id(registry), VaultKey<Cap>(vaulted_cap_id))
}
```

A derived address does not prove a Vault exists. Fetch the object and check its exact type and `vaulted_cap_id`. Find the registry ID in the `VaultRegistryCreatedEvent` of your package generation's publish transaction.

## Leases

A lease lends the capability for the rest of the transaction. The admin calls `borrow_as_admin(vault, cap)`. An authorized plugin calls `borrow_as_plugin(vault, witness)`. Both return the capability and a `Borrow` receipt. `put_back` ends the lease:

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

`Borrow` is a hot potato from `sui::borrow`: no abilities, so it cannot be stored, dropped, or carried past the transaction. Guarantees:

- **Same transaction.** Only `put_back` consumes `Borrow`. A transaction still holding it at the end fails and applies nothing.
- **Same object.** The receipt records the object's ID. `put_back` aborts for a different capability of the same type.
- **Same Vault.** The receipt records its `Referent`.
- **One lease at a time.** While the capability is out, a second borrow or a withdrawal aborts because the `Referent` is empty.

`put_back` needs no authorization: the receipt proves Vault and object, and gating the return would only risk leaving the capability out. `is_active` stays true during a lease because the outer `Option` is still present.

A lease limits custody, not use. A borrower can do anything the capability authorizes, so authorizing a plugin trusts its code with the capability's full power. Borrowing and returning are silent. Operations performed with the capability report their own outcomes.

A Party admin who keeps its `PartyAdminCap` in a Vault calls [`party_wallet`](/move/framework/party-wallet/) like this:

```text
1. vault::borrow_as_admin<PartyAdminCap>(vault, vault_admin_cap)   -> (party_admin_cap, receipt)
2. party_wallet::redeem_balance<SUI>(party, party_admin_cap, value) -> Balance<SUI>
3. vault::put_back<PartyAdminCap>(vault, party_admin_cap, receipt)
```

## Plugins

`authorize_plugin(vault, cap, witness)` adds a witness type, identified by `type_name::with_defining_ids<Witness>()`. `revoke_plugin<Cap, Witness>(vault, cap)` removes one without the plugin's cooperation, even during a live lease. Plugins can be authorized only while the Vault is active.

The Vault accepts any `drop` type as a witness and checks no name, constructor visibility, or issuer. Whoever can construct the witness can borrow the capability. Authorizing a type anyone can construct, such as `u64`, lets anyone borrow it. Choose a witness only the plugin's module can construct.

A plugin here is a separate entry-only package that borrows a capability and calls an [Action](/move/framework/#actions-and-plugins) instead of reimplementing it. There is deliberately no Party wallet plugin; see [Party Wallet](/move/framework/party-wallet/).

## Withdrawing, Restoring, and Destroying

`withdraw_vaulted_cap(vault, cap)` takes the capability out and requires no plugins. The Vault becomes an empty shell with the same ID. `restore_vaulted_cap(vault, cap, vaulted_cap)` puts the same object back and nothing else (excerpt; the rest emits `VaultCapabilityRestoredEvent`):

```move
self.authorize(cap);
assert!(object::id(&vaulted_cap) == self.vaulted_cap_id, EWrongCapability);
self.vaulted_cap.fill(borrow::new(vaulted_cap, ctx));
```

A withdrawn capability follows its own API: transfer, wrap, freeze, destroy, or lose it. If the exact object becomes unavailable, the Vault stays empty forever. To move control in a sale, transfer the withdrawn capability and its `VaultAdminCap` together.

`destroy(vault, cap)` takes the Vault and its `VaultAdminCap` by value and deletes them. The Vault must be empty with no plugins. Destroying does not release the derived ID, so the capability can never be vaulted in that registry again.

## Failure Cases

| Situation | Result |
| --- | --- |
| Another Vault's `VaultAdminCap` in `borrow_as_admin`, `withdraw_vaulted_cap`, `restore_vaulted_cap`, `authorize_plugin`, `revoke_plugin`, or `destroy` | `EUnauthorized` (0) |
| Authorizing an already authorized witness type | `EPluginAlreadyAuthorized` (1) |
| `borrow_as_plugin` with an unauthorized witness type, including on an empty Vault | `EPluginNotAuthorized` (2) |
| Revoking an unauthorized witness type | `EPluginNotAuthorized` (2) |
| Withdrawing or destroying while any plugin is authorized | `EPluginsRemain` (3) |
| `borrow_as_admin`, `authorize_plugin`, or `put_back` on a withdrawn Vault | `EVaultEmpty` (4) |
| Restoring a different object than the original capability | `EWrongCapability` (5) |
| Destroying a Vault that still holds its capability | `EVaultNotEmpty` (6) |
| `put_back` of a different capability of the same type | `sui::borrow::EWrongValue` (1) |
| `put_back` of a capability to a Vault it did not come from | `sui::borrow::EWrongBorrow` (0) |
| Borrowing or withdrawing during a live lease, or withdrawing from an empty Vault | `std::option::EOPTION_NOT_SET` (0x40001) |
| Restoring into an active Vault | `std::option::EOPTION_IS_SET` (0x40000) |
| `new` for a capability that already had a Vault in this registry | `sui::derived_object::EObjectAlreadyExists` |
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

Only `VaultCreatedEvent` carries `cap_id`; elsewhere derive the admin cap's ID from `vault_id` with `VaultAdminCapKey()`. Authorization events carry the witness type as a type parameter, so each plugin has its own typed event stream. Sharing, borrowing, and `put_back` emit nothing.

## Deployment

No dependency on `miso_music` or `miso_party`. [`Published.toml`](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/Published.toml) records two generations:

- **Mainnet** `published-at = "0x58dde377276ef4b67670c1ce471e122350b94dc30472ff6d082fa9e5361a9520"`, recorded after the last source change, so it matches this source.
- **Testnet** `published-at = "0x9909927b5fc7d02a8b4eaf26170bcb08760d8ae67c58998650460900185f15ff"`, recorded before later source changes. The README warns this source's state layout is incompatible with the published testnet v1 package. Use a fresh publication and `VaultRegistry`.

Each generation has its own `VaultRegistry`, so Vault addresses differ between generations. The README states no audit status. The 41 unit tests pass locally. See [Compatibility and Deployments](/move/framework/#compatibility-and-deployments).

Excerpts on this page are from [`misofm/framework`](https://github.com/misofm/framework/tree/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault) at commit `ffbc8f0b2852932f879f00130117c5b597ea7db7`, © Miso Labs, Inc., licensed under [FSL-1.1-ALv2](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/LICENSE.md). The docs' Apache license does not relicense them.

Source: [README](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/README.md), [module](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/sources/vault.move), and [tests](https://github.com/misofm/framework/blob/ffbc8f0b2852932f879f00130117c5b597ea7db7/vault/tests/vault_tests.move).
