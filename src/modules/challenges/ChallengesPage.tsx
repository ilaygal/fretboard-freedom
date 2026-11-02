import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard, type FretMarker } from '@/components/fretboard';
import { Chip, ChipRow, PageHeader, PrimaryButton, SecondaryButton } from '@/components/ui';
import { StageBar } from '@/components/stage/StageBar';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { useBand } from '@/app/useBand';
import { useMic } from '@/app/useMic';
import { backing } from '@/audio/backing/player';
import { PitchStabilizer } from '@/audio/pitch/analysis';
import { canRecord, startRecording, type ActiveRecording } from '@/audio/recorder';
import { CHALLENGES, getChallenge, type ChallengeDef } from '@/content/challenges';
import { getProgression } from '@/content/backing';
import { analyseImprov, tickToBarBeat, type HeardNote, type ImprovReport } from '@/domain/improv/analysis';
import { PPQ } from '@/domain/backing/arrange';
import { repos, type Recording } from '@/data';
import {
  FLAT_NAMES,
  getScale,
  midiToName,
  preferredTonic,
  prettyNote,
  scalePositions,
  windowAround,
  type ChordInfo,
} from '@/theory';
import { chordAt, jamMarkers, jamTonic, jamTrack } from '@/modules/jam/model';
import { challengeJam, pickNewBox, verdict, wheelsFor, yourTurn, type Verdict } from './model';

type View = { kind: 'list' } | { kind: 'run'; id: string } | { kind: 'report'; id: string; report: ImprovReport; verdict: Verdict; heard: boolean; recordingId?: string };

export function ChallengesPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [tonicPc, setTonicPc] = useState(9);
  return (
    <div className="pb-16">
      <PageHeader title={t('challenges.title')} />
      {view.kind === 'list' && <ChallengeList onPick={(id) => setView({ kind: 'run', id })} tonicPc={tonicPc} setTonicPc={setTonicPc} />}
      {view.kind === 'run' && (
        <ChallengeRun
          key={view.id}
          def={getChallenge(view.id)}
          tonicPc={tonicPc}
          onDone={(report, v, heard, recordingId) => setView({ kind: 'report', id: view.id, report, verdict: v, heard, recordingId })}
          onQuit={() => setView({ kind: 'list' })}
        />
      )}
      {view.kind === 'report' && (
        <ReportView
          def={getChallenge(view.id)}
          report={view.report}
          verdict={view.verdict}
          heard={view.heard}
          recordingId={view.recordingId}
          onAgain={() => setView({ kind: 'run', id: view.id })}
          onList={() => setView({ kind: 'list' })}
        />
      )}
    </div>
  );
}

/* ---------- List ---------- */

function ChallengeList({ onPick, tonicPc, setTonicPc }: { onPick: (id: string) => void; tonicPc: number; setTonicPc: (pc: number) => void }) {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [best, setBest] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!profile) return;
    void repos.attempts.list(profile.id).then((rows) => {
      const done: Record<string, boolean> = {};
      for (const r of rows) if (r.drillId.startsWith('improv.') && r.correct) done[r.drillId.slice(7)] = true;
      setBest(done);
    });
  }, [profile]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
      <p className="text-lg">{t('challenges.intro')}</p>
      <ChipRow label={t('explorer.key')}>
        {FLAT_NAMES.map((_, pc) => (
          <Chip key={pc} selected={pc === tonicPc} onClick={() => setTonicPc(pc)} className="min-w-14">
            {prettyNote(preferredTonic(pc, 'major'))}
          </Chip>
        ))}
      </ChipRow>
      <ul className="space-y-3">
        {CHALLENGES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="flex min-h-20 w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-start active:scale-[0.99]"
            >
              <span className="flex w-10 shrink-0 justify-center text-2xl" aria-hidden="true">
                {best[c.id] ? '★' : '☆'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{t(`challenges.items.${c.id}.title`)}</span>
                <span className="block text-muted">{t(`challenges.items.${c.id}.how`)}</span>
              </span>
              <span className="shrink-0 text-sm text-muted">{t('challenges.level', { n: c.level })}</span>
            </button>
          </li>
        ))}
      </ul>
      <Recordings />
    </div>
  );
}

/* ---------- Run ---------- */

function ChallengeRun({
  def,
  tonicPc,
  onDone,
  onQuit,
}: {
  def: ChallengeDef;
  tonicPc: number;
  onDone: (r: ImprovReport, v: Verdict, heard: boolean, recordingId?: string) => void;
  onQuit: () => void;
}) {
  const { t } = useTranslation();
  const { profile, settings, tuning } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;

  const choice = useMemo(() => challengeJam(def, tonicPc), [def, tonicPc]);
  const tonic = jamTonic(choice);
  const { chords, track } = useMemo(() => jamTrack(choice, settings.strictSpelling), [choice, settings.strictSpelling]);
  const { playing, pos, toggle } = useBand(track, choice.bpm, settings.backingMix);
  const [absBar, setAbsBar] = useState(0);

  const positions = useMemo(() => scalePositions(tuning, tonic, choice.scale, settings.fretCount), [tuning, tonic, choice.scale, settings.fretCount]);
  const [boxIndex] = useState(() => (def.rule.kind === 'newPosition' ? pickNewBox(Math.random, positions.length) : 0));
  const box = boxIndex ? (positions[boxIndex - 1] ?? null) : null;
  const range = box ? windowAround(box.span, settings.fretCount) : { from: 0, to: settings.fretCount };

  // Listening: every stable note is stamped with the bar and beat it was played on.
  const heard = useRef<HeardNote[]>([]);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const stabilizer = useRef(new PitchStabilizer());
  const mic = useMic((frame) => {
    const midi = stabilizer.current.push(frame);
    if (midi === null) return;
    const ticks = backing.ticksNow();
    if (ticks === null) return;
    // The stabilizer needs ~4 frames (~130 ms) plus the device's measured delay.
    const delaySec = 0.13 + settings.latencyMs / 1000;
    const delayTicks = (delaySec * backing.bpmNow() * PPQ) / 60;
    heard.current.push({ midi, ...tickToBarBeat(ticks, delayTicks, PPQ) });
    setLastNote(midiToName(midi, settings.accidentals));
  });

  // Recording (band + mic).
  const recording = useRef<ActiveRecording | null>(null);
  const [record, setRecord] = useState(false);

  const finish = useCallback(async () => {
    if (backing.playing) toggle();
    let recordingId: string | undefined;
    if (recording.current && profile) {
      const r = await recording.current.stop();
      recording.current = null;
      recordingId = crypto.randomUUID();
      const rec: Recording = {
        id: recordingId,
        profileId: profile.id,
        at: Date.now(),
        title: `${t(`challenges.items.${def.id}.title`)} · ${prettyNote(tonic)}`,
        mime: r.mime,
        blob: r.blob,
        seconds: r.seconds,
      };
      await repos.recordings.add(rec);
    }
    const scalePcs = getScale(tonic, choice.scale).notes.map((n) => n.pc);
    const report = analyseImprov(heard.current.filter((h) => h.bar < def.bars), def.rule, {
      chords,
      scalePcs,
      tuning,
      maxFret: settings.fretCount,
      box: box?.notes,
      bars: def.bars,
    });
    const v = verdict(def, report);
    const listened = mic.state === 'on';
    mic.stop();
    if (profile && listened) {
      await repos.attempts.add({
        profileId: profile.id,
        drillId: `improv.${def.id}`,
        itemKey: `challenge:${def.id}`,
        correct: v.passed,
        ms: 0,
        at: Date.now(),
        input: 'mic',
      });
    }
    onDone(report, v, listened, recordingId);
  }, [toggle, profile, t, def, tonic, choice.scale, chords, tuning, settings.fretCount, box, mic, onDone]);

  // Count bars since Play; stop after the challenge's length.
  useEffect(() => {
    const ticks = backing.ticksNow();
    if (ticks === null) return;
    const bar = Math.floor(ticks / (PPQ * 4));
    setAbsBar(bar);
    if (bar >= def.bars) void finish();
  }, [pos, def.bars, finish]);

  const start = () => {
    heard.current = [];
    stabilizer.current.reset();
    setAbsBar(0);
    if (record && canRecord()) {
      try {
        recording.current = startRecording(mic.source());
      } catch {
        recording.current = null;
      }
    }
    toggle();
  };

  const { now, next } = chordAt(chords, pos.bar);
  const changeComing = playing && pos.beat === 3 && next.symbol !== now.symbol;
  const mine = yourTurn(def, absBar);

  const markers: FretMarker[] = useMemo(() => {
    const upcoming = changeComing ? next : null;
    let m = jamMarkers({
      tuning,
      range,
      tonic,
      scale: choice.scale,
      chord: now,
      upcoming,
      labelMode: settings.labelMode,
      wheels: wheelsFor(def),
      position: box,
      strict: settings.strictSpelling,
    });
    if (def.rule.kind === 'strings') {
      const allowed = def.rule.strings;
      m = m.map((x) => (allowed.includes(x.pos.string) ? x : { ...x, role: 'ghost' as const }));
    }
    if (def.rule.kind === 'targetThird') {
      const target: ChordInfo = changeComing ? next : now;
      const third = target.tones.find((x) => x.interval === '3' || x.interval === 'b3');
      m = m.map((x) =>
        third && x.role !== 'ghost' && isPc(tuning, x.pos, third.pc)
          ? { ...x, role: 'target' as const }
          : x,
      );
    }
    return m;
  }, [tuning, range, tonic, choice.scale, now, next, changeComing, settings.labelMode, settings.strictSpelling, def, box]);

  return (
    <>
      <StageBar
        now={now.symbol}
        next={next.symbol}
        changeComing={changeComing}
        bar={playing ? Math.min(absBar, def.bars - 1) : 0}
        bars={def.bars}
        beat={pos.beat}
        playing={playing}
        onToggle={playing ? () => void finish() : start}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
        <section className="rounded-3xl bg-surface p-4">
          <h2 className="text-2xl font-black">{t(`challenges.items.${def.id}.title`)}</h2>
          <p className="text-lg">{t(`challenges.items.${def.id}.how`)}</p>
          {box && <p className="mt-1 font-semibold text-spot">{t('challenges.yourBox', { n: box.index, fret: box.span.from })}</p>}
          <p className="mt-1 text-muted">
            {t('jam.summary', {
              key: `${prettyNote(tonic)} ${t(getProgression(def.progressionId).mode === 'minor' ? 'jam.minor' : 'jam.major')}`,
              style: t(`jam.styles.${def.styleId}`),
              bpm: choice.bpm,
            })}
          </p>
        </section>

        {def.rule.kind === 'callResponse' && playing && (
          <div className={`rounded-2xl p-4 text-center text-2xl font-black ${mine ? 'bg-spot text-stage' : 'bg-surface text-muted'}`} aria-live="polite">
            {mine ? t('challenges.yourTurn') : t('challenges.listen')}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Chip selected={mic.state === 'on'} onClick={() => (mic.state === 'on' ? mic.stop() : void mic.start())} disabled={playing}>
            🎤 {mic.state === 'on' ? t('challenges.listening') : t('challenges.listenToMe')}
          </Chip>
          {canRecord() && (
            <Chip selected={record} onClick={() => setRecord(!record)} disabled={playing}>
              ⏺ {t('challenges.record')}
            </Chip>
          )}
          <Chip onClick={onQuit} disabled={playing}>
            {t('challenges.back')}
          </Chip>
        </div>
        {mic.error && <p className="text-role-root">{t(`notes.micErrors.${mic.error}`)}</p>}
        <p className="text-sm text-muted">{mic.state === 'on' ? t('challenges.headphones') : t('challenges.micWhy')}</p>
        {mic.state === 'on' && (
          <p className="text-lg" aria-live="polite">
            {t('challenges.heard', { count: heard.current.length })} {lastNote && <strong>{prettyNote(lastNote.replace(/\d+$/, ''))}</strong>}
          </p>
        )}

        <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
          <Fretboard
            tuning={tuning}
            range={range}
            orientation={orientation}
            leftHanded={settings.leftHanded}
            markers={mine ? markers : markers.map((m) => ({ ...m, role: 'ghost' as const }))}
            regions={box ? [box.span] : def.rule.kind === 'strings' ? [{ from: range.from, to: range.to, strings: def.rule.strings }] : []}
            className={orientation === 'horizontal' ? `w-full ${box ? '' : 'min-w-[900px]'}` : 'w-full'}
            label={t(`challenges.items.${def.id}.title`)}
          />
        </div>
      </div>
    </>
  );
}

function isPc(tuning: Parameters<typeof scalePositions>[0], pos: { string: number; fret: number }, pc: number) {
  const open = tuning.lowToHigh[tuning.lowToHigh.length - pos.string]!;
  return (open + pos.fret) % 12 === pc;
}

/* ---------- Report ---------- */

function ReportView({
  def,
  report,
  verdict: v,
  heard,
  recordingId,
  onAgain,
  onList,
}: {
  def: ChallengeDef;
  report: ImprovReport;
  verdict: Verdict;
  heard: boolean;
  recordingId?: string;
  onAgain: () => void;
  onList: () => void;
}) {
  const { t } = useTranslation();
  const { settings } = useProfile();
  const pct = (x: number) => Math.round(x * 100);
  const total = report.registers.low + report.registers.mid + report.registers.high || 1;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
      <section className="rounded-3xl bg-surface p-5 text-center" aria-live="polite">
        <h2 className="text-xl font-bold">{t(`challenges.items.${def.id}.title`)}</h2>
        {heard ? (
          <>
            <div className="my-2 text-5xl text-spot" aria-label={t('challenges.stars', { n: v.stars })}>
              {'★'.repeat(v.stars)}
              <span className="text-line">{'★'.repeat(3 - v.stars)}</span>
            </div>
            <div className="text-2xl font-black">{v.passed ? t('challenges.done') : t('challenges.almost')}</div>
          </>
        ) : (
          <p className="mt-2 text-lg">{t('challenges.noMic')}</p>
        )}
      </section>

      {heard && report.notes > 0 && (
        <section className="space-y-2 rounded-3xl bg-surface p-4 text-lg">
          <p>{t('challenges.r.notes', { count: report.notes })}</p>
          <p>{t('challenges.r.chordNotes', { pct: pct(report.chordTonePct) })}</p>
          <p>{t('challenges.r.inside', { pct: pct(report.insidePct) })}</p>
          {report.lowest !== null && report.highest !== null && (
            <p>
              {t('challenges.r.range', {
                low: prettyNote(midiToName(report.lowest, settings.accidentals).replace(/\d+$/, '')),
                high: prettyNote(midiToName(report.highest, settings.accidentals).replace(/\d+$/, '')),
                semis: report.highest - report.lowest,
              })}
            </p>
          )}
          <div className="pt-1">
            <div className="mb-1 text-sm text-muted">{t('challenges.r.registers')}</div>
            <div className="flex h-4 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="bg-role-scale" style={{ width: `${(report.registers.low / total) * 100}%` }} />
              <div className="bg-role-chord" style={{ width: `${(report.registers.mid / total) * 100}%` }} />
              <div className="bg-role-target" style={{ width: `${(report.registers.high / total) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-sm text-muted">
              <span>{t('challenges.r.low')}</span>
              <span>{t('challenges.r.mid')}</span>
              <span>{t('challenges.r.high')}</span>
            </div>
          </div>
          {def.rule.kind === 'targetThird' && <p>{t('challenges.r.thirds', { hits: report.detail.hits ?? 0, tries: report.detail.tries ?? 0 })}</p>}
          {def.rule.kind === 'fewNotes' && <p>{t('challenges.r.distinct', { count: report.distinctNotes })}</p>}
        </section>
      )}

      {heard && (
        <section className="space-y-1 rounded-3xl border border-line p-4 text-lg">
          {v.tips.map((tip) => (
            <p key={tip}>💡 {t(`challenges.tips.${tip}`)}</p>
          ))}
        </section>
      )}

      {recordingId && <RecordingPlayer id={recordingId} />}

      <div className="flex gap-2">
        <PrimaryButton onClick={onAgain} className="flex-1">
          {t('challenges.again')}
        </PrimaryButton>
        <SecondaryButton onClick={onList} className="flex-1">
          {t('challenges.another')}
        </SecondaryButton>
      </div>
    </div>
  );
}

/* ---------- Recordings ---------- */

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function RecordingPlayer({ id }: { id: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [rec, setRec] = useState<Recording | null>(null);
  useEffect(() => {
    if (profile) void repos.recordings.list(profile.id).then((rs) => setRec(rs.find((r) => r.id === id) ?? null));
  }, [profile, id]);
  const url = useObjectUrl(rec?.blob ?? null);
  if (!url) return null;
  return (
    <section className="space-y-2 rounded-3xl bg-surface p-4">
      <h3 className="font-bold">{t('challenges.listenBack')}</h3>
      <audio controls src={url} className="w-full" />
    </section>
  );
}

function Recordings() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [list, setList] = useState<Recording[]>([]);
  const load = useCallback(() => {
    if (profile) void repos.recordings.list(profile.id).then(setList);
  }, [profile]);
  useEffect(load, [load]);
  if (list.length === 0) return null;
  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('challenges.recordings')}</h2>
      {list.map((r) => (
        <RecordingRow key={r.id} rec={r} onDelete={() => void repos.recordings.remove(r.id).then(load)} />
      ))}
      <p className="text-sm text-muted">{t('challenges.recordingsLocal')}</p>
    </section>
  );
}

function RecordingRow({ rec, onDelete }: { rec: Recording; onDelete: () => void }) {
  const { t } = useTranslation();
  const url = useObjectUrl(rec.blob);
  return (
    <div className="space-y-2 rounded-2xl bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{rec.title}</div>
          <div className="text-sm text-muted">
            {new Date(rec.at).toLocaleString()} · {Math.round(rec.seconds)}s
          </div>
        </div>
        <Chip onClick={onDelete} aria-label={t('challenges.delete')}>
          🗑
        </Chip>
      </div>
      {url && <audio controls src={url} className="w-full" />}
    </div>
  );
}
