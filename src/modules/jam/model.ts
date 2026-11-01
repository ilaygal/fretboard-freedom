import {
  getScale,
  mod12,
  noteLabel,
  pitchClassAt,
  pitchClassName,
  preferredTonic,
  roleOverChord,
  symbolFromSemitones,
  allPositions,
  windowAround,
  posKey,
  type ChordInfo,
  type FretRange,
  type LabelMode,
  type ScaleId,
  type ScalePosition,
  type Tuning,
} from '@/theory';
import type { FretMarker, NoteRole } from '@/components/fretboard';
import { FRIENDLY_KEYS, PROGRESSIONS, STYLES, getProgression, getStyle, type StyleId } from '@/content/backing';
import { BAR_TICKS, PPQ, arrange, chordsFor } from '@/domain/backing/arrange';
import type { Rng } from '@/domain/drills/engine';

export interface JamChoice {
  tonicPc: number;
  progressionId: string;
  styleId: StyleId;
  bpm: number;
  scale: ScaleId;
}

/** How much help the neck gives while you play. */
export type Wheels = 'map' | 'chordTones' | 'home' | 'off';
export const WHEELS: Wheels[] = ['map', 'chordTones', 'home', 'off'];

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

const STYLE_IDS = STYLES.map((s) => s.id);

/**
 * "Surprise me": a random groove, progression and key. Leans toward the styles the player said
 * they like and toward guitar-friendly keys, but anything can come up.
 */
export function randomJam(rng: Rng, likedStyles: readonly string[] = [], avoid?: JamChoice): JamChoice {
  const liked = likedStyles.filter((s): s is StyleId => (STYLE_IDS as string[]).includes(s));
  for (let attempt = 0; attempt < 8; attempt++) {
    const styleId = liked.length > 0 && rng() < 0.7 ? pick(rng, liked) : pick(rng, STYLE_IDS);
    const fits = PROGRESSIONS.filter((p) => p.styles.includes(styleId));
    const prog = pick(rng, fits);
    const keys = FRIENDLY_KEYS[prog.mode];
    const tonicName = rng() < 0.75 ? pick(rng, keys) : null;
    const tonicPc = tonicName ? pitchClassOfName(tonicName) : Math.floor(rng() * 12);
    const style = getStyle(styleId);
    const bpm = clampToStyle(styleId, Math.round((style.bpm.default + (rng() - 0.5) * 16) / 2) * 2);
    const choice = { tonicPc, progressionId: prog.id, styleId, bpm, scale: prog.scales[0]! };
    if (!avoid || avoid.progressionId !== choice.progressionId || avoid.tonicPc !== choice.tonicPc) return choice;
  }
  return { ...avoid!, tonicPc: mod12(avoid!.tonicPc + 5) };
}

const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchClassOfName(name: string): number {
  return NATURAL[name] ?? 0;
}

export function clampToStyle(styleId: StyleId, bpm: number): number {
  const { min, max } = getStyle(styleId).bpm;
  return Math.min(max, Math.max(min, bpm));
}

/** Home note name, spelled for the key (Bb major, C# minor...). */
export function jamTonic(choice: Pick<JamChoice, 'tonicPc' | 'progressionId'>): string {
  const mode = getProgression(choice.progressionId).mode;
  return preferredTonic(choice.tonicPc, mode === 'minor' ? 'minor' : 'major');
}

export function jamChords(choice: JamChoice, strict = false): ChordInfo[] {
  return chordsFor(jamTonic(choice), getProgression(choice.progressionId), getStyle(choice.styleId), strict);
}

/** The audio track for a jam; beat markers are quarter notes. */
export function jamTrack(choice: JamChoice, strict = false) {
  const chords = jamChords(choice, strict);
  const arr = arrange(getStyle(choice.styleId), chords);
  return { chords, track: { events: arr.events, totalTicks: arr.totalTicks, bars: arr.bars, barTicks: BAR_TICKS, beatTicks: PPQ } };
}

/** When switching style, keep the progression if it suits the new style, else pick the first that does. */
export function withStyle(choice: JamChoice, styleId: StyleId): JamChoice {
  const prog = getProgression(choice.progressionId);
  const progressionId = prog.styles.includes(styleId)
    ? prog.id
    : PROGRESSIONS.find((p) => p.styles.includes(styleId) && p.mode === prog.mode)?.id ??
      PROGRESSIONS.find((p) => p.styles.includes(styleId))!.id;
  const next = getProgression(progressionId);
  return {
    ...choice,
    styleId,
    progressionId,
    bpm: getStyle(styleId).bpm.default,
    scale: next.scales.includes(choice.scale) ? choice.scale : next.scales[0]!,
  };
}

export function withProgression(choice: JamChoice, progressionId: string): JamChoice {
  const prog = getProgression(progressionId);
  return { ...choice, progressionId, scale: prog.scales.includes(choice.scale) ? choice.scale : prog.scales[0]! };
}

export interface NeckInput {
  tuning: Tuning;
  range: FretRange;
  tonic: string;
  scale: ScaleId;
  chord: ChordInfo;
  /** The chord coming next; shown as targets in the last beat before it arrives. */
  upcoming: ChordInfo | null;
  labelMode: LabelMode;
  wheels: Wheels;
  position: ScalePosition | null;
  strict?: boolean;
}

/**
 * What the neck shows while the band plays: the key's home notes, the current chord's notes,
 * the rest of the scale, blue notes, and (when the change is one beat away) the next chord's notes.
 */
export function jamMarkers(input: NeckInput): FretMarker[] {
  const { tuning, range, tonic, scale, chord, upcoming, labelMode, wheels, position } = input;
  if (wheels === 'off') return [];
  const scaleInfo = getScale(tonic, scale, { strict: input.strict });
  const keyPc = scaleInfo.notes[0]!.pc;
  const scalePcs = scaleInfo.notes.map((n) => n.pc);
  const inPosition = position ? new Set(position.notes.map(posKey)) : null;
  const upcomingPcs = new Set(upcoming ? upcoming.tones.map((t) => t.pc) : []);
  const chordPcs = new Set(chord.tones.map((t) => t.pc));
  const nameOf = (pc: number) =>
    scaleInfo.notes.find((n) => n.pc === pc)?.name ??
    chord.tones.find((t) => t.pc === pc)?.name ??
    upcoming?.tones.find((t) => t.pc === pc)?.name ??
    pitchClassName(pc, 'sharps');

  const out: FretMarker[] = [];
  for (const pos of allPositions(tuning, range)) {
    const pc = pitchClassAt(tuning, pos);
    const over = roleOverChord(pc, chord, keyPc, scale, scalePcs);
    let role: NoteRole | null;
    if (pc === keyPc) role = 'root';
    else if (upcoming && upcomingPcs.has(pc) && !chordPcs.has(pc)) role = 'target';
    else if (over === 'chordRoot' || over === 'chordTone') role = 'chord';
    else if (over === 'blue') role = 'blue';
    else if (over === 'avoid') role = 'avoid';
    else if (over === 'scale') role = 'scale';
    else role = null;
    if (role === null) continue;
    if (wheels === 'chordTones' && !(role === 'root' || role === 'chord' || role === 'target')) continue;
    if (wheels === 'home' && role !== 'root') continue;

    if (inPosition && !inPosition.has(posKey(pos))) {
      const nearBox = position && pos.fret >= position.span.from && pos.fret <= position.span.to;
      if (!(nearBox && (role === 'chord' || role === 'target'))) role = 'ghost';
    }
    const name = nameOf(pc);
    const interval = symbolFromSemitones(mod12(pc - keyPc));
    out.push({
      pos,
      role,
      label: noteLabel(labelMode, name, interval),
      description: `${name}, string ${pos.string} fret ${pos.fret}`,
    });
  }
  return out;
}

/** Next jam position for a bar/beat counter: which chord is sounding and which comes next. */
export function chordAt(chords: readonly ChordInfo[], bar: number): { now: ChordInfo; next: ChordInfo } {
  const n = chords.length;
  return { now: chords[mod12Safe(bar, n)]!, next: chords[mod12Safe(bar + 1, n)]! };
}

function mod12Safe(i: number, n: number) {
  return ((i % n) + n) % n;
}

/** Neck range around a hand position (kept as a named export for the jam screen). */
export const zoomTo = windowAround;
