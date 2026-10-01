# Golden-file intended changes

Every intended change to `golden/hashes.json` needs an entry here — moved hashes and added
reference cases alike. One row per change. A golden update without a matching entry is
rejected in review.

| date | primitive | cases | reason | spec |
|------|-----------|-------|--------|------|
| 2026-10-01 | led, sprite | icon:* (12 added) | reference cases added to prove icon output is unchanged by the loader rewrite; no rendering change | 001 |
