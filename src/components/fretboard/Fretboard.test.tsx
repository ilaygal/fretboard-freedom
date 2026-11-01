import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Fretboard } from './Fretboard';
import { markersForNotes } from './markers';
import { getScale, STANDARD_TUNING } from '@/theory';

describe('<Fretboard>', () => {
  const sc = getScale('A', 'minorPentatonic');
  const notes = sc.notes.map((n) => ({ ...n, role: n.interval === 'R' ? ('root' as const) : ('scale' as const) }));
  const range = { from: 0, to: 12 };

  it('renders a marker for every scale note on the neck', () => {
    const markers = markersForNotes(STANDARD_TUNING, range, notes, 'note');
    // 5 notes, each appearing 1-2 times per string in 13 frets
    expect(markers.length).toBeGreaterThan(30);
    const { container } = render(
      <Fretboard tuning={STANDARD_TUNING} range={range} orientation="horizontal" leftHanded={false} markers={markers} />,
    );
    expect(container.querySelectorAll('.fb-marker').length).toBe(markers.length);
    expect(container.querySelectorAll('.fb-role-root').length).toBe(markers.filter((m) => m.role === 'root').length);
    expect(container.querySelector('svg')!.style.direction).toBe('ltr');
  });

  it('labels by interval when asked', () => {
    const markers = markersForNotes(STANDARD_TUNING, range, notes, 'interval');
    expect(new Set(markers.map((m) => m.label))).toEqual(new Set(['R', '♭3', '4', '5', '♭7']));
  });

  it('reports taps with the string and fret', () => {
    const onTap = vi.fn();
    render(
      <Fretboard tuning={STANDARD_TUNING} range={range} orientation="vertical" leftHanded markers={[]} onTap={onTap} />,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'String 6, fret 5' }));
    expect(onTap).toHaveBeenCalledWith({ string: 6, fret: 5 });
  });
});
