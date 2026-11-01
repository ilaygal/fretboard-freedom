import { useMemo } from 'react';
import { posKey, stringCount, type FretPos, type FretRange, type Tuning } from '@/theory';
import { computeLayout, type Orientation } from './geometry';
import type { FretMarker, FretRegion } from './types';

export interface FretboardProps {
  tuning: Tuning;
  range: FretRange;
  orientation: Orientation;
  leftHanded: boolean;
  markers: FretMarker[];
  regions?: FretRegion[];
  /** Called when any position is tapped (marked or not). */
  onTap?: (pos: FretPos) => void;
  showFretNumbers?: boolean;
  className?: string;
  /** Accessible name for the whole neck. */
  label?: string;
}

/**
 * The shared, interactive SVG fretboard. It is purely presentational:
 * callers decide which notes to show, how to label and colour them, and what a tap does.
 * Always rendered left-to-right, even in right-to-left languages.
 */
export function Fretboard({
  tuning,
  range,
  orientation,
  leftHanded,
  markers,
  regions = [],
  onTap,
  showFretNumbers = true,
  className,
  label = 'Fretboard',
}: FretboardProps) {
  const strings = stringCount(tuning);
  const layout = useMemo(
    () => computeLayout({ stringCount: strings, range, orientation, leftHanded }),
    [strings, range, orientation, leftHanded],
  );

  const positions = useMemo(() => {
    const out: FretPos[] = [];
    for (let s = 1; s <= strings; s++) for (let f = range.from; f <= range.to; f++) out.push({ string: s, fret: f });
    return out;
  }, [strings, range]);

  const visibleMarkers = markers.filter((m) => m.pos.fret >= range.from && m.pos.fret <= range.to && m.pos.string <= strings);
  const r = layout.noteRadius;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={className}
      role="group"
      aria-label={label}
      style={{ touchAction: 'manipulation', userSelect: 'none', direction: 'ltr' }}
    >
      <rect {...layout.board} className="fb-board" />

      {/* Regions behind the strings */}
      {regions.map((reg, i) => {
        const from = Math.max(reg.from, range.from);
        const to = Math.min(reg.to, range.to);
        if (to < from) return null;
        const ss = reg.strings ?? Array.from({ length: strings }, (_, k) => k + 1);
        const cells = ss.flatMap((s) => [layout.cell({ string: s, fret: from }), layout.cell({ string: s, fret: to })]);
        const x1 = Math.min(...cells.map((c) => c.x));
        const y1 = Math.min(...cells.map((c) => c.y));
        const x2 = Math.max(...cells.map((c) => c.x + c.width));
        const y2 = Math.max(...cells.map((c) => c.y + c.height));
        return (
          <rect
            key={`region-${i}`}
            x={x1 + 2}
            y={y1 + 2}
            width={x2 - x1 - 4}
            height={y2 - y1 - 4}
            rx={10}
            className="fb-region"
          />
        );
      })}

      {layout.inlays.flatMap((inlay) =>
        inlay.points.map((p, i) => <circle key={`inlay-${inlay.fret}-${i}`} cx={p.x} cy={p.y} r={6} className="fb-inlay" />),
      )}

      {layout.frets.map((f) => (
        <line key={`fret-${f.fret}`} {...f.line} className={f.isNut ? 'fb-nut' : 'fb-fret'} />
      ))}

      {Array.from({ length: strings }, (_, k) => k + 1).map((n) => (
        // Lower strings are drawn thicker, like real strings.
        <line key={`string-${n}`} {...layout.string(n)} className="fb-string" strokeWidth={0.8 + (n - 1) * 0.35} />
      ))}

      {showFretNumbers &&
        layout.fretNumbers.map((fn) => (
          <text key={`num-${fn.fret}`} x={fn.at.x} y={fn.at.y} className="fb-fret-number" textAnchor="middle" dominantBaseline="central">
            {fn.fret}
          </text>
        ))}

      {/* Markers: keyed by id, so a later animation layer can slide a marker when a shape moves. */}
      {visibleMarkers.map((m) => {
        const p = layout.note(m.pos);
        return (
          <g
            key={m.id ?? posKey(m.pos)}
            className={`fb-marker fb-role-${m.role}`}
            transform={`translate(${p.x} ${p.y})`}
            aria-hidden="true"
          >
            <circle r={r} />
            {m.label && (
              <text textAnchor="middle" dominantBaseline="central" fontSize={m.label.length > 2 ? 10.5 : 13}>
                {m.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Invisible tap targets on top, one per position. */}
      {onTap &&
        positions.map((pos) => {
          const c = layout.cell(pos);
          const marker = visibleMarkers.find((m) => m.pos.string === pos.string && m.pos.fret === pos.fret);
          return (
            <rect
              key={`tap-${posKey(pos)}`}
              {...c}
              fill="transparent"
              role="button"
              tabIndex={-1}
              aria-label={marker?.description ?? `String ${pos.string}, fret ${pos.fret}`}
              data-pos={posKey(pos)}
              onPointerDown={(e) => {
                e.preventDefault();
                onTap(pos);
              }}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
    </svg>
  );
}
