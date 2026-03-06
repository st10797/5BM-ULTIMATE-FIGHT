/**
 * env-config.js — Configurazione variabili d'ambiente
 * 
 * Variabili d'ambiente da configurare:
 * 
 * Per Vercel (frontend):
 *   VITE_BACKEND_URL  — URL del backend Render (es. https://fivebm-ultimate-fight.onrender.com)
 *
 * Per Render (backend):
 *   PORT              — Porta del server (default: 3000)
 *   NODE_ENV          — Ambiente (production / development)
 *   FRONTEND_URL      — URL del frontend Vercel (per CORS)
 *
 * Uso nel codice:
 *   Il valore di BACKEND_URL viene letto da window.BACKEND_URL
 *   che viene iniettato da questo file o da Vercel tramite env vars.
 */

// BUGFIX v1.1: rilevamento automatico ambiente locale
// Se il gioco viene aperto da localhost, usa il server locale
(function () {
  const envUrl = (typeof process !== 'undefined' && process.env && process.env.VITE_BACKEND_URL)
    ? process.env.VITE_BACKEND_URL
    : null;

  const isLocalhost = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === ''
  );

  const productionUrl = 'https://fivebm-ultimate-fight.onrender.com';

  window.BACKEND_URL = envUrl || (isLocalhost ? 'http://localhost:3000' : productionUrl);

  console.log('[CONFIG] Ambiente:', isLocalhost ? 'locale' : 'produzione');
  console.log('[CONFIG] Backend URL:', window.BACKEND_URL);
})();
