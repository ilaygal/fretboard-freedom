import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard, type FretMarker } from '@/components/fretboard';
import { Chip, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { useMic } from '@/app/useMic';
import { playMidi } from '@/audio/play';
import { PitchStabilizer } from '@/audio/pitch/analysis';
import { repos, type SrsCard } from '@/data';
import { logAttempt, pickNext, reviewItem, seededRng } from '@/domain/drills/engine';
import type { NoteFinderLevel } from '@/content/noteFinderLevels';
import { midiAt, midiToName, octaveShapes, pitchClassAt, pitchClassName, posKey, prettyNote, type FretPos } from '@/theory';
import {
  checkName,
  checkPlayed,
  checkTap,
  drillId,
  itemsFor,
  levelRegion,
  NATURALS,
  promptNoteName,
  questionFor,
  tapFindAll,
  type FindAllState,
  type NoteDrillMode,
  type Question,
} from './model';

const ROUND_SECONDS = 60;
const FEEDBACK_MS = 1100;
/** The answer is always shown in green, whatever its role colour would be. */
const ANSWER_GREEN = '#34d399';

interface Feedback {
  ok: boolean;
  markers: FretMarker[];
  octaves?: { from: FretPos; to: FretPos }[];
  text: string;
}

export interface RoundResult {
  correct: number;
  total: number;
  totalMs: number;
}

export function DrillRun({
  mode,
  level,
  onFinish,
}: {
  mode: NoteDrillMode;
  level: NoteFinderLevel;
  onFinish: (r: RoundResult) => void;
}) {
  const { t } = useTranslation();
  const { profile, settings, tuning } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
  const region = useMemo(() => levelRegion(level, tuning, settings.fretCount), [level, tuning, settings.fretCount]);
  const items = useMemo(() => itemsFor(mode, region, tuning), [mode, region, tuning]);
  const id = drillId(mode, level.id);
  const profileId = profile?.id ?? 'none';

  const rng = useRef(seededRng(Date.now()));
  const cards = useRef(new Map<string, SrsCard>());
  const recent = useRef<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const askedAt = useRef(0);
  const mistakes = useRef(0);
  const [findAll, setFindAll] = useState<FindAllState>({ found: [], misses: 0 });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0, totalMs: 0 });
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const finished = useRef(false);

  const next = useCallback(() => {
    const key = pickNext(items, cards.current, Date.now(), recent.current, rng.current);
    recent.current = [...recent.current, key].slice(-5);
    setQuestion(questionFor(mode, key, region, tuning));
    setFindAll({ found: [], misses: 0 });
    setFeedback(null);
    setHeard(null);
    mistakes.current = 0;
    askedAt.current = performance.now();
  }, [items, mode, region, tuning]);

  // Load spaced-repetition state, then ask the first question.
  useEffect(() => {
    let alive = true;
    void repos.srs.getMany(profileId, items).then((m) => {
      if (!alive) return;
      cards.current = m;
      next();
    });
    return () => {
      alive = false;
    };
  }, [profileId, items, next]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !finished.current) {
      finished.current = true;
      onFinish({ correct: score.correct, total: score.total, totalMs: score.totalMs });
    }
  }, [secondsLeft, score, onFinish]);

  /** Finishes the current question: score, spaced repetition, feedback, then the next question. */
  const conclude = useCallback(
    (q: Question, ok: boolean, fb: Omit<Feedback, 'ok'>) => {
      const ms = performance.now() - askedAt.current;
      setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0, totalMs: s.totalMs + ms }));
      void reviewItem(repos, profileId, q.itemKey, { correct: ok, ms, expectedMs: q.expectedMs, hadMistakes: mistakes.current > 0 }, Date.now()).then(
        (grade) => {
          void repos.srs.getMany(profileId, [q.itemKey]).then((m) => m.forEach((c, k) => cards.current.set(k, c)));
          return grade;
        },
      );
      setFeedback({ ok, ...fb, markers: octaveMarkers(q, fb.markers) });
      setTimeout(() => !finished.current && next(), FEEDBACK_MS);
    },
    [next, profileId],
  );

  const log = useCallback(
    (q: Question, pos: FretPos | undefined, correct: boolean, input: 'tap' | 'mic' | 'choice') =>
      void logAttempt(repos, {
        profileId,
        drillId: id,
        itemKey: q.itemKey,
        pos: pos ? posKey(pos) : undefined,
        correct,
        ms: performance.now() - askedAt.current,
        at: Date.now(),
        input,
      }),
    [id, profileId],
  );

  const nameOf = (pos: FretPos) => promptNoteName(pitchClassAt(tuning, pos));
  const revealMarkers = (q: Question): FretMarker[] =>
    q.targets.map((p) => ({ pos: p, role: 'root', color: ANSWER_GREEN, label: prettyNote(pitchClassName(q.pc, settings.accidentals)) }));
  const octavesFor = (pos: FretPos) => octaveShapes(tuning, pos, region.range).connections;
  /** The same note everywhere in view, so the octave lines join visible dots. */
  const octaveMarkers = (q: Question, keep: FretMarker[]): FretMarker[] => {
    const taken = new Set(keep.map((m) => posKey(m.pos)));
    const extra = octaveShapes(tuning, q.targets[0]!, region.range)
      .positions.filter((p) => !taken.has(posKey(p)))
      .map((p) => ({ pos: p, role: 'scale' as const, label: prettyNote(pitchClassName(q.pc, settings.accidentals)) }));
    return [...keep, ...extra];
  };

  const onTap = (pos: FretPos) => {
    playMidi(midiAt(tuning, pos));
    const q = question;
    if (!q || feedback || mode === 'name' || mode === 'play') return;
    if (mode === 'find') {
      const ok = checkTap(q, pos);
      log(q, pos, ok, 'tap');
      conclude(q, ok, {
        text: ok ? t('notes.right') : t('notes.wrongTap', { tapped: nameOf(pos), note: promptNoteName(q.pc) }),
        markers: ok
          ? [{ pos, role: 'root', color: ANSWER_GREEN, label: prettyNote(pitchClassName(q.pc, settings.accidentals)), feedback: 'right' }]
          : [
              { pos, role: 'neutral', label: prettyNote(pitchClassName(pitchClassAt(tuning, pos), settings.accidentals)), feedback: 'wrong' },
              ...revealMarkers(q),
            ],
        octaves: octavesFor(q.targets[0]!),
      });
      return;
    }
    // find all
    const res = tapFindAll(q, findAll, pos);
    if (res.result === 'repeat') return;
    log(q, pos, res.result === 'hit', 'tap');
    if (res.result === 'miss') mistakes.current++;
    setFindAll(res.state);
    if (res.done) {
      conclude(q, res.state.misses === 0, {
        text: t('notes.right'),
        markers: revealMarkers(q).map((m) => ({ ...m, feedback: 'right' })),
        octaves: octavesFor(q.targets[0]!),
      });
    }
  };

  const onName = (pc: number) => {
    const q = question;
    if (!q || feedback || !q.shown) return;
    const ok = checkName(q, pc);
    log(q, q.shown, ok, 'choice');
    playMidi(midiAt(tuning, q.shown));
    conclude(q, ok, {
      text: ok ? t('notes.right') : t('notes.wrong', { note: promptNoteName(q.pc) }),
      markers: [{ pos: q.shown, role: 'root', color: ANSWER_GREEN, label: prettyNote(pitchClassName(q.pc, settings.accidentals)), feedback: ok ? 'right' : 'wrong' }],
      octaves: octavesFor(q.shown),
    });
  };

  // Mic mode
  const stabilizer = useRef(new PitchStabilizer());
  const questionRef = useRef(question);
  questionRef.current = question;
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const mic = useMic((frame) => {
    const midi = stabilizer.current.push(frame);
    const q = questionRef.current;
    if (midi === null || !q || feedbackRef.current) return;
    setHeard(midiToName(midi, settings.accidentals));
    const ok = checkPlayed(q, midi, tuning, settings.micExactOctave);
    if (!ok) {
      mistakes.current++;
      log(q, undefined, false, 'mic');
      return;
    }
    const target = q.targets.find((p) => midiAt(tuning, p) === midi) ?? q.targets[0]!;
    log(q, target, true, 'mic');
    conclude(q, true, { text: t('notes.right'), markers: revealMarkers(q), octaves: octavesFor(target) });
  });
  const micStart = mic.start;
  const micStop = mic.stop;
  useEffect(() => {
    if (mode !== 'play') return;
    void micStart();
    return () => micStop();
  }, [mode, micStart, micStop]);

  // Keep the spot that matters on screen: the note being asked about, or the answer after a miss.
  const board = useRef<HTMLDivElement>(null);
  const focusPos = feedback ? (feedback.markers.find((m) => m.role === 'root')?.pos ?? null) : (question?.shown ?? null);
  useEffect(() => {
    if (!focusPos) return;
    const el = board.current?.querySelector(`[data-pos="${posKey(focusPos)}"]`);
    el?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [focusPos?.string, focusPos?.fret]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!question) return <div className="min-h-64" aria-busy="true" />;

  const noteName = promptNoteName(question.pc);
  const stringLabel = question.string ? t(`notes.stringNames.${question.string}`, { defaultValue: String(question.string) }) : '';
  const prompt =
    mode === 'name'
      ? t('notes.promptName')
      : mode === 'find'
        ? t('notes.promptFind', { note: noteName, string: stringLabel })
        : mode === 'findAll'
          ? t('notes.promptFindAll', { note: noteName })
          : t('notes.promptPlay', { note: noteName, string: stringLabel });

  const markers: FretMarker[] = feedback
    ? feedback.markers
    : mode === 'name' && question.shown
      ? [{ pos: question.shown, role: 'target', label: '?' }]
      : mode === 'findAll'
        ? question.targets
            .filter((p) => findAll.found.includes(posKey(p)))
            .map((p) => ({ pos: p, role: 'scale', label: prettyNote(pitchClassName(question.pc, settings.accidentals)) }))
        : [];

  const nameChoices = level.naturalsOnly ? NATURALS : [...Array(12).keys()];

  return (
    <div className="space-y-4">
      <div className="sticky top-[73px] z-10 -mx-4 space-y-3 bg-stage/95 px-4 pb-3 pt-1 backdrop-blur">
      <div className="flex items-center justify-between gap-3 text-lg">
        <span>
          {t('notes.score')}: <strong className="text-2xl">{score.correct}</strong>
        </span>
        <span className="text-muted">
          {t('notes.streak')}: <strong className="text-ink">{score.streak}</strong>
        </span>
        <span className="tabular-nums font-bold text-spot">{t('notes.timeLeft', { seconds: secondsLeft })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-spot transition-[width] duration-1000 ease-linear" style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }} />
      </div>

      <div
        aria-live="assertive"
        className={`rounded-3xl p-4 text-center text-2xl font-black ${feedback ? (feedback.ok ? 'bg-emerald-500/20' : 'bg-red-500/20') : 'bg-surface'}`}
      >
        {feedback ? feedback.text : prompt}
        {!feedback && mode === 'findAll' && (
          <div className="mt-1 text-base font-semibold text-muted">
            {t('notes.foundOf', { found: findAll.found.length, total: question.targets.length })}
          </div>
        )}
        {mode === 'play' && !feedback && (
          <div className="mt-1 text-base font-semibold text-muted">
            {mic.error ? t(mic.error === 'denied' ? 'notes.micDenied' : 'notes.micFailed') : heard ? t('notes.youPlayed', { note: prettyNote(heard.replace(/\d+$/, '')) + heard.replace(/^\D+/, '') }) : t('notes.listening')}
          </div>
        )}
      </div>
      </div>

      <div ref={board} className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
        <Fretboard
          tuning={tuning}
          range={region.range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          regions={region.strings.length < 6 ? [{ from: region.range.from, to: region.range.to, strings: question.string ? [question.string] : region.strings }] : []}
          connections={feedback?.octaves ?? []}
          onTap={onTap}
          className={orientation === 'horizontal' ? 'w-full min-w-[700px]' : 'w-full'}
          label={prompt}
        />
      </div>
      {mode === 'name' && (
        <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-4 gap-2 bg-stage/95 px-4 py-3 backdrop-blur sm:grid-cols-7">
          {nameChoices.map((pc) => (
            <Chip key={pc} onClick={() => onName(pc)} disabled={!!feedback} className="min-h-14 px-1 text-lg">
              {promptNoteName(pc)
                .split('/')
                .map((n) => prettyNote(n))
                .join('/')}
            </Chip>
          ))}
        </div>
      )}

      {mode === 'play' && <p className="text-center text-sm text-muted">{t('notes.micTip')}</p>}
      {feedback?.octaves && feedback.octaves.length > 0 && settings.theoryLevel === 'simple' && (
        <p className="text-center text-sm text-muted">{t('notes.octavesHint')}</p>
      )}
      <SecondaryButton className="w-full" onClick={() => setSecondsLeft(0)}>
        {t('notes.done')}
      </SecondaryButton>
    </div>
  );
}

export function RoundSummary({
  result,
  weak,
  onAgain,
  onDone,
}: {
  result: RoundResult;
  weak: { pc: number }[];
  onAgain: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const acc = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  return (
    <div className="space-y-4 rounded-3xl bg-surface p-6 text-center">
      <h2 className="text-3xl font-black">{t('notes.roundOver')}</h2>
      <p className="text-5xl font-black text-spot">{t('notes.correct', { count: result.correct })}</p>
      <p className="text-lg text-muted">
        {t('notes.accuracy', { percent: acc })} ·{' '}
        {t('notes.avgTime', { seconds: result.total ? (result.totalMs / result.total / 1000).toFixed(1) : '0' })}
      </p>
      {weak.length > 0 && (
        <p className="text-lg">
          {t('notes.practiseNext')}{' '}
          <strong>{weak.map((w) => promptNoteName(w.pc).split('/').map(prettyNote).join('/')).join(', ')}</strong>
        </p>
      )}
      <div className="flex gap-3">
        <SecondaryButton className="flex-1" onClick={onDone}>
          {t('notes.done')}
        </SecondaryButton>
        <PrimaryButton className="flex-1" onClick={onAgain}>
          {t('notes.playAgain')}
        </PrimaryButton>
      </div>
    </div>
  );
}
