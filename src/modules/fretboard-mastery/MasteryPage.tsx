import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chip, PageHeader, PrimaryButton, SecondaryButton } from '@/components/ui';
import { Fretboard, type FretMarker } from '@/components/fretboard';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { repos, type Attempt } from '@/data';
import { NOTE_FINDER_LEVELS, type NoteFinderLevel } from '@/content/noteFinderLevels';
import { allPositions, pitchClassAt, pitchClassName, posKey, prettyNote } from '@/theory';
import { DrillRun, RoundSummary, type RoundResult } from './DrillRun';
import { heatColour, heatmap, levelOfDrillId, suggestedLevel, weakestNotes, type NoteDrillMode } from './model';

const MODES: NoteDrillMode[] = ['name', 'find', 'findAll', 'play'];

export function MasteryPage() {
  const { t } = useTranslation();
  const { profile, settings, tuning } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
  const [mode, setMode] = useState<NoteDrillMode>('find');
  const [chosenLevel, setChosenLevel] = useState<NoteFinderLevel | null>(null);
  const [view, setView] = useState<'menu' | 'run' | 'summary' | 'heatmap'>('menu');
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundStart, setRoundStart] = useState(0);
  const [runKey, setRunKey] = useState(0);

  const attempts = useLiveQuery(() => (profile ? repos.attempts.list(profile.id) : Promise.resolve([] as Attempt[])), [profile?.id]) ?? [];
  const noteAttempts = useMemo(() => attempts.filter((a) => a.drillId.startsWith('notes.')), [attempts]);
  const byLevel = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of noteAttempts) {
      const l = levelOfDrillId(a.drillId);
      if (l) m.set(l, [...(m.get(l) ?? []), a]);
    }
    return m;
  }, [noteAttempts]);
  const suggested = suggestedLevel(byLevel);
  const level = chosenLevel ?? suggested;

  const start = () => {
    setRoundStart(Date.now());
    setRunKey((k) => k + 1);
    setView('run');
  };
  const finish = useCallback((r: RoundResult) => {
    setResult(r);
    setView('summary');
  }, []);

  const roundAttempts = noteAttempts.filter((a) => a.at >= roundStart);

  return (
    <div className="pb-10">
      <PageHeader title={t('notes.title')} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-4">
        {view === 'run' && <DrillRun key={runKey} mode={mode} level={level} onFinish={finish} />}

        {view === 'summary' && result && (
          <RoundSummary
            result={result}
            weak={weakestNotes(roundAttempts, tuning).length ? weakestNotes(roundAttempts, tuning) : weakestNotes(noteAttempts, tuning)}
            onAgain={start}
            onDone={() => setView('menu')}
          />
        )}

        {view === 'heatmap' && (
          <HeatmapView attempts={noteAttempts} orientation={orientation} onBack={() => setView('menu')} />
        )}

        {view === 'menu' && (
          <>
            <p className="text-lg text-muted">{t('notes.intro')}</p>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('notes.mode')}</h2>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === mode}
                    onClick={() => setMode(m)}
                    className={`min-h-20 rounded-2xl border p-3 text-left ${m === mode ? 'border-spot bg-spot text-stage' : 'border-line bg-surface'}`}
                  >
                    <div className="text-lg font-bold">{t(`notes.modes.${m}.label`)}</div>
                    <div className={`text-sm ${m === mode ? 'text-stage/80' : 'text-muted'}`}>{t(`notes.modes.${m}.hint`)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('notes.level')}</h2>
              <div className="flex flex-wrap gap-2">
                {NOTE_FINDER_LEVELS.map((l) => (
                  <Chip key={l.id} selected={l.id === level.id} onClick={() => setChosenLevel(l)}>
                    {t(`notes.levels.${l.id}`)}
                    {l.id === suggested.id && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${l.id === level.id ? 'bg-stage text-spot' : 'bg-spot text-stage'}`}>
                        {t('notes.recommended')}
                      </span>
                    )}
                  </Chip>
                ))}
              </div>
            </section>

            <div className="sticky bottom-0 -mx-4 bg-stage/95 px-4 py-3 backdrop-blur">
              <PrimaryButton className="w-full text-xl" onClick={start}>
                {t('notes.start')}
              </PrimaryButton>
            </div>
            <SecondaryButton className="w-full" onClick={() => setView('heatmap')}>
              {t('notes.heatmap')}
            </SecondaryButton>
          </>
        )}
      </main>
    </div>
  );
}

function HeatmapView({
  attempts,
  orientation,
  onBack,
}: {
  attempts: Attempt[];
  orientation: 'horizontal' | 'vertical';
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { settings, tuning } = useProfile();
  const stats = useMemo(() => heatmap(attempts), [attempts]);
  const range = { from: 0, to: settings.fretCount };
  const markers: FretMarker[] = allPositions(tuning, range).map((pos) => {
    const s = stats.get(posKey(pos));
    return {
      pos,
      role: s ? 'neutral' : 'ghost',
      color: heatColour(s),
      label: prettyNote(pitchClassName(pitchClassAt(tuning, pos), settings.accidentals)),
      description: s ? `${Math.round((s.correct / s.total) * 100)}%` : undefined,
    };
  });
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black">{t('notes.heatmap')}</h2>
      <p className="text-muted">{stats.size ? t('notes.heatmapHint') : t('notes.heatmapEmpty')}</p>
      <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
        <Fretboard
          tuning={tuning}
          range={range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          className={orientation === 'horizontal' ? 'w-full min-w-[900px]' : 'w-full'}
          label={t('notes.heatmap')}
        />
      </div>
      <SecondaryButton className="w-full" onClick={onBack}>
        {t('nav.back')}
      </SecondaryButton>
    </div>
  );
}
