# Data Model: Second Tone

| Item | Value |
| --- | --- |
| Role name | `fg2` (reserved by primitives; validated by spec 020's role rules) |
| Creative colour | `roles.fg2` when creative mode is on and given |
| Monochrome value | `#808080` (even bg–fg mix, same on black and white) |
| Pattern letter | `b` on `grid` and `checker`; a designed cell (opaque, static) |

Pattern letters after this feature: `.` off · `#` fg · `a` accent · `b` second tone · `~` spectrum.
Any other letter reads as `.` and is reported, as before.
