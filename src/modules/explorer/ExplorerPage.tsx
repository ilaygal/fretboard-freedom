import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fretboard } from '@/components/fretboard';
import { Chip, ChipRow, PageHeader } from '@/components/ui';
import { useProfile } from '@/app/profile';
import { useMediaQuery } from '@/app/useMediaQuery';
import { playMidi } from '@/audio/play';
import {
  FLAT_NAMES,
  midiAt,
  octaveShapes,
  plainIntervalName,
  prettyInterval,
  preferredTonic,
  prettyNote,
  type FretPos,
  type LabelMode,
  type ScaleId,
} from '@/theory';
import { buildExplorerView, describeTap, FOCUS_SPAN, FRIENDLY_SCALES, MORE_SCALES, shiftFocus, type TapInfo } from './model';

export function ExplorerPage() {
  const { t } = useTranslation();
  const { settings, tuning, updateSettings } = useProfile();
  const narrow = useMediaQuery('(max-width: 700px)');
  const orientation = settings.orientation === 'auto' ? (narrow ? 'vertical' : 'horizontal') : settings.orientation;
  const range = useMemo(() => ({ from: 0, to: settings.fretCount }), [settings.fretCount]);

  const [tonicPc, setTonicPc] = useState(9); // A: the most common key to start improvising in
  const [scale, setScale] = useState<ScaleId>('minorPentatonic');
  const [focus, setFocus] = useState<{ from: number; to: number } | null>(null);
  const [tap, setTap] = useState<TapInfo | null>(null);
  const [showOctaves, setShowOctaves] = useState(true);
  const labelMode = settings.labelMode;

  const view = useMemo(
    () => buildExplorerView({ tonicPc, scale, labelMode, focus }, settings, tuning, range),
    [tonicPc, scale, labelMode, focus, settings, tuning, range],
  );

  const onTap = useCallback(
    (pos: FretPos) => {
      playMidi(midiAt(tuning, pos));
      setTap(describeTap(view, tuning, pos));
    },
    [tuning, view],
  );

  const move = useCallback(
    (delta: number) => setFocus((f) => shiftFocus(f ?? { from: 0, to: FOCUS_SPAN - 1 }, delta, settings.fretCount)),
    [settings.fretCount],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'Escape') setFocus(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const labelModes: LabelMode[] = ['note', 'interval', 'degree', 'solfege', 'none'];
  const simple = settings.theoryLevel === 'simple';

  return (
    <div className="pb-10">
      <PageHeader title={t('home.explore')} />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4">
        <ChipRow label={t('explorer.key')}>
          {FLAT_NAMES.map((_, pc) => {
            const name = preferredTonic(pc, scale);
            return (
              <Chip key={pc} selected={pc === tonicPc} onClick={() => setTonicPc(pc)} className="min-w-14">
                {prettyNote(name)}
              </Chip>
            );
          })}
        </ChipRow>

        <ChipRow label={t('explorer.startHere')}>
          {FRIENDLY_SCALES.map((id) => (
            <Chip key={id} selected={id === scale} onClick={() => setScale(id)} title={t(`scaleHints.${id}`)}>
              {t(`scales.${id}`)}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label={t('explorer.moreColours')}>
          {MORE_SCALES.map((id) => (
            <Chip key={id} selected={id === scale} onClick={() => setScale(id)} title={t(`scaleHints.${id}`)}>
              {t(`scales.${id}`)}
            </Chip>
          ))}
        </ChipRow>
        <p className="text-muted">{t(`scaleHints.${scale}`)}</p>

        <ChipRow label={t('explorer.labels')}>
          {labelModes.map((m) => (
            <Chip key={m} selected={m === labelMode} onClick={() => void updateSettings({ labelMode: m })}>
              {t(`explorer.labelModes.${m}`)}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label={t('explorer.focus')}>
          <Chip selected={focus === null} onClick={() => setFocus(null)}>
            {t('explorer.wholeNeck')}
          </Chip>
          <Chip aria-label={t('explorer.earlier')} onClick={() => move(-1)} className="min-w-14">
            ◀
          </Chip>
          <Chip selected={focus !== null} onClick={() => setFocus(focus ?? { from: 0, to: FOCUS_SPAN - 1 })}>
            {t('explorer.frets', focus ?? { from: 0, to: FOCUS_SPAN - 1 })}
          </Chip>
          <Chip aria-label={t('explorer.later')} onClick={() => move(1)} className="min-w-14">
            ▶
          </Chip>
        </ChipRow>

        <ChipRow label={t('notes.showOctaves')}>
          <Chip selected={showOctaves} onClick={() => setShowOctaves(!showOctaves)}>
            {showOctaves ? t('settings.on') : t('settings.off')}
          </Chip>
        </ChipRow>

        <div aria-live="polite" className="min-h-16 rounded-2xl bg-surface p-3 text-lg">
          {tap ? (
            <>
              <strong>
                {t('explorer.tapped', { note: prettyNote(tap.name), string: tap.pos.string, fret: tap.pos.fret })}
              </strong>{' '}
              {tap.interval
                ? t('explorer.inScale', {
                    meaning: simple ? plainIntervalName(tap.interval) : `${prettyInterval(tap.interval)}, ${plainIntervalName(tap.interval)}`,
                  })
                : t('explorer.notInScale')}
            </>
          ) : (
            <span className="text-muted">{t('explorer.tapHint')}</span>
          )}
        </div>

        <div className="flex flex-col gap-2 text-base">
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded-full bg-role-root" /> {t('explorer.legendRoot', { note: prettyNote(view.tonic) })}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded-full bg-role-scale" /> {t('explorer.legendScale')}
          </span>
          {scale === 'blues' && (
            <span className="flex items-center gap-2">
              <span className="inline-block size-4 shrink-0 rounded-full bg-role-blue" /> {t('explorer.legendBlue')}
            </span>
          )}
        </div>
        {simple && <p className="text-sm text-muted">{t('explorer.whatIsRoot')}</p>}

        <div className={orientation === 'horizontal' ? '-mx-4 overflow-x-auto px-4' : 'mx-auto max-w-md'}>
          <Fretboard
            tuning={tuning}
            range={range}
            orientation={orientation}
            leftHanded={settings.leftHanded}
            markers={view.markers}
            regions={focus ? [focus] : []}
            connections={tap && showOctaves ? octaveShapes(tuning, tap.pos, range).connections : []}
            onTap={onTap}
            className={orientation === 'horizontal' ? 'w-full min-w-[900px]' : 'w-full'}
            label={`${view.tonic} ${t(`scales.${scale}`)}`}
          />
        </div>
      </div>
    </div>
  );
}
