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
 *
 * BUGFIX v1.1:
 *   - Aggiunto rilevamento automatico dell'ambiente locale (localhost)
 *   - Se il gioco viene aperto da localhost, il backend viene cercato
 *     automaticamente su http://localhost:3000 invece che su Render
 *   - Questo evita errori di connessione quando si gioca in locale
 *     senza dover modificare il codice
 */

(function () {
  // 1. Priorità massima: variabile d'ambiente Vercel (build time)
  const envUrl = (typeof process !== 'undefined' && process.env && process.env.VITE_BACKEND_URL)
    ? process.env.VITE_BACKEND_URL
    : null;

  // 2. Rilevamento automatico ambiente locale
  //    Se il gioco viene aperto da localhost o 127.0.0.1,
  //    usa il server locale invece di Render
  const isLocalhost = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === ''
  );

  // 3. URL di produzione su Render
  const productionUrl = 'https://fivebm-ultimate-fight.onrender.com';

  // 4. Selezione finale dell'URL
  // BUGFIX: Se siamo in un ambiente sandbox Manus, window.location.hostname potrebbe non essere localhost
  // ma il backend è comunque sulla porta 3000 dello stesso host.
  const sandboxUrl = window.location.protocol + '//' + window.location.hostname + ':3000';
  window.BACKEND_URL = envUrl || (isLocalhost ? 'http://localhost:3000' : (window.location.port === '3000' ? '' : sandboxUrl));
  
  // Se siamo già sulla porta 3000, l'URL del backend è relativo
  if (window.location.port === '3000') window.BACKEND_URL = window.location.origin;

  console.log('[CONFIG] Ambiente:', isLocalhost ? 'locale' : 'produzione');
  console.log('[CONFIG] Backend URL:', window.BACKEND_URL);
})();
