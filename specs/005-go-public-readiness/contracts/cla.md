# Contract: CLA

The signed-licence gate. Outside contributions require a signed Contributor Licence Agreement
(constitution, "before going public").

## The gate

- The CLA text lives in `CLA.md` (single source).
- A signature is recorded in a committed list, linked to the signer's identity.
- CI checks the list: a pull request from an identity with no signature is blocked from merging.

## The sign-up flow

1. A contributor reads `CLA.md`.
2. They sign by recording their agreement (name + identity) in the signature list, in a pull
   request.
3. A maintainer merges the signature entry.
4. Their subsequent pull requests pass the CLA gate.

## Rules

- The signature list is the single source; it is not hand-synchronised with anything else.
- A signature is tied to the version of `CLA.md` it agrees to; a material change to the text
  requires new signatures.
