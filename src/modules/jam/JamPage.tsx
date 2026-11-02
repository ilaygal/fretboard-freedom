import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard } from '@/components/fretboard';
import { Chip, ChipRow, PageHeader, SecondaryButton } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { useBand } from '@/app/useBand';
import { StageBar, prettySymbol } from '@/components/stage/StageBar';
import { playMidi } from '@/audio/play';
import { PROGRESSIONS, STYLES, getProgression, getStyle } from '@/content/backing';
import { FLAT_NAMES, midiAt, preferredTonic, prettyNote, scalePositions, type FretPos, type LabelMode } from '@/theory';
import {
  WHEELS,
  chordAt,
  clampToStyle,
  jamMarkers,
  jamTonic,
  jamTrack,
  randomJam,
  withProgression,
  withStyle,
  type JamChoice,
  type Wheels,
  zoomTo,
} from './model';

const ROLE_BG: Record<string, string> = {
  root: 'bg-role-root',
  chord: 'bg-role-chord',
  scale: 'bg-role-scale',
  blue: 'bg-role-blue',
  avoid: 'bg-role-avoid',
  target: 'bg-role-target',
};

/** The last jam, so moving between Free Play and the Improv Lab keeps the same groove. */
let remembered: JamChoice | null = null;

export function JamPage({ lab }: { lab: boolean }) {
  const { t } = useTranslation();
  const { profile, settings, tuning, updateSettings } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
  const strict = settings.strictSpelling;

  const [choice, setChoice] = useState<JamChoice>(() => {
    const liked = profile?.background.styles ?? [];
    const c = !lab || !remembered ? randomJam(Math.random, liked, remembered ?? undefined) : remembered;
    remembered = c;
    return c;
  });
  const [wheels, setWheels] = useState<Wheels>('map');
  const [positionIndex, setPositionIndex] = useState<number | null>(lab ? 1 : null);
  const [mix, setMix] = useState(settings.backingMix);

  const tonic = jamTonic(choice);
  const style = getStyle(choice.styleId);
  const prog = getProgression(choice.progressionId);
  const { chords, track } = useMemo(() => jamTrack(choice, strict), [choice, strict]);
  const { playing, pos, toggle } = useBand(track, choice.bpm, mix);
  const { now, next } = chordAt(chords, pos.bar);
  const changeComing = playing && pos.beat === 3 && next.symbol !== now.symbol;

  const positions = useMemo(() => scalePositions(tuning, tonic, choice.scale, settings.fretCount), [tuning, tonic, choice.scale, settings.fretCount]);
  const position = positionIndex ? (positions[positionIndex - 1] ?? null) : null;
  // With a box chosen, zoom the neck to it (plus a little either side, to see how it connects).
  const range = useMemo(() => (position ? zoomTo(position.span, settings.fretCount) : { from: 0, to: settings.fretCount }), [position, settings.fretCount]);

  const markers = useMemo(
    () =>
      jamMarkers({
        tuning,
        range,
        tonic,
        scale: choice.scale,
        chord: now,
        upcoming: changeComing ? next : null,
        labelMode: settings.labelMode,
        wheels,
        position,
        strict,
      }),
    [tuning, range, tonic, choice.scale, now, next, changeComing, settings.labelMode, wheels, position, strict],
  );

  const update = useCallback((c: JamChoice) => {
    remembered = c;
    setChoice(c);
  }, []);

  const surprise = useCallback(() => {
    update(randomJam(Math.random, profile?.background.styles ?? [], choice));
    setPositionIndex(lab ? 1 : null);
  }, [choice, lab, profile, update]);

  // Mix: apply at once, save after the slider settles.
  const saveTimer = useRef<number | undefined>(undefined);
  const changeMix = (ch: keyof typeof mix, v: number) => {
    const m = { ...mix, [ch]: v };
    setMix(m);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void updateSettings({ backingMix: m }), 500);
  };

  const legend: [string, string][] = [
    ['root', 'home'],
    ['chord', 'chord'],
    ...(wheels === 'map' ? ([['scale', 'scale']] as [string, string][]) : []),
    ...(lab && wheels === 'map' ? ([['blue', 'blue'], ['avoid', 'avoid']] as [string, string][]) : []),
    ['target', 'next'],
  ];

  const onTap = useCallback((p: FretPos) => playMidi(midiAt(tuning, p)), [tuning]);
  const simple = settings.theoryLevel === 'simple';
  const labelModes: LabelMode[] = ['note', 'interval', 'solfege', 'none'];

  return (
    <div className="pb-16">
      <PageHeader title={t(lab ? 'home.improv' : 'home.freePlay')} />

      <StageBar
        now={now.symbol}
        next={next.symbol}
        changeComing={changeComing}
        bar={pos.bar}
        bars={chords.length}
        beat={pos.beat}
        playing={playing}
        onToggle={toggle}
      />

      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <SecondaryButton onClick={surprise} className="flex-1">
            🎲 {t('jam.surprise')}
          </SecondaryButton>
        </div>
        <p className="text-lg">
          {t('jam.summary', {
            key: `${prettyNote(tonic)} ${t(prog.mode === 'minor' ? 'jam.minor' : 'jam.major')}`,
            style: t(`jam.styles.${style.id}`),
            bpm: choice.bpm,
          })}{' '}
          <span className="text-muted">{t('jam.playWith', { scale: `${prettyNote(tonic)} ${t(`scales.${choice.scale}`)}` })}</span>
        </p>

        {lab && (
          <>
            <ChipRow label={t('jam.wheels')}>
              {WHEELS.map((w) => (
                <Chip key={w} selected={w === wheels} onClick={() => setWheels(w)}>
                  {t(`jam.wheelModes.${w}`)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label={t('jam.position')}>
              <Chip selected={positionIndex === null} onClick={() => setPositionIndex(null)}>
                {t('explorer.wholeNeck')}
              </Chip>
              {positions.map((p) => (
                <Chip key={p.index} selected={p.index === positionIndex} onClick={() => setPositionIndex(p.index)} className="min-w-14">
                  {t('jam.box', { n: p.index, fret: p.span.from })}
                </Chip>
              ))}
            </ChipRow>
          </>
        )}

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base" aria-label={t('jam.legendTitle')}>
          {legend.map(([role, key]) => (
            <li key={role} className="flex items-center gap-1.5">
              <span className={`inline-block size-3.5 shrink-0 rounded-full ${ROLE_BG[role]}`} /> {t(`jam.short.${key}`)}
            </li>
          ))}
        </ul>

        <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
          <Fretboard
            tuning={tuning}
            range={range}
            orientation={orientation}
            leftHanded={settings.leftHanded}
            markers={markers}
            regions={position ? [position.span] : []}
            onTap={onTap}
            className={orientation === 'horizontal' ? 'w-full min-w-[900px]' : 'w-full'}
            label={`${prettyNote(tonic)} ${t(`scales.${choice.scale}`)}, ${now.symbol}`}
          />
        </div>

        <details className="rounded-2xl bg-surface p-3">
          <summary className="min-h-10 cursor-pointer font-semibold">{t('jam.legendTitle')}</summary>
        <div className="mt-2 flex flex-col gap-1.5 text-base">
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded-full bg-role-root" /> {t('jam.legendHome', { note: prettyNote(tonic) })}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded-full bg-role-chord" /> {t('jam.legendChord', { chord: prettySymbol(now.symbol) })}
          </span>
          {wheels === 'map' && (
            <span className="flex items-center gap-2">
              <span className="inline-block size-4 shrink-0 rounded-full bg-role-scale" /> {t('jam.legendScale')}
            </span>
          )}
          {lab && wheels === 'map' && (
            <>
              <span className="flex items-center gap-2">
                <span className="inline-block size-4 shrink-0 rounded-full bg-role-blue" /> {t('jam.legendBlue')}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-4 shrink-0 rounded-full bg-role-avoid" /> {t(simple ? 'jam.legendAvoidSimple' : 'jam.legendAvoid')}
              </span>
            </>
          )}
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded-full bg-role-target" /> {t('jam.legendNext')}
          </span>
        </div>

        </details>

        <ChipRow label={t('jam.scale')}>
          {prog.scales.map((s) => (
            <Chip key={s} selected={s === choice.scale} onClick={() => update({ ...choice, scale: s })}>
              {t(`scales.${s}`)}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={t('jam.groove')}>
          {STYLES.map((s) => (
            <Chip key={s.id} selected={s.id === choice.styleId} onClick={() => update(withStyle(choice, s.id))}>
              {t(`jam.styles.${s.id}`)}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={t('jam.chords')}>
          {PROGRESSIONS.filter((p) => p.styles.includes(choice.styleId)).map((p) => {
            const preview = jamTrack({ ...choice, progressionId: p.id }, strict).chords;
            const unique = preview.filter((c, i) => i === 0 || c.symbol !== preview[i - 1]!.symbol).slice(0, 5);
            return (
              <Chip key={p.id} selected={p.id === choice.progressionId} onClick={() => update(withProgression(choice, p.id))}>
                <span className="block text-sm opacity-70">{t(`jam.progressions.${p.id}`)}</span>
                <span className="block whitespace-nowrap">{unique.map((c) => prettySymbol(c.symbol)).join(' ')}</span>
              </Chip>
            );
          })}
        </ChipRow>

        <ChipRow label={t('explorer.key')}>
          {FLAT_NAMES.map((_, pc) => (
            <Chip key={pc} selected={pc === choice.tonicPc} onClick={() => update({ ...choice, tonicPc: pc })} className="min-w-14">
              {prettyNote(preferredTonic(pc, prog.mode === 'minor' ? 'minor' : 'major'))}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={t('jam.tempo')}>
          <Chip aria-label={t('jam.slower')} onClick={() => update({ ...choice, bpm: clampToStyle(choice.styleId, choice.bpm - 4) })} className="min-w-14">
            −
          </Chip>
          <span className="flex min-h-12 min-w-20 items-center justify-center text-xl font-bold tabular-nums">{choice.bpm}</span>
          <Chip aria-label={t('jam.faster')} onClick={() => update({ ...choice, bpm: clampToStyle(choice.styleId, choice.bpm + 4) })} className="min-w-14">
            +
          </Chip>
        </ChipRow>

        {lab && (
          <ChipRow label={t('explorer.labels')}>
            {labelModes.map((m) => (
              <Chip key={m} selected={m === settings.labelMode} onClick={() => void updateSettings({ labelMode: m })}>
                {t(`explorer.labelModes.${m}`)}
              </Chip>
            ))}
          </ChipRow>
        )}

        <section className="space-y-3 rounded-3xl bg-surface p-4" aria-label={t('jam.mix')}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('jam.mix')}</h2>
          {(['drums', 'bass', 'chords'] as const).map((ch) => (
            <label key={ch} className="flex items-center gap-3">
              <span className="w-20 font-semibold">{t(`jam.channels.${ch}`)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mix[ch]}
                onChange={(e) => changeMix(ch, Number(e.target.value))}
                className="h-12 flex-1 accent-[var(--color-spot)]"
              />
            </label>
          ))}
          <p className="text-sm text-muted">{t('jam.headphones')}</p>
        </section>
      </div>
    </div>
  );
}
