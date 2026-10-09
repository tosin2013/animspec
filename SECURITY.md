# Security Policy

## Reporting a vulnerability

Do **not** open a public issue. Report it privately:

- Use GitHub's private vulnerability reporting (the **Security** tab → *Report a vulnerability*), or
- Email the maintainer directly.

Please include a minimal reproducer (a spec + signal that triggers the issue) if you can.

## Supported versions

The library is pre-release. Security fixes land on `main` and are released in the next version.

| Version | Supported |
| --- | --- |
| latest (`main`) | ✅ |
| earlier | ❌ |

## Scope

- Runtime: Node.js 22 or later, on arm64 and x64.
- The library is offline: it performs no network access at runtime. Its one runtime dependency
  is `@napi-rs/canvas` (native rasteriser), pinned to an exact version.
