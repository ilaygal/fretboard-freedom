import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, PageHeader, Section, SecondaryButton } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { repos } from '@/data';
import { describeTuning, parseTuning, TUNINGS } from '@/theory';

export function SettingsPage() {
  const { t } = useTranslation();
  const { profile, settings, tuning, updateSettings, updateProfile } = useProfile();
  const [custom, setCustom] = useState(settings.customTuning ? '' : '');
  const [customError, setCustomError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const applyCustom = () => {
    try {
      const tuningValue = parseTuning(custom, t('settings.customTuning'));
      setCustomError(false);
      void updateSettings({ tuningId: 'custom', customTuning: tuningValue });
    } catch {
      setCustomError(true);
    }
  };

  const exportBackup = async () => {
    const data = await repos.backup.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fretboard-freedom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      await repos.backup.importAll(JSON.parse(await file.text()));
      setMessage(t('settings.importDone'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="pb-10">
      <PageHeader title={t('settings.title')} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <Section title={t('settings.profile')}>
          <input
            className="min-h-12 w-full rounded-2xl border border-line bg-stage px-4 text-lg"
            defaultValue={profile?.name}
            onBlur={(e) => void updateProfile({ name: e.target.value.trim() || 'Me' })}
            aria-label={t('settings.profile')}
          />
        </Section>

        <Section title={t('settings.hand')}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!settings.leftHanded} onClick={() => void updateSettings({ leftHanded: false })}>
              {t('settings.rightHanded')}
            </Chip>
            <Chip selected={settings.leftHanded} onClick={() => void updateSettings({ leftHanded: true })}>
              {t('settings.leftHanded')}
            </Chip>
          </div>
        </Section>

        <Section title={t('settings.tuning')} hint={describeTuning(tuning)}>
          <div className="flex flex-wrap gap-2">
            {TUNINGS.map((tu) => (
              <Chip key={tu.id} selected={settings.tuningId === tu.id} onClick={() => void updateSettings({ tuningId: tu.id })}>
                {tu.name}
              </Chip>
            ))}
            {settings.customTuning && (
              <Chip selected={settings.tuningId === 'custom'} onClick={() => void updateSettings({ tuningId: 'custom' })}>
                {t('settings.customTuning')}: {describeTuning(settings.customTuning)}
              </Chip>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="min-h-12 flex-1 rounded-2xl border border-line bg-stage px-4"
              placeholder="D2 A2 D3 G3 B3 E4"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label={t('settings.customTuning')}
              aria-invalid={customError}
            />
            <SecondaryButton onClick={applyCustom} disabled={!custom.trim()}>
              {t('settings.apply')}
            </SecondaryButton>
          </div>
          <p className={customError ? 'text-sm text-role-root' : 'text-sm text-muted'}>
            {customError ? t('settings.invalidTuning') : t('settings.customTuningHint')}
          </p>
        </Section>

        <Section title={t('settings.frets')}>
          <div className="flex items-center gap-3">
            <SecondaryButton aria-label="−" onClick={() => void updateSettings({ fretCount: Math.max(12, settings.fretCount - 1) })}>
              −
            </SecondaryButton>
            <span className="min-w-12 text-center text-2xl font-bold" aria-live="polite">
              {settings.fretCount}
            </span>
            <SecondaryButton aria-label="+" onClick={() => void updateSettings({ fretCount: Math.min(24, settings.fretCount + 1) })}>
              +
            </SecondaryButton>
          </div>
        </Section>

        <Section title={t('settings.orientation')}>
          <div className="flex flex-wrap gap-2">
            {(['auto', 'horizontal', 'vertical'] as const).map((o) => (
              <Chip key={o} selected={settings.orientation === o} onClick={() => void updateSettings({ orientation: o })}>
                {t(`settings.orientation${o[0]!.toUpperCase()}${o.slice(1)}`)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t('settings.theory')}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={settings.theoryLevel === 'simple'} onClick={() => void updateSettings({ theoryLevel: 'simple' })}>
              {t('settings.theorySimple')}
            </Chip>
            <Chip selected={settings.theoryLevel === 'detailed'} onClick={() => void updateSettings({ theoryLevel: 'detailed' })}>
              {t('settings.theoryDetailed')}
            </Chip>
          </div>
        </Section>

        <Section title={t('settings.noteNames')}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={settings.accidentals === 'sharps'} onClick={() => void updateSettings({ accidentals: 'sharps' })}>
              {t('settings.sharps')}
            </Chip>
            <Chip selected={settings.accidentals === 'flats'} onClick={() => void updateSettings({ accidentals: 'flats' })}>
              {t('settings.flats')}
            </Chip>
          </div>
          <Chip selected={settings.strictSpelling} onClick={() => void updateSettings({ strictSpelling: !settings.strictSpelling })}>
            {t('settings.strict')}: {settings.strictSpelling ? t('settings.on') : t('settings.off')}
          </Chip>
        </Section>

        <Section title={t('settings.language')} hint={t('settings.hebrewSoon')}>
          <Chip selected>English</Chip>
        </Section>

        <Section title={t('settings.backup')} hint={t('settings.backupHint')}>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => void exportBackup()}>{t('settings.export')}</SecondaryButton>
            <SecondaryButton onClick={() => fileInput.current?.click()}>{t('settings.import')}</SecondaryButton>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBackup(f);
                e.target.value = '';
              }}
            />
          </div>
          {message && <p role="status">{message}</p>}
        </Section>
      </main>
    </div>
  );
}
