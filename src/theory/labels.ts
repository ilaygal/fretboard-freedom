import { prettyNote, toFixedDo } from './note';
import { degreeLabel, type IntervalSymbol } from './interval';

/** What text appears inside a note dot on the fretboard. */
export type LabelMode = 'note' | 'interval' | 'degree' | 'solfege' | 'none';

export function noteLabel(mode: LabelMode, name: string, interval: IntervalSymbol | undefined): string {
  switch (mode) {
    case 'note':
      return prettyNote(name);
    case 'solfege':
      return toFixedDo(name);
    case 'interval':
      return interval ? prettyInterval(interval) : '';
    case 'degree':
      return interval ? prettyInterval(degreeLabel(interval)) : '';
    case 'none':
      return '';
  }
}

/** "b3" -> "♭3", "#11" -> "♯11". */
export function prettyInterval(symbol: string): string {
  return symbol.replace(/b/g, '♭').replace(/#/g, '♯');
}
