import {
  cagedVoicings,
  dropVoicings,
  hasStandardIntervals,
  midiAt,
  mod12,
  noteLabel,
  pitchClassAt,
  positionsOfPitchClasses,
  triadVoicings,
  voiceLeadPath,
  type ChordInfo,
  type ChordTypeId,
  type FretPos,
  type FretRange,
  type LabelMode,
  type Tuning,
  type Voicing,
  type VoicingKind,
} from '@/theory';
import type { FretMarker } from '@/components/fretboard';

/** Chord types offered in the lookup, most common first. */
export const LOOKUP_TYPES: ChordTypeId[] = ['maj', 'min', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim', 'aug', 'm7b5', 'dim7', '6', 'm6', 'add9'];

const THREE_NOTE: ChordTypeId[] = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'];

/** Which shape families make sense for a chord type in this tuning, simplest first. */
export function kindsFor(type: ChordTypeId, tuning: Tuning): VoicingKind[] {
  const out: VoicingKind[] = [];
  if (THREE_NOTE.includes(type)) out.push('triad');
  if ((type === 'maj' || type === 'min') && hasStandardIntervals(tuning)) out.push('caged');
  if (!THREE_NOTE.includes(type)) out.push('drop2', 'drop3');
  return out;
}

export function voicingsFor(tuning: Tuning, chord: ChordInfo, kind: VoicingKind, maxFret: number): Voicing[] {
  switch (kind) {
    case 'triad':
      return triadVoicings(tuning, chord, maxFret);
    case 'caged':
      return cagedVoicings(tuning, chord, maxFret);
    case 'drop2':
    case 'drop3':
      return dropVoicings(tuning, chord, kind, maxFret);
  }
}

function toneAt(tuning: Tuning, chord: ChordInfo, pos: FretPos) {
  const pc = pitchClassAt(tuning, pos);
  return chord.tones.find((t) => t.pc === pc);
}

/**
 * The neck for one voicing: its notes bright (root in the root colour), and, faintly,
 * every other place the chord's notes live, so you see the chord is everywhere.
 */
export function voicingMarkers(
  tuning: Tuning,
  chord: ChordInfo,
  voicing: Voicing | null,
  labelMode: LabelMode,
  range: FretRange,
  showAll: boolean,
): FretMarker[] {
  const lit = new Set((voicing?.notes ?? []).map((n) => `${n.string}:${n.fret}`));
  const out: FretMarker[] = [];
  const all = showAll ? positionsOfPitchClasses(tuning, chord.tones.map((t) => t.pc), range) : voicing?.notes ?? [];
  for (const pos of all) {
    const tone = toneAt(tuning, chord, pos);
    if (!tone) continue;
    const isLit = lit.has(`${pos.string}:${pos.fret}`);
    out.push({
      pos,
      role: !isLit ? 'ghost' : tone.interval === 'R' ? 'root' : 'chord',
      label: noteLabel(labelMode, tone.name, tone.interval),
      description: `${tone.name}, string ${pos.string} fret ${pos.fret}`,
    });
  }
  return out;
}

/** Index of the voicing nearest a fret (used to keep your place when changing chord or shape family). */
export function nearestVoicing(vs: Voicing[], fret: number): number {
  if (vs.length === 0) return -1;
  let best = 0;
  vs.forEach((v, i) => {
    const d = Math.abs((v.span.from + v.span.to) / 2 - fret);
    const bd = Math.abs((vs[best]!.span.from + vs[best]!.span.to) / 2 - fret);
    if (d < bd) best = i;
  });
  return best;
}

/** Lines from each voice of one voicing to where it goes in the next (voice-leading view). */
export function voiceMoves(tuning: Tuning, a: Voicing, b: Voicing): { from: FretPos; to: FretPos }[] {
  const sa = [...a.notes].sort((x, y) => midiAt(tuning, x) - midiAt(tuning, y));
  const sb = [...b.notes].sort((x, y) => midiAt(tuning, x) - midiAt(tuning, y));
  if (sa.length !== sb.length) return [];
  return sa
    .map((from, i) => ({ from, to: sb[i]! }))
    .filter((m) => m.from.string !== m.to.string || m.from.fret !== m.to.fret);
}

export type TrainerKind = 'triad' | 'drop2';

/**
 * The trainer's plan: one voicing per bar inside the window, voice-led. If the window can't hold
 * every chord, it slides up (then down) to the nearest window that can.
 */
export function trainerPlan(
  tuning: Tuning,
  chords: ChordInfo[],
  kind: TrainerKind,
  window: FretRange,
  maxFret: number,
): { window: FretRange; path: Voicing[] } | null {
  const candidates = chords.map((c) =>
    kind === 'triad' ? triadVoicings(tuning, c, maxFret) : dropVoicings(tuning, c, 'drop2', maxFret),
  );
  const span = window.to - window.from;
  for (let d = 0; d <= maxFret; d++) {
    for (const from of [window.from + d, window.from - d]) {
      if (from < 0 || from + span > maxFret) continue;
      const w = { from, to: from + span };
      const path = voiceLeadPath(tuning, candidates, w);
      if (path) return { window: w, path };
    }
  }
  return null;
}

/** Notes a player tapped, as pitch classes with the lowest as the bass (chord builder). */
export function tappedNotes(tuning: Tuning, taps: FretPos[]): { pcs: number[]; bassPc: number | null } {
  if (taps.length === 0) return { pcs: [], bassPc: null };
  const midis = taps.map((p) => midiAt(tuning, p));
  const low = Math.min(...midis);
  return { pcs: [...new Set(midis.map(mod12))], bassPc: mod12(low) };
}

/** Tapping a string again replaces its note (one note per string, like a real chord); same spot clears it. */
export function toggleTap(taps: FretPos[], p: FretPos): FretPos[] {
  const same = taps.find((x) => x.string === p.string);
  const rest = taps.filter((x) => x.string !== p.string);
  if (same && same.fret === p.fret) return rest;
  return [...rest, p];
}
