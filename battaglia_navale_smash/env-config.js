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

// URL del backend: usa variabile d'ambiente Vercel se disponibile,
// altrimenti fallback all'URL di produzione Render
window.BACKEND_URL = (
  (typeof process !== 'undefined' && process.env && process.env.VITE_BACKEND_URL) ||
  'https://fivebm-ultimate-fight.onrender.com'
);

console.log('[CONFIG] Backend URL:', window.BACKEND_URL);
