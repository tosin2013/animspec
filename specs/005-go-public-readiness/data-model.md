# Data Model: Go-Public Readiness

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Contributor

A person or organisation whose pull request may be merged.

| Field | Meaning |
| --- | --- |
| `identity` | the GitHub account(s) of the author |
| `cla` | whether a signed CLA is on record for that identity |

**Rule**: a pull request from an identity with no signed CLA is blocked from merging.

## CLA record

The list of signed licence agreements.

| Field | Meaning |
| --- | --- |
| `signer` | the identity that signed |
| `date` | when it was signed |
| `agreement` | the version of the CLA text (`CLA.md`) agreed to |

**Rule**: the record is committed and checked by CI; the text in `CLA.md` is the single source.

## Primitive proposal

An issue filed from the template.

| Field | Meaning |
| --- | --- |
| `type` | the proposed primitive type name |
| `category` | the category it fits |
| `what it draws` | what it renders, and why no existing primitive can |
| `params` | the proposed params and their bounds/defaults |

**Rule**: a proposal that duplicates an existing primitive is redirected to a param change.

## Secret scan

A pass/fail check over the repository.

| Field | Meaning |
| --- | --- |
| `result` | pass (no committed secret) or fail |

**Rule**: must pass before the first public push.

## Gallery

The generated reference thumbnails.

| Field | Meaning |
| --- | --- |
| `image` | `gallery/<type>.png`, one per primitive |
| `source` | the primitive's validated default layer at a fixed frame |

**Rule**: generated from the registry + reference frames; a stale gallery fails the freshness check.

## Legal review

The recorded decision.

| Field | Meaning |
| --- | --- |
| `decision` | complete (or pending) |
| `scope` | the licence (Apache-2.0) and the CLA text |

**Rule**: the launch tasks fail-closed until the decision is recorded as complete.
