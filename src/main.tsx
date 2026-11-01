import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import './i18n';
import { App } from './app/App';
import { preloadAudio } from './audio/engine';

// Load the audio library in the background so the first tap can play sound immediately.
void preloadAudio();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
