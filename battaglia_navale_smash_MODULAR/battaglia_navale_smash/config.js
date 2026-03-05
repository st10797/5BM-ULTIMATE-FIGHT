/**
 * config.js — Battaglia Navale Smash
 * Contiene tutte le costanti di gioco, i dati dei personaggi (CHARS),
 * le armi (WEAPONS), le piattaforme (PLATS) e i parametri globali.
 */

/* ============================================================
   POLYFILL: roundRect per browser che non lo supportano
============================================================ */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Array.isArray(r) ? r[0] : r || 0;
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
    this.closePath();
    return this;
  };
}

/* ============================================================
   PERSONAGGI — Oggetto CHARS
   Ogni personaggio ha: nome, emoji (em), colore (col), descrizione (desc),
   nome potere (pow), statistiche (spd, jump, wt, aR, aD, skin) e danno potere (powDmg).
   Il campo 'powType' identifica la logica del potere in powers.js.
============================================================ */
const CHARS = {
  // ── Personaggi originali ──────────────────────────────────
  Brutus: {
    nome: 'Brutus', em: '🔱', col: '#ff6b35',
    desc: 'Il Toro dei Mari', pow: 'Pugno Devastante',
    powType: 'Brutus',
    spd: 2.8, jump: 11.5, wt: 2.0, aR: 68, aD: 19,
    skin: '#3A1800', powDmg: 30,
  },
  Tornari: {
    nome: 'Tornari', em: '🌀', col: '#00d4ff',
    desc: 'Il Vortice Marino', pow: 'Ciclone Assassino',
    powType: 'Tornari',
    spd: 3.8, jump: 13, wt: 0.9, aR: 58, aD: 13,
    skin: '#001833', powDmg: 35,
  },
  Scottex: {
    nome: 'Scottex', em: '🧻', col: '#ccccff',
    desc: 'Il Pulitore dei Mari', pow: 'Assorbimento Totale',
    powType: 'Scottex',
    spd: 3.2, jump: 12, wt: 1.1, aR: 55, aD: 10,
    skin: '#666688', powDmg: 0,
  },
  Ercolano: {
    nome: 'Ercolano', em: '🌋', col: '#ff6b00',
    desc: 'Il Gigante Magmatico', pow: 'Inferno Magmatico',
    powType: 'Ercolano',
    spd: 2.2, jump: 10, wt: 2.0, aR: 72, aD: 19,
    skin: '#4A1A00', powDmg: 40,
  },
  Pierigoat: {
    nome: 'Pierigoat', em: '🐐', col: '#c77dff',
    desc: 'La Capra Divina', pow: 'Raggio Divino',
    powType: 'Pierigoat',
    spd: 3.6, jump: 12, wt: 0.85, aR: 52, aD: 9,
    skin: '#3A006B', powDmg: 45,
  },
  GoatNatan: {
    nome: 'GoatNatan', em: '🐟', col: '#00b3ff',
    desc: 'Dominatore delle Maree', pow: 'Tsunami Devastante',
    powType: 'GoatNatan',
    spd: 4.4, jump: 12, wt: 1.0, aR: 50, aD: 8,
    skin: '#001A33', powDmg: 50,
  },
  Marcello: {
    nome: 'Marcello', em: '📡', col: '#00ff6a',
    desc: 'Genio del Radar', pow: 'Bombardamento Laser',
    powType: 'Marcello',
    spd: 3.1, jump: 12, wt: 1.0, aR: 42, aD: 7,
    skin: '#001A0D', powDmg: 38,
  },
  Taji: {
    nome: 'Taji', em: '🥷', col: '#ff003c',
    desc: 'Il Ninja del Mare', pow: 'Teletrasporto Letale',
    powType: 'Taji',
    spd: 5.0, jump: 13, wt: 0.8, aR: 44, aD: 11,
    skin: '#150008', powDmg: 55,
  },

  // ── 13 Nuovi Personaggi ───────────────────────────────────
  Gibo: {
    nome: 'Gibo', em: '🧔‍♂️', col: '#ffd700',
    desc: 'Il Comandante dei Nani', pow: 'Armata dei Nani',
    powType: 'armata_nani',
    spd: 3.0, jump: 11, wt: 1.5, aR: 60, aD: 14,
    skin: '#5C3A1E', powDmg: 28,
  },
  Bolly: {
    nome: 'Bolly', em: '🎈', col: '#ff69b4',
    desc: 'Il Palloncino Rimbalzante', pow: 'Super Rimbalzo',
    powType: 'super_rimbalzo',
    spd: 4.0, jump: 14, wt: 0.6, aR: 48, aD: 8,
    skin: '#8B0057', powDmg: 20,
  },
  Cappels: {
    nome: 'Cappels', em: '🎩', col: '#1a237e',
    desc: 'Il Mago del Ritmo', pow: 'Onda Musicale',
    powType: 'onda_musicale',
    spd: 3.3, jump: 12, wt: 1.0, aR: 56, aD: 12,
    skin: '#0D1B5E', powDmg: 32,
  },
  Cerchioni: {
    nome: 'Cerchioni', em: '🛞', col: '#9e9e9e',
    desc: 'Il Drifter Inarrestabile', pow: 'Turbo Derapata',
    powType: 'turbo_derapata',
    spd: 5.5, jump: 10, wt: 1.8, aR: 65, aD: 16,
    skin: '#424242', powDmg: 35,
  },
  JoeySchiatti: {
    nome: 'Joey Schiatti', em: '💀', col: '#212121',
    desc: 'Il Signore delle Ossa', pow: 'Presa Tombale',
    powType: 'presa_tombale',
    spd: 2.5, jump: 10.5, wt: 1.6, aR: 70, aD: 18,
    skin: '#1a1a1a', powDmg: 45,
  },
  Coppa: {
    nome: 'Coppa', em: '🏆', col: '#ffd700',
    desc: 'Il Campione Eterno', pow: 'Luce della Vittoria',
    powType: 'luce_vittoria',
    spd: 3.4, jump: 12, wt: 1.2, aR: 58, aD: 13,
    skin: '#7B5800', powDmg: 38,
  },
  DB: {
    nome: 'DB', em: '💾', col: '#00e676',
    desc: 'Il Glitch del Sistema', pow: 'System Error',
    powType: 'system_error',
    spd: 3.7, jump: 12.5, wt: 0.9, aR: 50, aD: 10,
    skin: '#003300', powDmg: 25,
  },
  Giuls: {
    nome: 'Giuls', em: '🎀', col: '#ffeb3b',
    desc: 'La Pasticciera Esplosiva', pow: 'Pasticcini Esplosivi',
    powType: 'pasticcini_esplosivi',
    spd: 3.5, jump: 12, wt: 1.0, aR: 52, aD: 11,
    skin: '#5D4037', powDmg: 33,
  },
  Nitrato: {
    nome: 'Nitrato', em: '🧪', col: '#76ff03',
    desc: 'Il Chimico Tossico', pow: 'Nube Tossica',
    powType: 'nube_tossica',
    spd: 2.9, jump: 11, wt: 1.3, aR: 62, aD: 15,
    skin: '#1B5E20', powDmg: 30,
  },
  Ogbi: {
    nome: 'Ogbi', em: '🌀', col: '#00bcd4',
    desc: 'Il Maestro del Vortice', pow: 'Vortice Gravitazionale',
    powType: 'vortice',
    spd: 3.6, jump: 13, wt: 0.8, aR: 55, aD: 10,
    skin: '#006064', powDmg: 28,
  },
  Pingus: {
    nome: 'Pingus', em: '🐧', col: '#eceff1',
    desc: 'Il Pinguino Glaciale', pow: 'Scivolata Glaciale',
    powType: 'scivolata_glaciale',
    spd: 4.2, jump: 11, wt: 1.4, aR: 60, aD: 14,
    skin: '#263238', powDmg: 30,
  },
  Taff: {
    nome: 'Taff', em: '🍬', col: '#fffde7',
    desc: 'L\'Essere di Pura Aura', pow: 'Troppa Aura',
    powType: 'troppa_aura',
    spd: 3.8, jump: 13, wt: 0.7, aR: 50, aD: 9,
    skin: '#F9A825', powDmg: 0,
  },
  Chivez: {
    nome: 'Chivez', em: '🌶️', col: '#d32f2f',
    desc: 'La Furia Piccante', pow: 'Furia Piccante',
    powType: 'furia_piccante',
    spd: 4.8, jump: 12, wt: 1.1, aR: 55, aD: 17,
    skin: '#7f0000', powDmg: 42,
  },
};

/* ============================================================
   ARMI — Oggetto WEAPONS
   Armi raccoglibili che appaiono sull'arena durante il combattimento.
============================================================ */
const WEAPONS = [
  { id: 'sword',   em: '🗡️', name: 'Spada',      dmg: 22, dur: 5, range: 70, type: 'melee',  col: '#aaddff', km: 1.4 },
  { id: 'gun',     em: '🔫', name: 'Laser',       dmg: 18, dur: 3, range: 0,  type: 'ranged', col: '#ff8800', km: 1.2 },
  { id: 'bomb',    em: '💣', name: 'Bomba',       dmg: 40, dur: 1, range: 80, type: 'aoe',    col: '#ff4400', km: 2.0 },
  { id: 'boomer',  em: '🪃', name: 'Boomerang',  dmg: 12, dur: 4, range: 0,  type: 'boomer', col: '#ffcc00', km: 1.0 },
  { id: 'thunder', em: '⚡', name: 'Fulmine',    dmg: 16, dur: 6, range: 55, type: 'stun',   col: '#ffffaa', km: 1.1 },
  { id: 'anchor',  em: '🧲', name: 'Magnete',    dmg: 10, dur: 8, range: 60, type: 'magnet', col: '#aaaaff', km: 0.8 },
];

/* ============================================================
   PIATTAFORME — Array PLATS
   Coordinate relative (rx, ry = posizione, rw, rh = dimensioni).
   main:true indica la piattaforma principale (pavimento).
============================================================ */
const PLATS = [
  { rx: 0,    ry: 0.84, rw: 1,    rh: 0.06,  main: true  },
  { rx: 0.12, ry: 0.63, rw: 0.22, rh: 0.025, main: false },
  { rx: 0.66, ry: 0.63, rw: 0.22, rh: 0.025, main: false },
  { rx: 0.38, ry: 0.49, rw: 0.24, rh: 0.025, main: false },
  { rx: 0.04, ry: 0.73, rw: 0.11, rh: 0.018, main: false },
  { rx: 0.85, ry: 0.73, rw: 0.11, rh: 0.018, main: false },
];

/* ============================================================
   ZONE DI KILL — KZ
   Limiti oltre i quali un giocatore viene eliminato.
============================================================ */
const KZ = { L: -0.28, R: 1.28, T: -0.75, B: 1.18 };

/* ============================================================
   COMBO — Sequenza di attacchi normali
============================================================ */
const COMBO = [
  { name: 'Jab',    dM: 0.7,  kM: 0.7,  an: 'jab',  ic: '👊' },
  { name: 'Gancio', dM: 1.0,  kM: 1.0,  an: 'hook',  ic: '🤜' },
  { name: 'Calcio', dM: 1.5,  kM: 1.65, an: 'kick',  ic: '🦵' },
];

/* ============================================================
   COSTANTI DI GIOCO
============================================================ */
/** Numero di colpi normali necessari per caricare il potere */
const POWER_HITS = 10;
/** Secondi necessari per caricare il potere passivamente */
const POWER_SECS = 18;
/** Testi casuali per le esplosioni KO */
const KO_TEXTS = ['K.O.!!!', 'BOOM!!!', 'ADIOS!!!', 'ELIMINATO!', 'DISTRUTTO!'];
/** Emoji casuali per la schermata di vittoria */
const WIN_EMOTES = ['🥳', '🎉', '💃', '🕺', '😎', '🤩', '🏆', '🎊', '🦄', '🚀', '🤸'];
/** Numero massimo di particelle per evento esplosione */
const MAX_PARTICLES_PER_EXPLOSION = 20;
