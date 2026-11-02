# Fretboard Freedom

A personal guitar platform for playing freely: know the whole neck, play chords anywhere, train your ears, and improvise beyond the pentatonic box. It should feel like an instrument and a game, not homework.

**Live app:** https://ilaygal.github.io/fretboard-freedom/ (add it to your home screen on iPhone: Share, then "Add to Home Screen").

Runs fully in the browser and offline. Your data stays on your device; back it up from Settings.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/fretboard-freedom/
npm test
npm run build
```

See [CLAUDE.md](CLAUDE.md) for architecture, conventions and the phase plan.

## Credits

Guitar samples: the Musyng Kite soundfont (CC BY-SA 3.0), pre-rendered by [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts). The files in `public/samples/guitar` are shared under the same licence.
