import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// ── PWA Service Worker ────────────────────────────────────────────
// Registration is handled automatically by vite-plugin-pwa via the
// 'autoUpdate' strategy. The generated virtual module is imported
// behind the scenes; no manual registerServiceWorker() call is needed
// here. See vite.config.js for the Workbox / manifest config.
// ─────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
