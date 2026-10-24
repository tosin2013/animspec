# Data Model: Plugin Slot

## Plugin (host-registered)

| Field | Rule |
| --- | --- |
| id | `ROLE_NAME` |
| version | a non-empty string of at most 64 characters, matched exactly |
| licence | a non-empty string of at most 128 characters (an SPDX id recommended) |
| primitives | `PrimitiveDef[]` with the core param rules; type `ROLE_NAME`, unique within the plugin |

Registered primitives become `{ ...def, type: "ext:<id>/<type>", tier: "external" }`.

## `AnimSpec.plugins`

`Record<id, { version: string }>`. Invalid entries are dropped and reported.

## Layer type

`ext:<id>/<type>`. It is kept only when the plugin is declared, registered at the same
version, and provides the type.

## Verification report

```text
{ ok: boolean, primitives: [{ type, checks: [{ name: "determinism"|"palette"|"budget"|"reactivity"|"purity", pass, measured, allowed }] }] }
```
