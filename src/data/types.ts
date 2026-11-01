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
