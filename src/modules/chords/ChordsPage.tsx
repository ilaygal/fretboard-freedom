import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard, type FretMarker } from '@/components/fretboard';
import { Chip, ChipRow, PageHeader, SecondaryButton } from '@/components/ui';
import { StageBar, prettySymbol } from '@/components/stage/StageBar';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { useBand } from '@/app/useBand';
import { playMidi } from '@/audio/play';
import { strum } from '@/audio/instruments/guitar';
import { getProgression, getStyle } from '@/content/backing';
import { BAR_TICKS, PPQ, arrange, chordsFor } from '@/domain/backing/arrange';
import {
  FLAT_NAMES,
  getChord,
  midiAt,
  nameChord,
  pitchClassName,
  preferredTonic,
  prettyNote,
  transposeSymbol,
  windowAround,
  type ChordTypeId,
  type FretPos,
  type FretRange,
  type VoicingKind,
} from '@/theory';
import {
  LOOKUP_TYPES,
  kindsFor,
  nearestVoicing,
  tappedNotes,
  toggleTap,
  trainerPlan,
  voiceMoves,
  voicingMarkers,
  voicingsFor,
  type TrainerKind,
} from './model';

type Tab = 'find' | 'trainer' | 'builder' | 'transpose';
const TABS: Tab[] = ['find', 'trainer', 'builder', 'transpose'];

function useNeck() {
  const { settings } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
  const wrap = orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md';
  const svgClass = (wide: boolean) => (orientation === 'horizontal' ? `w-full ${wide ? 'min-w-[900px]' : ''}` : 'w-full');
  return { orientation, wrap, svgClass };
}

export function ChordsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('find');
  return (
    <div className="pb-16">
      <PageHeader title={t('home.chords')} />
      {tab !== 'trainer' && <TabRow tab={tab} setTab={setTab} />}
      {tab === 'find' && <FindChord />}
      {tab === 'trainer' && <Trainer tabs={<TabRow tab={tab} setTab={setTab} />} />}
      {tab === 'builder' && <Builder />}
      {tab === 'transpose' && <Transpose />}
    </div>
  );
}

function TabRow({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((x) => (
          <Chip key={x} role="tab" aria-selected={x === tab} selected={x === tab} onClick={() => setTab(x)}>
            {t(`chords.tabs.${x}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/* ---------- Find a chord: every place to play it ---------- */

function FindChord() {
  const { t } = useTranslation();
  const { settings, tuning } = useProfile();
  const { orientation, wrap, svgClass } = useNeck();
  const [rootPc, setRootPc] = useState(7); // G
  const [type, setType] = useState<ChordTypeId>('maj');
  const kinds = kindsFor(type, tuning);
  const [kindPick, setKind] = useState<VoicingKind>('triad');
  const kind = kinds.includes(kindPick) ? kindPick : kinds[0]!;
  const [index, setIndex] = useState(0);
  const [wholeNeck, setWholeNeck] = useState(false);

  const minor = type.startsWith('m') && !type.startsWith('maj');
  const root = preferredTonic(rootPc, minor ? 'minor' : 'major');
  const chord = useMemo(() => getChord(root, type, { strict: settings.strictSpelling }), [root, type, settings.strictSpelling]);
  const voicings = useMemo(() => voicingsFor(tuning, chord, kind, settings.fretCount), [tuning, chord, kind, settings.fretCount]);
  const i = Math.min(index, Math.max(0, voicings.length - 1));
  const v = voicings[i] ?? null;

  // Keep your place on the neck when you change chord or shape family.
  const keepPlace = (apply: () => void) => {
    const fret = v ? (v.span.from + v.span.to) / 2 : 3;
    apply();
    setIndex(-fret - 1); // resolved below once the new voicings exist
  };
  const resolvedIndex = index < 0 ? Math.max(0, nearestVoicing(voicings, -index - 1)) : i;
  const voicing = voicings[resolvedIndex] ?? null;

  const full = { from: 0, to: settings.fretCount };
  const range: FretRange = wholeNeck || !voicing ? full : windowAround(voicing.span, settings.fretCount);
  const markers = useMemo(
    () => voicingMarkers(tuning, chord, voicing, settings.labelMode, range, true),
    [tuning, chord, voicing, settings.labelMode, range],
  );
  const hear = () => voicing && strum(voicing.notes.map((n) => midiAt(tuning, n)));
  const step = (d: number) => {
    const n = voicings.length;
    if (n) setIndex((resolvedIndex + d + n) % n);
  };
  const bass = voicing ? chord.tones[voicing.inversion] : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
      <ChipRow label={t('chords.root')}>
        {FLAT_NAMES.map((_, pc) => (
          <Chip key={pc} selected={pc === rootPc} onClick={() => keepPlace(() => setRootPc(pc))} className="min-w-14">
            {prettyNote(preferredTonic(pc, minor ? 'minor' : 'major'))}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label={t('chords.type')}>
        {LOOKUP_TYPES.map((ty) => (
          <Chip key={ty} selected={ty === type} onClick={() => keepPlace(() => setType(ty))}>
            {t(`chords.types.${ty}`)}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label={t('chords.shapes')}>
        {kinds.map((k) => (
          <Chip key={k} selected={k === kind} onClick={() => keepPlace(() => setKind(k))}>
            {t(`chords.kinds.${k}`)}
          </Chip>
        ))}
      </ChipRow>
      <p className="text-muted">{t(`chords.kindHints.${kind}`)}</p>

      <div className="flex items-center gap-2">
        <Chip aria-label={t('chords.prev')} onClick={() => step(-1)} className="min-w-14">
          ◀
        </Chip>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <div className="text-3xl font-black">{prettySymbol(chord.symbol)}</div>
          {voicing ? (
            <div className="text-sm text-muted">
              {t('chords.which', { n: resolvedIndex + 1, of: voicings.length, from: voicing.span.from })}
              {voicing.shape && ` · ${t('chords.shapeName', { shape: voicing.shape })}`}
              {voicing.reference && ` · ${t('chords.reference')}`}
              {bass && ` · ${t('chords.lowest', { note: prettyNote(bass.name) })}`}
            </div>
          ) : (
            <div className="text-sm text-muted">{t('chords.none')}</div>
          )}
        </div>
        <Chip aria-label={t('chords.next')} onClick={() => step(1)} className="min-w-14">
          ▶
        </Chip>
      </div>
      <div className="flex gap-2">
        <SecondaryButton onClick={hear} className="flex-1" disabled={!voicing}>
          {t('chords.hear')}
        </SecondaryButton>
        <SecondaryButton onClick={() => setWholeNeck(!wholeNeck)} className="flex-1">
          {wholeNeck ? t('chords.zoomIn') : t('explorer.wholeNeck')}
        </SecondaryButton>
      </div>

      <div className={wrap}>
        <Fretboard
          tuning={tuning}
          range={range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          onTap={(p) => playMidi(midiAt(tuning, p))}
          className={svgClass(wholeNeck)}
          label={chord.symbol}
        />
      </div>
      <p className="text-sm text-muted">{t('chords.greyHint')}</p>
    </div>
  );
}

/* ---------- Progression trainer: same progression, new place ---------- */

const TRAINER_PROGRESSIONS = ['popAnthem', 'sadTurn', 'threeChord', 'doowop', 'mixoRock', 'epicMinor', 'minorRock', 'twoFiveOne', 'minorTwoFive'];
const SPAN = 4;

function Trainer({ tabs }: { tabs: ReactNode }) {
  const { t } = useTranslation();
  const { settings, tuning } = useProfile();
  const { orientation, wrap, svgClass } = useNeck();
  const [progId, setProgId] = useState('popAnthem');
  const [tonicPc, setTonicPc] = useState(7);
  const [kind, setKind] = useState<TrainerKind>('triad');
  const [from, setFrom] = useState(3);
  const [help, setHelp] = useState(true);
  const prog = getProgression(progId);
  const style = getStyle(kind === 'triad' ? 'pop' : 'jazz');
  const [bpm, setBpm] = useState(80);
  const tonic = preferredTonic(tonicPc, prog.mode === 'minor' ? 'minor' : 'major');

  const chords = useMemo(() => chordsFor(tonic, prog, style, settings.strictSpelling), [tonic, prog, style, settings.strictSpelling]);
  const track = useMemo(() => {
    const arr = arrange(style, chords);
    return { events: arr.events, totalTicks: arr.totalTicks, bars: arr.bars, barTicks: BAR_TICKS, beatTicks: PPQ };
  }, [style, chords]);
  const { playing, pos, toggle } = useBand(track, bpm, settings.backingMix);

  const plan = useMemo(
    () => trainerPlan(tuning, chords, kind, { from, to: from + SPAN }, settings.fretCount),
    [tuning, chords, kind, from, settings.fretCount],
  );
  const bar = pos.bar % chords.length;
  const nextBar = (bar + 1) % chords.length;
  const now = chords[bar]!;
  const next = chords[nextBar]!;
  const changeComing = playing && pos.beat === 3;
  const win = plan?.window ?? { from, to: from + SPAN };
  const range = windowAround(win, settings.fretCount, SPAN + 2);

  const cur = plan?.path[bar] ?? null;
  const upcoming = plan?.path[nextBar] ?? null;
  const markers: FretMarker[] = useMemo(() => {
    if (!help || !cur) return [];
    const mine = voicingMarkers(tuning, now, cur, settings.labelMode, range, false);
    if (!changeComing || !upcoming) return mine;
    const nextOnes = voicingMarkers(tuning, next, upcoming, settings.labelMode, range, false)
      .filter((m) => !cur.notes.some((n) => n.string === m.pos.string && n.fret === m.pos.fret))
      .map((m) => ({ ...m, role: 'target' as const }));
    return [...mine, ...nextOnes];
  }, [help, cur, upcoming, changeComing, tuning, now, next, settings.labelMode, range]);
  const lines = help && changeComing && cur && upcoming ? voiceMoves(tuning, cur, upcoming) : [];

  const hear = useCallback(() => cur && strum(cur.notes.map((n) => midiAt(tuning, n))), [cur, tuning]);

  return (
    <>
      <StageBar
        now={now.symbol}
        next={next.symbol}
        changeComing={changeComing}
        bar={bar}
        bars={chords.length}
        beat={pos.beat}
        playing={playing}
        onToggle={toggle}
      />
      {tabs}
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
        <p className="text-lg">{t('chords.trainerIntro')}</p>
        <ChipRow label={t('chords.window')}>
          <Chip aria-label={t('explorer.earlier')} onClick={() => setFrom(Math.max(0, win.from - 1))} className="min-w-14">
            ◀
          </Chip>
          <span className="flex min-h-12 items-center px-2 text-lg font-bold">{t('explorer.frets', { from: win.from, to: win.to })}</span>
          <Chip
            aria-label={t('explorer.later')}
            onClick={() => setFrom(Math.min(settings.fretCount - SPAN, win.from + 1))}
            className="min-w-14"
          >
            ▶
          </Chip>
        </ChipRow>
        <ChipRow label={t('chords.help')}>
          <Chip selected={help} onClick={() => setHelp(true)}>
            {t('chords.showShapes')}
          </Chip>
          <Chip selected={!help} onClick={() => setHelp(false)}>
            {t('chords.namesOnly')}
          </Chip>
          <Chip onClick={hear} disabled={!cur}>
            {t('chords.hear')}
          </Chip>
        </ChipRow>

        <div className={wrap}>
          <Fretboard
            tuning={tuning}
            range={range}
            orientation={orientation}
            leftHanded={settings.leftHanded}
            markers={markers}
            regions={[win]}
            connections={lines}
            onTap={(p: FretPos) => playMidi(midiAt(tuning, p))}
            className={svgClass(false)}
            label={t('chords.tabs.trainer')}
          />
        </div>
        {!help && <p className="text-muted">{t('chords.namesOnlyHint')}</p>}

        <ChipRow label={t('jam.chords')}>
          {TRAINER_PROGRESSIONS.map((id) => {
            const p = getProgression(id);
            const tn = preferredTonic(tonicPc, p.mode === 'minor' ? 'minor' : 'major');
            const preview = chordsFor(tn, p, style).map((c) => prettySymbol(c.symbol));
            return (
              <Chip key={id} selected={id === progId} onClick={() => setProgId(id)}>
                <span className="block text-sm opacity-70">{t(`jam.progressions.${id}`)}</span>
                <span className="block whitespace-nowrap">{preview.join(' ')}</span>
              </Chip>
            );
          })}
        </ChipRow>
        <ChipRow label={t('explorer.key')}>
          {FLAT_NAMES.map((_, pc) => (
            <Chip key={pc} selected={pc === tonicPc} onClick={() => setTonicPc(pc)} className="min-w-14">
              {prettyNote(preferredTonic(pc, prog.mode === 'minor' ? 'minor' : 'major'))}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label={t('chords.shapes')}>
          <Chip selected={kind === 'triad'} onClick={() => setKind('triad')}>
            {t('chords.kinds.triad')}
          </Chip>
          <Chip selected={kind === 'drop2'} onClick={() => setKind('drop2')}>
            {t('chords.kinds.drop2')}
          </Chip>
        </ChipRow>
        <ChipRow label={t('jam.tempo')}>
          <Chip aria-label={t('jam.slower')} onClick={() => setBpm(Math.max(50, bpm - 4))} className="min-w-14">
            −
          </Chip>
          <span className="flex min-h-12 min-w-20 items-center justify-center text-xl font-bold tabular-nums">{bpm}</span>
          <Chip aria-label={t('jam.faster')} onClick={() => setBpm(Math.min(160, bpm + 4))} className="min-w-14">
            +
          </Chip>
        </ChipRow>
      </div>
    </>
  );
}

/* ---------- Chord builder: tap notes, get the name ---------- */

function Builder() {
  const { t } = useTranslation();
  const { settings, tuning } = useProfile();
  const { orientation, wrap, svgClass } = useNeck();
  const [taps, setTaps] = useState<FretPos[]>([]);
  const range = { from: 0, to: Math.min(15, settings.fretCount) };
  const spell = (pc: number) => pitchClassName(pc, settings.accidentals);
  const { pcs, bassPc } = tappedNotes(tuning, taps);
  const names = pcs.length >= 2 ? nameChord(pcs, bassPc, spell) : [];
  const lowest = taps.length ? Math.min(...taps.map((p) => midiAt(tuning, p))) : null;
  const markers: FretMarker[] = taps.map((p) => {
    const m = midiAt(tuning, p);
    return { pos: p, role: m === lowest ? 'root' : 'chord', label: prettyNote(spell(m)) };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
      <p className="text-lg">{t('chords.builderIntro')}</p>
      <div aria-live="polite" className="min-h-20 rounded-2xl bg-surface p-3">
        {names.length > 0 ? (
          <>
            <div className="text-4xl font-black">{prettySymbol(names[0]!.symbol)}</div>
            {names.length > 1 && (
              <div className="text-muted">{t('chords.alsoCalled', { names: names.slice(1).map((n) => prettySymbol(n.symbol)).join(', ') })}</div>
            )}
          </>
        ) : (
          <div className="text-muted">{pcs.length >= 2 ? t('chords.noName') : t('chords.tapMore')}</div>
        )}
      </div>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => strum(taps.map((p) => midiAt(tuning, p)))} className="flex-1" disabled={!taps.length}>
          {t('chords.hear')}
        </SecondaryButton>
        <SecondaryButton onClick={() => setTaps([])} className="flex-1" disabled={!taps.length}>
          {t('chords.clear')}
        </SecondaryButton>
      </div>
      <div className={wrap}>
        <Fretboard
          tuning={tuning}
          range={range}
          orientation={orientation}
          leftHanded={settings.leftHanded}
          markers={markers}
          onTap={(p) => {
            playMidi(midiAt(tuning, p));
            setTaps((x) => toggleTap(x, p));
          }}
          className={svgClass(true)}
          label={t('chords.tabs.builder')}
        />
      </div>
    </div>
  );
}

/* ---------- Transpose ---------- */

function Transpose() {
  const { t } = useTranslation();
  const { settings } = useProfile();
  const [text, setText] = useState('Am F C G');
  const [shift, setShift] = useState(2);
  const spell = (pc: number) => pitchClassName(pc, settings.accidentals);
  const out = text
    .split(/\s+/)
    .filter(Boolean)
    .map((sym) => {
      try {
        return prettySymbol(transposeSymbol(sym, shift, spell));
      } catch {
        return '?';
      }
    });
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
      <label className="block space-y-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">{t('chords.yourChords')}</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-14 w-full rounded-2xl border border-line bg-surface px-4 text-xl"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>
      <ChipRow label={t('chords.moveBy')}>
        <Chip aria-label={t('chords.down')} onClick={() => setShift(shift - 1)} className="min-w-14">
          −
        </Chip>
        <span className="flex min-h-12 min-w-24 items-center justify-center text-xl font-bold tabular-nums">
          {shift > 0 ? `+${shift}` : shift}
        </span>
        <Chip aria-label={t('chords.up')} onClick={() => setShift(shift + 1)} className="min-w-14">
          +
        </Chip>
      </ChipRow>
      <p className="text-muted">{t('chords.semitoneHint')}</p>
      <div className="rounded-2xl bg-surface p-4 text-3xl font-black" aria-live="polite">
        {out.join('  ')}
      </div>
      {shift < 0 && <p className="text-muted">{t('chords.capoHint', { fret: -shift })}</p>}
    </div>
  );
}
