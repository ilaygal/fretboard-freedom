import type { LabelMode, AccidentalPreference, Tuning } from '@/theory';
import type { NoteRole } from '@/components/fretboard/types';

export type OrientationSetting = 'auto' | 'horizontal' | 'vertical';

export interface Settings {
  leftHanded: boolean;
  tuningId: string;
  customTuning?: Tuning;
  /** Highest fret on the player's guitar. */
  fretCount: number;
  /** Naming for notes outside any key. */
  accidentals: AccidentalPreference;
  /** Show theory-correct names like Cb and E#. */
  strictSpelling: boolean;
  labelMode: LabelMode;
  orientation: OrientationSetting;
  /** "simple" hides theory words and explains things in plain language. */
  theoryLevel: 'simple' | 'detailed';
  language: 'en' | 'he';
  roleColors: Partial<Record<NoteRole, string>>;
  /** Measured audio + touch delay, subtracted from timing feedback. */
  latencyMs: number;
  /** Mic drills: require the exact octave, not just the note name. */
  micExactOctave: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  leftHanded: false,
  tuningId: 'standard',
  fretCount: 22,
  accidentals: 'sharps',
  strictSpelling: false,
  labelMode: 'note',
  orientation: 'auto',
  theoryLevel: 'simple',
  language: 'en',
  roleColors: {},
  latencyMs: 0,
  micExactOctave: false,
};

export interface Background {
  /** Ids from content/onboarding.ts */
  knows: string[];
  goals: string[];
  styles: string[];
}

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  onboarded: boolean;
  settings: Settings;
  background: Background;
}

export function withDefaults(settings: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...settings, roleColors: { ...DEFAULT_SETTINGS.roleColors, ...settings?.roleColors } };
}

/** One answered drill question (or one tap in a multi-target question). */
export interface Attempt {
  id?: number;
  profileId: string;
  drillId: string;
  /** Spaced-repetition item, e.g. "note:7@s3" (G on string 3). */
  itemKey: string;
  /** Neck position involved, "string:fret", for the weak-spot heatmap. */
  pos?: string;
  correct: boolean;
  ms: number;
  at: number;
  input: 'tap' | 'mic' | 'choice';
}

export interface SrsCard {
  profileId: string;
  itemKey: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number;
  due: number;
}
