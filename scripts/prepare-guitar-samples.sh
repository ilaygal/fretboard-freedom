#!/usr/bin/env bash
# Rebuilds public/samples/guitar-acoustic from the tonejs-instruments acoustic guitar recordings
# (npm package tonejs-instrument-guitar-acoustic-mp3, CC BY 3.0 samples by Nicholas Brosowsky).
# Every semitone D2..D5 is kept, so notes are almost never pitch-shifted (shifting is what made
# notes sound thin and synthetic). Each file: leading silence trimmed, cut to at most 4.5 s with a
# fade, mono 96 kbps.
# Usage: scripts/prepare-guitar-samples.sh <unpacked-package-dir>
set -euo pipefail
src=${1:?path to the unpacked npm package}
out=public/samples/guitar-acoustic
rm -f "$out"/*.mp3
mkdir -p "$out"
for f in "$src"/*.mp3; do
  name=$(basename "$f")
  ffmpeg -v error -y -i "$f" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,afade=t=out:st=3.7:d=0.8,atrim=0:4.5" \
    -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k "$out/$name"
done
ls "$out" | wc -l
