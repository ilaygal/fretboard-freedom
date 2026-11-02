import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard, type FretMarker } from '@/components/fretboard';
import { Chip, ChipRow, PageHeader, PrimaryButton, SecondaryButton } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { useMic } from '@/app/useMic';
import { playMidi, playPhrase } from '@/audio/play';
import { PitchStabilizer } from '@/audio/pitch/analysis';
import { repos, type SavedLick } from '@/data';
import { LickFollower, lickBoxes, placeLick } from '@/domain/licks/licks';
import { FLAT_NAMES, midiAt, pitchClassAt, posKey, preferredTonic, prettyNote, windowAround, type FretPos, type ScaleId } from '@/theory';
import {
  ANSWER_GREEN,
  LICK_SCALES,
  allLicks,
  expectedMidis,
  lickMarkers,
  lickTags,
  nextKey,
  soundingIndex,
  tapsToNotes,
  type LickView,
} from './model';

type View = { kind: 'list' } | { kind: 'lick'; id: string } | { kind: 'make' };

export function LicksPage() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [tonicPc, setTonicPc] = useState(9);
  const [saved, setSaved] = useState<SavedLick[]>([]);
  const load = () => {
    if (profile) void repos.licks.list(profile.id).then(setSaved);
  };
  useEffect(load, [profile]);
  const licks = useMemo(() => allLicks(saved), [saved]);
  const lick = view.kind === 'lick' ? licks.find((l) => l.id === view.id) : undefined;

  return (
    <div className="pb-16">
      <PageHeader title={t('licks.title')} />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
        {view.kind !== 'lick' && (
          <ChipRow label={t('explorer.key')}>
            {FLAT_NAMES.map((_, pc) => (
              <Chip key={pc} selected={pc === tonicPc} onClick={() => setTonicPc(pc)} className="min-w-14">
                {prettyNote(preferredTonic(pc, 'major'))}
              </Chip>
            ))}
          </ChipRow>
        )}
        {view.kind === 'list' && (
          <LickList
            licks={licks}
            onPick={(id) => setView({ kind: 'lick', id })}
            onMake={() => setView({ kind: 'make' })}
            onDelete={(id) => void repos.licks.remove(id).then(load)}
          />
        )}
        {lick && (
          <LickPractice key={lick.id} lick={lick} tonicPc={tonicPc} onKey={setTonicPc} onBack={() => setView({ kind: 'list' })} />
        )}
        {view.kind === 'make' && (
          <LickMaker
            tonicPc={tonicPc}
            count={saved.length}
            onSaved={(id) => {
              load();
              setView({ kind: 'lick', id });
            }}
            onBack={() => setView({ kind: 'list' })}
          />
        )}
      </div>
    </div>
  );
}

function lickTitle(t: (k: string) => string, l: LickView) {
  return l.name ?? t(`licks.items.${l.id}.title`);
}

/* ---------- List ---------- */

function LickList({
  licks,
  onPick,
  onMake,
  onDelete,
}: {
  licks: LickView[];
  onPick: (id: string) => void;
  onMake: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => lickTags(licks), [licks]);
  const shown = tag ? licks.filter((l) => l.tags.includes(tag)) : licks;
  const tagLabel = (x: string) => (x === 'mine' ? t('licks.tags.mine') : t(`licks.tags.${x}`, { defaultValue: x }));

  return (
    <>
      <p className="text-lg">{t('licks.intro')}</p>
      <ChipRow label={t('licks.filter')}>
        <Chip selected={tag === null} onClick={() => setTag(null)}>
          {t('licks.all')}
        </Chip>
        {tags.map((x) => (
          <Chip key={x} selected={tag === x} onClick={() => setTag(x)}>
            {tagLabel(x)}
          </Chip>
        ))}
      </ChipRow>
      <PrimaryButton onClick={onMake} className="w-full">
        ✚ {t('licks.make')}
      </PrimaryButton>
      <ul className="space-y-3">
        {shown.map((l) => (
          <li key={l.id} className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => onPick(l.id)}
              className="flex min-h-20 min-w-0 flex-1 items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-start active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{lickTitle(t, l)}</span>
                <span className="block text-muted">{l.name ? t(`scales.${l.scale}`) : t(`licks.items.${l.id}.how`)}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {l.tags.map((x) => (
                    <span key={x} className="rounded-full bg-stage px-2 py-0.5 text-xs text-muted">
                      {tagLabel(x)}
                    </span>
                  ))}
                </span>
              </span>
              {!l.name && <span className="shrink-0 text-sm text-muted">{t('challenges.level', { n: l.level })}</span>}
            </button>
            {l.name && (
              <button
                type="button"
                onClick={() => onDelete(l.id)}
                aria-label={`${t('challenges.delete')} ${l.name}`}
                className="min-w-14 rounded-3xl border border-line bg-surface px-3 text-muted"
              >
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Practice one lick ---------- */

function useOrientation() {
  const { settings } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  return settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
}

function LickPractice({ lick, tonicPc, onKey, onBack }: { lick: LickView; tonicPc: number; onKey: (pc: number) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const { profile, settings, tuning } = useProfile();
  const orientation = useOrientation();
  const tonic = preferredTonic(tonicPc, lick.scale);
  const boxes = useMemo(() => lickBoxes(tuning, tonic, lick.scale, settings.fretCount), [tuning, tonic, lick.scale, settings.fretCount]);
  const [boxIndex, setBoxIndex] = useState(0);
  const box = boxes[Math.min(boxIndex, boxes.length - 1)];
  const placed = useMemo(() => (box ? placeLick(tuning, tonic, lick.notes, box, settings.fretCount) : []), [tuning, tonic, lick.notes, box, settings.fretCount]);
  const range = useMemo(() => {
    const frets = placed.flatMap((n) => (n.pos ? [n.pos.fret] : []));
    if (frets.length === 0) return { from: 0, to: settings.fretCount };
    return windowAround({ from: Math.min(...frets), to: Math.max(...frets) }, settings.fretCount);
  }, [placed, settings.fretCount]);

  // Hear it
  const [active, setActive] = useState(-1);
  const stopPhrase = useRef<(() => void) | null>(null);
  const hear = () => {
    stopPhrase.current?.();
    stopPhrase.current = playPhrase(placed, lick.bpm, setActive);
  };
  useEffect(() => () => stopPhrase.current?.(), []);

  // Play it back (mic)
  const follower = useRef<LickFollower | null>(null);
  const stabilizer = useRef(new PitchStabilizer());
  const [played, setPlayed] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [result, setResult] = useState<{ wrong: number } | null>(null);
  const expected = useMemo(() => expectedMidis(placed), [placed]);

  const mic = useMic((frame) => {
    const f = follower.current;
    if (!f || f.done) return;
    const midi = stabilizer.current.push(frame);
    if (midi === null) return;
    const r = f.hear(midi);
    if (r === 'right') {
      setPlayed(f.index);
      if (f.done) {
        setResult({ wrong: f.wrong });
        if (profile)
          void repos.attempts.add({
            profileId: profile.id,
            drillId: `licks.playback.${lick.name ? 'mine' : lick.id}`,
            itemKey: `lick:${lick.id}@${tonicPc}`,
            correct: f.wrong === 0,
            ms: 0,
            at: Date.now(),
            input: 'mic',
          });
      }
    } else if (r === 'wrong') {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 400);
    }
  });

  const resetPlayback = () => {
    follower.current = new LickFollower(expected, false);
    stabilizer.current.reset();
    setPlayed(0);
    setResult(null);
  };
  // A new key or box starts the playback over.
  useEffect(() => {
    if (follower.current) resetPlayback();
  }, [expected]);

  const startPlayback = async () => {
    resetPlayback();
    if (mic.state !== 'on') await mic.start();
  };

  const following = mic.state === 'on' && follower.current !== null;
  const activeIndex = following && !result ? soundingIndex(placed, played) : active;
  const markers = lickMarkers(placed, { tuning, tonicPc, active: activeIndex, played: following ? soundingIndex(placed, played) : 0 });

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-surface p-4">
        <h2 className="text-2xl font-black">
          {lickTitle(t, lick)} · {prettyNote(tonic)}
        </h2>
        <p className="text-lg">{lick.name ? t(`scales.${lick.scale}`) : t(`licks.items.${lick.id}.how`)}</p>
        <p className="mt-1 text-sm text-muted">{t('licks.howToRead')}</p>
      </section>

      <ChipRow label={t('licks.position')}>
        {boxes.map((b, i) => (
          <Chip key={b.index} selected={i === boxIndex} onClick={() => setBoxIndex(i)} className="min-w-14">
            {t('licks.box', { n: b.index, fret: b.span.from })}
          </Chip>
        ))}
      </ChipRow>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PrimaryButton onClick={hear}>▶ {t('licks.hear')}</PrimaryButton>
        <SecondaryButton onClick={() => void startPlayback()}>🎤 {t('licks.playBack')}</SecondaryButton>
        <SecondaryButton onClick={() => onKey(nextKey(tonicPc))}>
          {t('licks.nextKey', { key: prettyNote(preferredTonic(nextKey(tonicPc), lick.scale)) })}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => {
            mic.stop();
            onBack();
          }}
        >
          {t('challenges.back')}
        </SecondaryButton>
      </div>

      {mic.error && <p className="text-role-root">{t(`notes.micErrors.${mic.error}`)}</p>}
      {following && (
        <p className={`rounded-2xl p-3 text-center text-xl font-bold ${wrongFlash ? 'ring-4 ring-red-500' : ''}`} aria-live="polite">
          {result ? (
            <span style={{ color: ANSWER_GREEN }}>{result.wrong === 0 ? t('licks.clean') : t('licks.gotIt', { count: result.wrong })}</span>
          ) : (
            t('licks.playNote', { n: played + 1, of: expected.length })
          )}
        </p>
      )}

      <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
        <Fretboard
          tuning={tuning}
          range={range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          regions={box ? [box.span] : []}
          onTap={(p) => playMidi(midiAt(tuning, p))}
          className="w-full"
          label={lickTitle(t, lick)}
        />
      </div>
    </div>
  );
}

/* ---------- Make your own ---------- */

function LickMaker({ tonicPc, count, onSaved, onBack }: { tonicPc: number; count: number; onSaved: (id: string) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const { profile, settings, tuning } = useProfile();
  const orientation = useOrientation();
  const [scale, setScale] = useState<ScaleId>('minorPentatonic');
  const [taps, setTaps] = useState<FretPos[]>([]);
  const [name, setName] = useState('');
  const tonic = preferredTonic(tonicPc, scale);
  const range = { from: 0, to: Math.min(12, settings.fretCount) };

  const markers: FretMarker[] = useMemo(() => {
    const seen = new Map<string, FretMarker>();
    taps.forEach((p, i) => {
      const k = posKey(p);
      if (!seen.has(k))
        seen.set(k, {
          pos: p,
          label: String(i + 1),
          role: pitchClassAt(tuning, p) === tonicPc ? 'root' : 'scale',
        });
    });
    return [...seen.values()];
  }, [taps, tuning, tonicPc]);

  const notes = tapsToNotes(tuning, taps, tonicPc);
  const save = async () => {
    if (!profile || notes.length === 0) return;
    const id = crypto.randomUUID();
    await repos.licks.save({
      id,
      profileId: profile.id,
      name: name.trim() || t('licks.defaultName', { n: count + 1 }),
      scale,
      notes,
      tags: ['mine'],
      createdAt: Date.now(),
    });
    onSaved(id);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-surface p-4">
        <h2 className="text-2xl font-black">{t('licks.make')}</h2>
        <p className="text-lg">{t('licks.makeHow', { key: prettyNote(tonic) })}</p>
      </section>
      <ChipRow label={t('licks.scale')}>
        {LICK_SCALES.map((s) => (
          <Chip key={s} selected={s === scale} onClick={() => setScale(s)}>
            {t(`scales.${s}`)}
          </Chip>
        ))}
      </ChipRow>
      <p className="text-lg" aria-live="polite">
        {t('licks.tapped', { count: taps.length })}
      </p>
      <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
        <Fretboard
          tuning={tuning}
          range={range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          onTap={(p) => {
            playMidi(midiAt(tuning, p));
            setTaps((x) => (x.length >= 24 ? x : [...x, p]));
          }}
          className="w-full"
          label={t('licks.make')}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SecondaryButton disabled={taps.length === 0} onClick={() => playPhrase(taps.map((p, i) => ({ midi: midiAt(tuning, p), dur: notes[i]!.dur })), 90)}>
          ▶ {t('licks.hear')}
        </SecondaryButton>
        <SecondaryButton disabled={taps.length === 0} onClick={() => setTaps((x) => x.slice(0, -1))}>
          ↶ {t('licks.undo')}
        </SecondaryButton>
        <SecondaryButton disabled={taps.length === 0} onClick={() => setTaps([])}>
          {t('licks.clear')}
        </SecondaryButton>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">{t('licks.name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('licks.defaultName', { n: count + 1 })}
          className="min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-lg text-ink"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <PrimaryButton disabled={taps.length < 2} onClick={() => void save()}>
          {t('licks.save')}
        </PrimaryButton>
        <SecondaryButton onClick={onBack}>{t('challenges.back')}</SecondaryButton>
      </div>
    </div>
  );
}
