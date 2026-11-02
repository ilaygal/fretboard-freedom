import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '@/components/ui';
import { prettyNote } from '@/theory';

/** "Bb7" -> "B♭7": pretty root, suffix untouched. */
export function prettySymbol(s: string): string {
  const root = /^[A-G][#b]?/.exec(s)?.[0];
  return root ? prettyNote(root) + s.slice(root.length) : s;
}

export interface StageBarProps {
  now: string;
  next: string;
  /** The change is one beat away: the "next" label lights up. */
  changeComing: boolean;
  bar: number;
  bars: number;
  beat: number;
  playing: boolean;
  onToggle: () => void;
}

/** The sticky "what's playing" bar under the page header: current chord, next chord, beat dots, Play. */
export function StageBar({ now, next, changeComing, bar, bars, beat, playing, onToggle }: StageBarProps) {
  const { t } = useTranslation();
  return (
    <div className="sticky top-[73px] z-10 border-b border-line bg-stage/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black tabular-nums tracking-tight" data-testid="chord-now">
              {prettySymbol(now)}
            </span>
            <span className={`text-lg font-bold ${changeComing ? 'text-role-target' : 'text-muted'}`}>
              {t('jam.next', { chord: prettySymbol(next) })}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2" aria-hidden="true">
            <span className="text-sm text-muted tabular-nums">{t('jam.bar', { bar: bar + 1, bars })}</span>
            <span className="flex gap-1">
              {[0, 1, 2, 3].map((b) => (
                <span key={b} className={`size-2.5 rounded-full ${playing && beat === b ? (b === 0 ? 'bg-spot' : 'bg-ink') : 'bg-line'}`} />
              ))}
            </span>
          </div>
        </div>
        <PrimaryButton onClick={onToggle} className="min-w-28" aria-keyshortcuts="Space">
          {playing ? t('jam.stop') : t('jam.play')}
        </PrimaryButton>
      </div>
    </div>
  );
}
