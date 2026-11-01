import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos, withDefaults, type Profile, type Settings } from '@/data';
import { applyLanguage } from '@/i18n';
import { getTuning, type Tuning } from '@/theory';

interface ProfileContextValue {
  /** undefined while loading, null when there is no profile yet (first launch). */
  profile: Profile | null | undefined;
  settings: Settings;
  tuning: Tuning;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updateProfile: (patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(async () => {
    const id = await repos.profiles.getActiveId();
    if (!id) return null;
    return (await repos.profiles.get(id)) ?? null;
  });

  const settings = useMemo(() => withDefaults(profile?.settings), [profile]);
  const tuning = useMemo(() => getTuning(settings.tuningId, settings.customTuning), [settings]);

  useEffect(() => applyLanguage(settings.language), [settings.language]);

  // Custom note colours are applied as CSS variables the fretboard reads.
  useEffect(() => {
    const root = document.documentElement;
    for (const [role, colour] of Object.entries(settings.roleColors)) {
      if (colour) root.style.setProperty(`--fb-${role}`, colour);
    }
  }, [settings.roleColors]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (profile) await repos.profiles.updateSettings(profile.id, patch);
    },
    [profile],
  );
  const updateProfile = useCallback(
    async (patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => {
      if (profile) await repos.profiles.update(profile.id, patch);
    },
    [profile],
  );

  const value = useMemo(
    () => ({ profile, settings, tuning, updateSettings, updateProfile }),
    [profile, settings, tuning, updateSettings, updateProfile],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
