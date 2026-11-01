import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import './i18n';
import { App } from './app/App';
import { preloadAudio } from './audio/engine';
import { preloadGuitar } from './audio/instruments/guitar';

// Load the audio library and guitar samples in the background so the first tap can play sound immediately.
void preloadAudio().then(preloadGuitar);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
