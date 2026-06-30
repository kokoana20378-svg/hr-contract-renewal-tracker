import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// PWA: Install prompt handler
let deferredPrompt: Event | null = null;
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e;
});

(window as any).__installPWA = async () => {
  if (deferredPrompt) {
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    deferredPrompt = null;
    return result.outcome === 'accepted';
  }
  return false;
};

(window as any).__canInstallPWA = () => deferredPrompt !== null;

// PWA: Detect installed state
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
