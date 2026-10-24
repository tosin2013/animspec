# Quickstart: Sprite Sheets

1. Run `npm run verify`. All gates pass, and the vocabulary record is at 16.
2. Compare the golden hashes key by key against `main`. Expect 0 changed, with
   `image:sheet-*@*` added (9 per set).
3. Run `npm run showcase:generate`, then render a frame strip of `sheet-walk`. The legs
   change pose frame by frame.
