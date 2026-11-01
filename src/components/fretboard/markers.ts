import {
  noteLabel,
  pitchClassAt,
  positionsOfPitchClasses,
  type FretRange,
  type IntervalSymbol,
  type LabelMode,
  type PitchClass,
  type Tuning,
} from '@/theory';
import type { FretMarker, NoteRole } from './types';

export interface NoteInContext {
  pc: PitchClass;
  name: string;
  interval?: IntervalSymbol;
  role: NoteRole;
}

/** Turns a set of notes (e.g. a scale, with roles) into markers at every place they occur on the neck. */
export function markersForNotes(
  tuning: Tuning,
  range: FretRange,
  notes: readonly NoteInContext[],
  labelMode: LabelMode,
): FretMarker[] {
  const byPc = new Map(notes.map((n) => [n.pc, n]));
  return positionsOfPitchClasses(tuning, byPc.keys(), range).map((pos) => {
    const n = byPc.get(pitchClassAt(tuning, pos))!;
    return {
      pos,
      role: n.role,
      label: noteLabel(labelMode, n.name, n.interval),
      description: `${n.name}${n.interval ? `, ${n.interval}` : ''}, string ${pos.string} fret ${pos.fret}`,
    };
  });
}
