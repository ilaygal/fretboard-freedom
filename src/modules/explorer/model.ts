import {
  accidentalPreferenceOf,
  getScale,
  mod12,
  pitchClassAt,
  preferredTonic,
  speller,
  type FretPos,
  type FretRange,
  type IntervalSymbol,
  type LabelMode,
  type ScaleId,
  type Tuning,
} from '@/theory';
import { markersForNotes, type FretMarker, type NoteInContext } from '@/components/fretboard';
import type { Settings } from '@/data';

export const FRIENDLY_SCALES: ScaleId[] = ['minorPentatonic', 'majorPentatonic', 'blues', 'major', 'minor'];
export const MORE_SCALES: ScaleId[] = ['dorian', 'mixolydian', 'lydian', 'phrygian', 'harmonicMinor', 'melodicMinor', 'locrian'];

export const FOCUS_SPAN = 5; // frets in a focus window: a comfortable hand position

export interface ExplorerState {
  tonicPc: number;
  scale: ScaleId;
  labelMode: LabelMode;
  focus: FretRange | null;
}

export interface ExplorerView {
  tonic: string;
  notes: NoteInContext[];
  markers: FretMarker[];
  spell: (pc: number) => string;
}

/** Everything the explorer draws, derived from its state and the player's settings. */
export function buildExplorerView(state: ExplorerState, settings: Settings, tuning: Tuning, range: FretRange): ExplorerView {
  const tonic = preferredTonic(state.tonicPc, state.scale);
  const scale = getScale(tonic, state.scale, { strict: settings.strictSpelling });
  const notes: NoteInContext[] = scale.notes.map((n) => ({
    pc: n.pc,
    name: n.name,
    interval: n.interval,
    role: n.interval === 'R' ? 'root' : n.interval === 'b5' && state.scale === 'blues' ? 'blue' : 'scale',
  }));
  const spell = speller(scale.notes, accidentalPreferenceOf(tonic, state.scale, settings.accidentals));
  const focus = state.focus;
  const markers = markersForNotes(tuning, range, notes, state.labelMode).map((m) =>
    focus && (m.pos.fret < focus.from || m.pos.fret > focus.to) ? { ...m, role: 'ghost' as const } : m,
  );
  return { tonic: scale.tonic, notes, markers, spell };
}

/** Moves a focus window by `delta` frets, keeping it on the neck. */
export function shiftFocus(focus: FretRange, delta: number, maxFret: number): FretRange {
  const span = focus.to - focus.from;
  const from = Math.min(Math.max(0, focus.from + delta), Math.max(0, maxFret - span));
  return { from, to: from + span };
}

export interface TapInfo {
  name: string;
  pos: FretPos;
  interval?: IntervalSymbol;
}

export function describeTap(view: ExplorerView, tuning: Tuning, pos: FretPos): TapInfo {
  const pc = mod12(pitchClassAt(tuning, pos));
  const n = view.notes.find((x) => x.pc === pc);
  return { name: n?.name ?? view.spell(pc), pos, interval: n?.interval };
}
