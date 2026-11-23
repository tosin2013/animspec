# Adding audio: the user's job

animspec renders picture only, and the animspec-author skill does no sound
design: it never decodes, analyses or synthesises audio. When the user wants
sound, say so, hand them the picture plus `render-manifest.json`, and show
these manual steps. They need ffmpeg (step 0 of SKILL.md records whether it
is installed).

```bash
# 1. Frames to video (picture only); use the manifest's fps for -framerate
ffmpeg -framerate 30 -i frames/%06d.png -c:v libx264 -pix_fmt yuv420p picture.mp4

# 2. Add one voice or music track
ffmpeg -i picture.mp4 -i voice.wav -map 0:v -map 1:a -c:v copy -c:a aac -shortest out.mp4

# 3. Voice plus music, music ducked under the voice
ffmpeg -i picture.mp4 -i voice.wav -i music.wav -filter_complex \
  "[2:a]volume=0.3[bed];[bed][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[duck];[duck][1:a]amix=inputs=2:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -shortest out.mp4
```

`-shortest` ends the file with the picture. To start the sound later in the
picture, offset it with `-itsoffset <seconds>` before `-i voice.wav`, using the
manifest's `segmentOffset` and `cues[]`.

Finished mixing, loudness and cue timing belong to a studio or director tool
when one is present: it reads `render-manifest.json` (`fps`, `cues[]`,
`segmentOffset`) to place the sound.
