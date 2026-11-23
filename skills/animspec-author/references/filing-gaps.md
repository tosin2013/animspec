# Filing a vocabulary gap

Read this after you have verified the gap and substituted deliberately (steps
1 and 2 of "When the vocabulary can't draw it" in SKILL.md).

## The "Unsupported animation" issue

File one issue per gap in the animspec repo, after searching open issues for
the same capability. The repo's **"Unsupported animation"** template ("Something
you wanted a spec to draw that the AnimSpec vocabulary can't draw today") has
these fields:

- `wanted`: the animation in plain words, what drives it, why it matters
- `expected`: one line, what should have happened
- `actual`: one line, what happened instead (including the substitution)
- `renderer`: renderer or plugin and version, e.g. `animspec@0.12.0 (CLI)`
- `spec_hash`: a hash of the spec, **not the spec itself**; never paste
  private specs into a public issue
- `range`: the frame or time range where the gap shows, if known
- `content_type`: documentary / podcast / explainer / other
- `dropped`: the `validateAnimSpec` output, if any
- `versions`: the vocabulary version and the `@napi-rs/canvas` version

The template's own checks apply: confirm you could not draw it by changing an
existing primitive's params, and that the gap is about drawing frames, not
audio, encoding or scheduling.

## Two neighbouring cases use different vehicles

- **A brand-new primitive** goes through the **"Primitive proposal"** template
  (title `Primitive: <type>`). It requires the type, category, what it draws
  and why no existing primitive can, params with types, bounds and defaults,
  and the four style answers. It forbids code in the issue.
- **A new action or param on an existing primitive** is a plain feature issue
  citing the attempted use case.

## If you cannot file

With no GitHub access (step 0 of SKILL.md records it), return the completed
template fields in your report so the operator can file them verbatim. A gap
reported with its fields filled is filed work; a gap mentioned in passing is
lost.
