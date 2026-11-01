import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, PageHeader, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { useMic } from '@/app/useMic';
import { metronome } from '@/audio/metronome';
import { noteFromFrequency } from '@/audio/pitch/analysis';
import { clampBpm, estimateLatencyMs, tapTempo, type ClickKind } from '@/audio/timing';
import { prettyNote } from '@/theory';
import { median, nearestString, tuneAdvice } from './model';

type Tab = 'tuner' | 'metronome' | 'timing';

export function ToolsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('tuner');
  return (
    <div className="pb-10">
      <PageHeader title={t('tools.title')} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-4">
        <div className="flex gap-2">
          {(['tuner', 'metronome', 'timing'] as const).map((x) => (
            <Chip key={x} selected={tab === x} onClick={() => setTab(x)}>
              {t(`tools.${x}`)}
            </Chip>
          ))}
        </div>
        {tab === 'tuner' && <Tuner />}
        {tab === 'metronome' && <MetronomePanel />}
        {tab === 'timing' && <TimingCheck />}
      </main>
    </div>
  );
}

function Tuner() {
  const { t } = useTranslation();
  const { settings, tuning } = useProfile();
  const recent = useRef<number[]>([]);
  const [freq, setFreq] = useState<number | null>(null);
  const mic = useMic((r) => {
    if (r.clarity < 0.9 || r.volume < 0.008 || r.frequency < 60 || r.frequency > 1400) return;
    recent.current = [...recent.current, r.frequency].slice(-5);
    setFreq(median(recent.current));
  });

  const note = freq ? noteFromFrequency(freq, settings.accidentals) : null;
  const str = freq ? nearestString(tuning, freq) : null;
  const cents = note?.cents ?? 0;
  const advice = note ? tuneAdvice(cents) : null;

  return (
    <section className="space-y-5 rounded-3xl bg-surface p-5 text-center">
      {mic.state !== 'on' ? (
        <PrimaryButton className="w-full" onClick={() => void mic.start()}>
          {t('tools.startTuner')}
        </PrimaryButton>
      ) : (
        <>
          <div className="text-8xl font-black tabular-nums" aria-live="polite">
            {note ? prettyNote(note.name.replace(/-?\d+$/, '')) : '–'}
            <span className="text-3xl text-muted">{note ? note.name.match(/-?\d+$/)?.[0] : ''}</span>
          </div>
          <div className="relative mx-auto h-6 max-w-sm rounded-full bg-surface-2" aria-hidden="true">
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-muted" />
            {note && (
              <div
                className={`absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full ${advice === 'inTune' ? 'bg-emerald-400' : 'bg-spot'}`}
                style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}
              />
            )}
          </div>
          <p className={`text-2xl font-bold ${advice === 'inTune' ? 'text-emerald-400' : ''}`}>
            {advice ? t(`tools.${advice}`) : t('tools.playAString')}
            {note && advice !== 'inTune' && <span className="ml-2 text-muted">{cents > 0 ? `+${cents}` : cents}¢</span>}
          </p>
          {str && <p className="text-muted">{t('tools.nearestString', { string: t(`notes.stringNames.${str.string}`, { defaultValue: String(str.string) }) })}</p>}
          <SecondaryButton onClick={mic.stop}>{t('tools.stop')}</SecondaryButton>
        </>
      )}
      {mic.error && <p className="text-role-root">{t(mic.error === 'denied' ? 'notes.micDenied' : 'notes.micFailed')}</p>}
    </section>
  );
}

function useMetronomeBeat() {
  const [beat, setBeat] = useState<{ i: number; kind: ClickKind } | null>(null);
  useEffect(() => metronome.onTick((i, kind) => setBeat({ i, kind })), []);
  return beat;
}

function MetronomePanel() {
  const { t } = useTranslation();
  const [opts, setOpts] = useState(metronome.options);
  const [running, setRunning] = useState(metronome.running);
  const taps = useRef<number[]>([]);
  const beat = useMetronomeBeat();

  const update = (patch: Partial<typeof opts>) => {
    metronome.update(patch);
    setOpts({ ...metronome.options });
  };
  const toggle = () => {
    if (metronome.running) metronome.stop();
    else metronome.start();
    setRunning(metronome.running);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => () => metronome.stop(), []);

  const pattern = opts.beatsPerBar;
  const currentBeat = beat ? Math.floor(beat.i / opts.subdivision) : -1;

  return (
    <section className="space-y-5 rounded-3xl bg-surface p-5">
      <div className="text-center">
        <div className="text-7xl font-black tabular-nums">{opts.bpm}</div>
        <div className="text-sm text-muted">{t('tools.bpm')}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <SecondaryButton className="px-2" onClick={() => update({ bpm: opts.bpm - 5 })} aria-label="-5">−5</SecondaryButton>
        <SecondaryButton className="px-2" onClick={() => update({ bpm: opts.bpm - 1 })} aria-label="-1">−1</SecondaryButton>
        <SecondaryButton className="px-2" onClick={() => update({ bpm: opts.bpm + 1 })} aria-label="+1">+1</SecondaryButton>
        <SecondaryButton className="px-2" onClick={() => update({ bpm: opts.bpm + 5 })} aria-label="+5">+5</SecondaryButton>
      </div>
      <div className="flex justify-center gap-3" aria-hidden="true">
        {Array.from({ length: pattern }, (_, i) => (
          <div
            key={i}
            className={`size-6 rounded-full ${running && i === currentBeat ? (i === 0 && opts.accentFirst ? 'bg-role-root' : 'bg-spot') : 'bg-surface-2'}`}
          />
        ))}
      </div>
      <PrimaryButton className="w-full text-xl" onClick={toggle}>
        {running ? t('tools.stop') : t('tools.start')}
      </PrimaryButton>
      <SecondaryButton
        className="w-full"
        onClick={() => {
          taps.current = [...taps.current, performance.now()].slice(-8);
          const bpm = tapTempo(taps.current);
          if (bpm) update({ bpm: clampBpm(bpm) });
        }}
      >
        {t('tools.tap')}
      </SecondaryButton>
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted">{t('tools.beats')}</div>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <Chip key={n} selected={opts.beatsPerBar === n} onClick={() => update({ beatsPerBar: n })}>
              {n}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted">{t('tools.subdivision')}</div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} selected={opts.subdivision === n} onClick={() => update({ subdivision: n })}>
              {n}
            </Chip>
          ))}
          <Chip selected={opts.accentFirst} onClick={() => update({ accentFirst: !opts.accentFirst })}>
            {t('tools.accent')}
          </Chip>
        </div>
      </div>
      <p className="hidden text-center text-sm text-muted md:block">{t('tools.spaceHint')}</p>
    </section>
  );
}

const CALIBRATION_BPM = 90;
const CALIBRATION_CLICKS = 8;

function TimingCheck() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useProfile();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<number | null>(null);
  const clicks = useRef<number[]>([]);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (phase !== 'running') return;
    const off = metronome.onTick(() => {
      clicks.current.push(performance.now());
      if (clicks.current.length > CALIBRATION_CLICKS) {
        metronome.stop();
        const ms = estimateLatencyMs(clicks.current, taps.current, 60000 / CALIBRATION_BPM);
        setResult(ms);
        if (ms !== null) void updateSettings({ latencyMs: Math.max(0, ms) });
        setPhase('done');
      }
    });
    return () => {
      off();
    };
  }, [phase, updateSettings]);

  const begin = () => {
    clicks.current = [];
    taps.current = [];
    metronome.update({ bpm: CALIBRATION_BPM, beatsPerBar: 4, subdivision: 1, accentFirst: false });
    metronome.start();
    setPhase('running');
  };

  return (
    <section className="space-y-4 rounded-3xl bg-surface p-5 text-center">
      <p className="text-lg">{t('tools.timingIntro')}</p>
      {phase === 'running' ? (
        <button
          type="button"
          className="mx-auto block size-48 rounded-full bg-spot text-2xl font-black text-stage active:scale-95"
          onPointerDown={() => taps.current.push(performance.now())}
        >
          {t('tools.timingTap')}
        </button>
      ) : (
        <PrimaryButton className="w-full" onClick={begin}>
          {t('tools.timingStart')}
        </PrimaryButton>
      )}
      {phase === 'done' && (
        <p className="text-xl font-bold">
          {result !== null ? t('tools.timingResult', { ms: Math.max(0, result) }) : t('tools.timingRetry')}
        </p>
      )}
      {phase === 'idle' && settings.latencyMs > 0 && <p className="text-muted">{t('tools.timingResult', { ms: settings.latencyMs })}</p>}
    </section>
  );
}
