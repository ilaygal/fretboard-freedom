import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, PrimaryButton, SecondaryButton } from '@/components/ui';
import { repos, type Background, type Settings } from '@/data';
import { GOAL_OPTIONS, KNOWLEDGE_OPTIONS, STYLE_OPTIONS } from '@/content/onboarding';
import { TUNINGS } from '@/theory';

type Step = 'name' | 'hand' | 'tuning' | 'knows' | 'goals' | 'styles';
const STEPS: Step[] = ['name', 'hand', 'tuning', 'knows', 'goals', 'styles'];

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<Partial<Settings>>({ leftHanded: false, tuningId: 'standard' });
  const [bg, setBg] = useState<Background>({ knows: [], goals: [], styles: [] });
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const finish = async () => {
    const profile = await repos.profiles.create({ name, settings, background: bg });
    await repos.profiles.update(profile.id, { onboarded: true });
    // Once the active profile is onboarded, the router sends the player home.
    await repos.profiles.setActiveId(profile.id);
  };

  const next = () => (last ? void finish() : setStep(step + 1));

  const multi = (key: keyof Background, options: readonly string[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((id) => (
        <Chip key={id} selected={bg[key].includes(id)} onClick={() => setBg({ ...bg, [key]: toggle(bg[key], id) })}>
          {t(`onboarding.options.${id}`)}
        </Chip>
      ))}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-black">{t('app.name')}</h1>
        {step === 0 && <p className="mt-2 text-lg text-muted">{t('onboarding.welcome')}</p>}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-spot' : 'bg-surface-2'}`} />
        ))}
      </div>

      <section className="flex-1 space-y-4">
        <h2 className="text-2xl font-bold">{t(`onboarding.${current}Question`)}</h2>
        {current === 'name' && (
          <input
            autoFocus
            className="min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-lg"
            placeholder={t('onboarding.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        )}
        {current === 'hand' && (
          <div className="flex flex-wrap gap-2">
            <Chip selected={!settings.leftHanded} onClick={() => setSettings({ ...settings, leftHanded: false })}>
              {t('settings.rightHanded')}
            </Chip>
            <Chip selected={settings.leftHanded} onClick={() => setSettings({ ...settings, leftHanded: true })}>
              {t('settings.leftHanded')}
            </Chip>
          </div>
        )}
        {current === 'tuning' && (
          <div className="flex flex-wrap gap-2">
            {TUNINGS.map((tu) => (
              <Chip key={tu.id} selected={settings.tuningId === tu.id} onClick={() => setSettings({ ...settings, tuningId: tu.id })}>
                {tu.name}
              </Chip>
            ))}
          </div>
        )}
        {(current === 'knows' || current === 'goals' || current === 'styles') && (
          <>
            <p className="text-muted">{t('onboarding.pickAny')}</p>
            {current === 'knows' && multi('knows', KNOWLEDGE_OPTIONS)}
            {current === 'goals' && multi('goals', GOAL_OPTIONS)}
            {current === 'styles' && multi('styles', STYLE_OPTIONS)}
          </>
        )}
      </section>

      <div className="flex gap-3">
        {step > 0 && <SecondaryButton onClick={() => setStep(step - 1)}>{t('onboarding.back')}</SecondaryButton>}
        <PrimaryButton className="flex-1" onClick={next}>
          {last ? t('onboarding.done') : t('onboarding.next')}
        </PrimaryButton>
      </div>
    </main>
  );
}
