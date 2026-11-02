#!/usr/bin/env bash
# Downloads and prepares the guitar recordings in public/samples/guitar/: one file per semitone from
# D2 to E6, so notes are never pitch-shifted (shifting made them sound thin and metallic).
# Source: pre-rendered General MIDI soundfonts by gleitz/midi-js-soundfonts (see README for licences).
# Each file: leading silence trimmed, a warm tone (gentle cut above ~3.2 kHz, which removes the buzzy,
# sitar-like edge), a natural decay after the attack like a real string, cut to at most 4.5 s with a fade,
# mono 96 kbps.
# Usage: scripts/prepare-guitar-samples.sh <Soundfont>/<instrument>   e.g. MusyngKite/acoustic_guitar_nylon
set -euo pipefail
set_name=${1:?soundfont/instrument, e.g. MusyngKite/acoustic_guitar_nylon}
src="https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/${set_name}-mp3"
out=public/samples/guitar
tmp=$(mktemp -d)
rm -rf "$out" && mkdir -p "$out"
flats=(C Db D Eb E F Gb G Ab A Bb B)
local_names=(C Cs D Ds E F Fs G Gs A As B)
for midi in $(seq 38 88); do
  pc=$((midi % 12)); oct=$((midi / 12 - 1))
  remote="${flats[$pc]}${oct}.mp3"; local="${local_names[$pc]}${oct}.mp3"
  curl -sf -o "$tmp/$remote" "$src/$remote"
  ffmpeg -v error -y -i "$tmp/$remote" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,lowpass=f=3200,volume='if(lt(t,0.25),1,exp(-(t-0.25)/1.4))':eval=frame,afade=t=out:st=3.7:d=0.8,atrim=0:4.5" \
    -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k "$out/$local"
done
# One gain for the whole set (keeps notes balanced with each other) so the loudest peak sits at -3 dB.
peak=$(for f in "$out"/*.mp3; do ffmpeg -i "$f" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p'; done | sort -g | tail -1)
gain=$(awk -v p="$peak" 'BEGIN { print -3 - p }')
for f in "$out"/*.mp3; do
  ffmpeg -v error -y -i "$f" -af "volume=${gain}dB" -codec:a libmp3lame -b:a 96k "$tmp/n.mp3" && mv "$tmp/n.mp3" "$f"
done
echo "$set_name" > "$out/SOURCE.txt"
rm -rf "$tmp"
ls "$out"/*.mp3 | wc -l
