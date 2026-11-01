import type { FretPos } from '@/theory';

/** What a note means in the current context; decides its colour. */
export type NoteRole = 'root' | 'chord' | 'scale' | 'target' | 'avoid' | 'blue' | 'neutral' | 'ghost';

export interface FretMarker {
  pos: FretPos;
  label: string;
  role: NoteRole;
  /** Stable id so a marker can slide to a new place when the shape changes. Defaults to the position. */
  id?: string;
  /** Accessible description, e.g. "G, root, string 6 fret 3". */
  description?: string;
}

export interface FretRegion {
  from: number;
  to: number;
  /** Limit to these strings; all strings when omitted. */
  strings?: number[];
  label?: string;
}
