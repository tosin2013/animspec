# Feature Specification: Plugin Slot

**Feature Branch**: `feature/024-plugin-slot`

**Created**: 2026-10-24

**Status**: Shipped in 0.8.0

**Input**: Issue #92 ("Keep characters and other heavy content out of core via a plugin slot with a scoped determinism contract: plugin id + version, asset digest + licence, deterministic absolute-frame input, tier EXTERNAL excluded from default model offerings, and outside the core byte-identical guarantee until proven"). This is the second item on the Motion Studio integration list: Motion Studio's plugin host needs the contract agreed, or it has to guess how plugins plug in.

Maintainer decisions (2026-10-24):

- Plugins are **host-registered code**.
- A spec declares the plugins it uses, and refers to their primitives with namespaced layer types.
- External primitives are a separate tier, never offered to models by default.
- A `verifyPlugin` check runs the core gates against a plugin.
- The contract is reviewed against Motion Studio's plugin host before implementation.

## User Scenarios & Testing *(mandatory)*

Some content doesn't belong in core: heavy character packs, house styles, licensed art, and
experiments not yet ready for core review. Today there is no supported way to add a primitive
without changing the core registry. So a host either forks animspec or draws outside it, losing
validation, the camera, binds and determinism checks. Motion Studio's plugin host needs a single,
documented way in.

### User Story 1 - Register a plugin and use it from a spec (Priority: P1)

A host registers a plugin at startup: an id, a version, a licence, and one or more primitives
written exactly like core primitives. A spec declares the plugin and version it needs, and uses
its primitives as namespaced layers. Validation, binds, the camera and transparency work on
those layers as they do on core ones.

**Why this priority**: It is the slot itself. Without it there is nothing to verify or govern.

**Independent Test**: Register a fixture plugin with one primitive. A spec declaring it and using `ext:<id>/<type>` validates, renders, and reacts to the camera and a bind.

**Acceptance Scenarios**:

1. **Given** a registered plugin `acme` at version `1.2.0` with primitive `starfield`, **When** a spec declares `plugins: { acme: { version: "1.2.0" } }` and uses a layer `ext:acme/starfield`, **Then** the layer validates (its params clamped to the plugin's declared bounds) and renders.
2. **Given** a spec that uses `ext:acme/starfield` without declaring `acme`, or declares a version the host has not registered, **When** it is validated, **Then** the layer is dropped and reported with the reason.
3. **Given** a host where `acme` is not registered, **When** a spec using it is validated, **Then** the layer is dropped and reported as an unregistered plugin. The rest of the spec renders.
4. **Given** a plugin layer with a `bind`, a camera with `depth`, or a transparent background, **When** it renders, **Then** those features apply exactly as they do to core layers.
5. **Given** a plugin that tries to register a type that collides with a core type, uses an invalid id, or redefines an already-registered id at a different version, **When** it registers, **Then** registration is refused with a clear error.

---

### User Story 2 - Verify a plugin the way core is verified (Priority: P2)

A host, or Motion Studio's plugin host, runs one function against a plugin and gets a report:
whether its primitives are deterministic (twice-identical and chunk-stable), stay within palette
roles, fit the speed budget, react to the signal, and avoid file and network access. The checks
are the same ones core primitives pass.

**Why this priority**: Issue #92 says plugins sit "outside the core byte-identical guarantee until proven". This is how they are proven.

**Independent Test**: A well-behaved fixture plugin passes every check. A fixture using `Math.random` fails determinism. A fixture drawing an off-palette colour fails the palette check. A fixture reading a file fails purity.

**Acceptance Scenarios**:

1. **Given** a well-behaved plugin, **When** it is verified, **Then** the report passes every check and lists each primitive's measured cost.
2. **Given** a primitive whose output differs between two identical renders, **When** it is verified, **Then** the report fails determinism and names the primitive.
3. **Given** a primitive that draws a colour outside its palette roles, **When** it is verified, **Then** the report fails the palette check with the first offending pixel.
4. **Given** a primitive that reads a file or opens a network connection while drawing, **When** it is verified, **Then** the report fails purity.
5. **Given** a primitive over the per-primitive budget, **When** it is verified, **Then** the report fails the budget check with the measured cost.
6. **Given** core's own gates, **When** they run, **Then** they use the same checks the plugin verifier uses. There is one implementation, not two.

---

### User Story 3 - Keep models and records honest (Priority: P3)

Plugins are never offered to a model unless the caller asks for them, and every render that
uses a plugin says so.

**Why this priority**: It keeps model vocabularies small and predictable (Principle IV) and records which non-core code drew a frame.

**Independent Test**: With a plugin registered, `select` and its prompt and schema never include its primitives unless they are explicitly named. The CLI manifest lists the plugin's id, version and licence.

**Acceptance Scenarios**:

1. **Given** registered plugins, **When** a caller runs the deterministic selection for any kit, breadth or seed, **Then** no external primitive is offered.
2. **Given** a caller that explicitly names external primitives, **When** it builds a prompt or schema for that selection, **Then** they are described like core primitives, labelled external.
3. **Given** the command-line renderer and `--plugin <module>`, **When** it renders a spec using that plugin, **Then** it loads the module, renders, and records the plugin id, version and licence in its manifest, noting that plugin output is outside the core reference guarantee.
4. **Given** a plugin declares assets (spec 022's id plus sha256 records), **When** a spec uses them, **Then** they are checked like any declared asset.

### Edge Cases

- **Several plugins at once**: allowed. Types are namespaced by plugin id, so they cannot collide.
- **The same plugin registered twice at the same version**: a no-op. At a different version: refused, because one version per host keeps renders unambiguous.
- **Version matching**: exact string match in this spec (no ranges), so a spec says exactly which code drew it.
- **A plugin primitive that throws**: the layer draws nothing for that frame, and the failure is reported to the caller. Other layers still draw.
- **Plugin primitives and the vocabulary record**: not part of the core vocabulary version or record. A plugin carries its own version.
- **Golden reference frames**: core reference sets never include plugin output. A fixture plugin used by the gates lives in the verification scripts, not in the library.
- **Unregistering**: not supported in this spec. Registration is per process, at startup.

## Requirements *(mandatory)*

### Functional Requirements

**Registration and use**

- **FR-001**: The library MUST provide a way for a host to register a plugin: an id (the role-name style), a version string, a licence that MUST be a valid SPDX license expression (listed ids, `LicenseRef-` ids, `AND`/`OR`/`WITH` and parentheses), and primitives defined like core primitives (params with bounds and defaults, and a pure draw). (Licence rule added after Motion Studio's review, PR #148.)
- **FR-002**: Registration MUST refuse a bad id, a licence that is not a valid SPDX expression, a type colliding with a core type, a duplicate type within the plugin, a primitive whose params are malformed, and a second registration of the same id at a different version.
- **FR-003**: A spec MUST accept an optional `plugins` map from plugin id to `{ version }`, and layers of type `ext:<id>/<type>`.
- **FR-004**: The validator MUST keep a plugin layer only when its plugin is declared in the spec, registered in the host at exactly that version, and provides that type. It MUST clamp the layer's params to the plugin's bounds with the same sanitizer as core. It MUST drop and report anything else.
- **FR-005**: Plugin layers MUST receive the same inputs as core primitives (the absolute frame, the palette, the draw context with assets and creative mode). The draw context MUST also carry a per-layer seed derived from the render seed and the layer's position, so repeated plugin layers don't share randomness; core primitives ignore it, so no core frame moves. Plugin layers MUST work with binds, the camera, `depth` and the transparent background.
- **FR-006**: A plugin layer that throws while drawing MUST draw nothing for that frame, and MUST be reported. The rest of the frame renders.

**Verification**

- **FR-007**: The library MUST provide a plugin verifier that runs the core gates against each of a plugin's primitives and returns a report:
  - determinism: twice-identical and chunk-stable;
  - palette roles;
  - speed budget;
  - reactivity;
  - purity: no file or network access while drawing.
- **FR-008**: The core gates and the plugin verifier MUST share one implementation of these checks.

**Isolation and records**

- **FR-009**: External primitives MUST form their own tier. They MUST never be offered by the deterministic selection, and appear in a prompt or schema only when a caller names them explicitly.
- **FR-010**: Plugin output MUST be outside the core byte-identical guarantee. Core reference sets MUST never include it, and the contract MUST say so.
- **FR-011**: The command-line renderer MUST accept `--plugin <module>` (repeatable), load and register each module before validating, and record each used plugin's id, version, licence and the sha256 of its module file in the manifest. It MUST provide a `verify-plugin <module> [--json]` command with documented, stable exit codes (0 pass, 6 any check failed, 2 usage or load error).
- **FR-012**: Plugin assets MUST use spec 022's declared, digest-pinned asset records and checks.

**Constitution**

- **FR-013**: The constitution MUST be amended in the same change, as a MAJOR change (5.0.0 → 6.0.0):
  - Principle II, so the registry is the single source for core and externals enter through one documented slot;
  - Principle I, so the byte-identical guarantee covers core, and plugins that pass the verifier are "proven", not guaranteed;
  - Principle VII, naming the new public surface (registration, the verifier, the external tier);
  - "The format" entry, adding `plugins` and `ext:` types.
- **FR-014**: Every check MUST run inside the one offline verify command, using fixture plugins kept in the verification scripts.

### Key Entities

- **Plugin**: an id, a version, a licence, and a set of primitives, registered by a host for the life of the process.
- **External primitive**: a primitive provided by a plugin, addressed as `ext:<id>/<type>`, in the external tier.
- **Verification report**: per primitive, pass or fail for each check, with the measured values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing reference frames are byte-identical, in both reference sets.
- **SC-002**: A fixture plugin registers, validates, renders with a bind and the camera, and passes all five verifier checks.
- **SC-003**: Each faulty fixture fails exactly the check it targets: randomness fails determinism, an off-palette colour fails palette, a file read fails purity, an over-budget draw fails budget (4 of 4).
- **SC-004**: Across 1,000 deterministic selections with a plugin registered, 0 offer an external primitive.
- **SC-005**: Each invalid use is dropped and reported with a reason: undeclared, unregistered, wrong version, unknown type (4 of 4).
- **SC-006**: Verify passes offline, and the build stays under two minutes.

## Boundaries *(mandatory, constitution Principle VII)*

### Outcome

- **For Motion Studio's plugin host**: one documented way to add primitives, with a verifier to admit them on the same terms as core.
- **For core**: heavy, licensed or experimental content stays out, and the core guarantee stays exactly as strong as it is.

### In scope

- Plugin registration.
- The `plugins` format field and `ext:` layer types.
- Validation and rendering of plugin layers.
- The plugin verifier and its shared gate implementation.
- The external tier in selection, prompt and schema.
- CLI `--plugin` and manifest records.
- The constitution amendment, fixtures, checks and docs.

**Boundary change**: yes. A new kind of public surface (registration, the verifier, the external tier), a format change, and a MAJOR amendment.

### Out of scope

- **Version ranges and dependency resolution** between plugins.
- **Fetching or installing plugins.** The host loads its own code.
- **Sandboxing plugin code.** The purity check is a test, not a sandbox. It catches accidental I/O during probe renders in the same process, and the contract says so. Hosts isolate untrusted plugins themselves (Motion Studio runs them in a sandboxed worker).
- **A plugin marketplace or registry service.**
- **Clip sequences** (#91, spec 025).

### External dependencies

- None new.

### Non-negotiable constraints

- **Principle I (as amended)**: core output is unchanged. Plugin output is proven by the verifier, not guaranteed.
- **Principle II (as amended)**: one slot, and core stays the single source for core.
- **Principle IV**: undeclared or unregistered plugins are dropped and reported. Models see externals only when asked.
- **Principle V**: no existing frame moves.
- **Principle VI**: one offline verify command, using fixture plugins.

## Assumptions

- **Exact version strings** are enough for a first contract. Ranges can come later.
- **One version per plugin id per process** keeps a render's provenance unambiguous.
- **Fixture plugins live in `scripts/fixtures/`** so the library ships no plugin code.
- **Motion Studio review**: done in PR #148 (2026-10-24). The contract fits. Five requests are folded in: SPDX licences, a plugin-file sha256 in the manifest, a per-layer seed, `verify-plugin --json` with stable exit codes, and the purity check described as a test, not a sandbox.
- **Scope source**: issue #92, the Motion Studio integration list, and the maintainer decisions of 2026-10-24.
