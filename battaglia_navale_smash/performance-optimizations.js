/**
 * performance-optimizations.js — Ottimizzazioni di rendering e performance
 * 
 * Questo file contiene ottimizzazioni per:
 * - Riduzione del carico di rendering
 * - Gestione efficiente della memoria
 * - Ottimizzazione del garbage collection
 * - Caching di elementi DOM frequentemente usati
 * 
 * AGGIORNAMENTO v2.0
 */

/**
 * Cache di elementi DOM per evitare query ripetute.
 * Riduce il carico di DOM traversal durante il gameplay.
 */
const DOMCache = {
  gameCanvas: null,
  gameContext: null,
  timerEl: null,
  pct1El: null,
  pct2El: null,
  pbar1El: null,
  pbar2El: null,
  lv1El: null,
  lv2El: null,
  
  init() {
    this.gameCanvas = document.getElementById('game-canvas');
    this.gameContext = this.gameCanvas ? this.gameCanvas.getContext('2d') : null;
    this.timerEl = document.getElementById('timer');
    this.pct1El = document.getElementById('sh-pct1');
    this.pct2El = document.getElementById('sh-pct2');
    this.pbar1El = document.getElementById('sh-pb1');
    this.pbar2El = document.getElementById('sh-pb2');
    this.lv1El = document.getElementById('sh-lv1');
    this.lv2El = document.getElementById('sh-lv2');
  },
  
  getContext() {
    return this.gameContext;
  }
};

/**
 * Pool di oggetti per particelle per ridurre allocazioni di memoria.
 * Riusa oggetti particella invece di crearli e distruggerli continuamente.
 */
class ParticlePool {
  constructor(size = 200) {
    this.pool = [];
    this.activeParticles = [];
    
    for (let i = 0; i < size; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, ml: 1, col: '#fff', sz: 2
      });
    }
  }
  
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, ml: 1, col: '#fff', sz: 2 };
  }
  
  release(particle) {
    if (this.pool.length < 200) {
      this.pool.push(particle);
    }
  }
  
  clear() {
    this.activeParticles = [];
  }
}

const particlePool = new ParticlePool(200);

/**
 * Ottimizzazione del rendering del canvas.
 * Disabilita il rendering di elementi non visibili.
 */
function optimizeCanvasRendering() {
  if (!DOMCache.gameCanvas) return;
  
  // Abilita il rendering ottimizzato
  const ctx = DOMCache.gameContext;
  if (!ctx) return;
  
  // Disabilita l'anti-aliasing per performance migliore
  ctx.imageSmoothingEnabled = false;
  
  // Abilita il buffering
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Limita il frame rate a 60 FPS per ridurre il carico della CPU.
 * Particolarmente utile su dispositivi mobili.
 */
let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

function throttleFrameRate(callback) {
  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  
  if (deltaTime >= FRAME_TIME) {
    lastFrameTime = now - (deltaTime % FRAME_TIME);
    callback();
  }
}

/**
 * Riduce la qualità del rendering quando il frame rate scende.
 * Mantiene il gameplay fluido anche su hardware debole.
 */
let renderQuality = 1.0;
let frameTimeHistory = [];

function updateRenderQuality() {
  if (frameTimeHistory.length > 60) {
    frameTimeHistory.shift();
  }
  
  const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
  const targetFrameTime = 1000 / 60;
  
  if (avgFrameTime > targetFrameTime * 1.2) {
    renderQuality = Math.max(0.5, renderQuality - 0.1);
  } else if (avgFrameTime < targetFrameTime * 0.8) {
    renderQuality = Math.min(1.0, renderQuality + 0.05);
  }
}

/**
 * Ottimizzazione della gestione delle particelle.
 * Limita il numero massimo di particelle attive simultaneamente.
 */
const MAX_ACTIVE_PARTICLES = 150;

function optimizeParticles() {
  if (ptcls.length > MAX_ACTIVE_PARTICLES) {
    // Rimuovi le particelle più vecchie
    const toRemove = ptcls.length - MAX_ACTIVE_PARTICLES;
    ptcls.splice(0, toRemove);
  }
}

/**
 * Ottimizzazione della gestione dei proiettili.
 * Rimuove i proiettili inattivi per evitare memory leak.
 */
function optimizeProjectiles() {
  // Rimuovi proiettili fuori dai limiti della mappa
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i];
    if (pr.x < -200 || pr.x > cv.width + 200 || pr.y < -200 || pr.y > cv.height + 300) {
      projs.splice(i, 1);
    }
  }
}

/**
 * Ottimizzazione della gestione degli effetti.
 * Limita il numero di effetti simultanei.
 */
const MAX_ACTIVE_EFFECTS = 50;

function optimizeEffects() {
  if (pfxArr.length > MAX_ACTIVE_EFFECTS) {
    const toRemove = pfxArr.length - MAX_ACTIVE_EFFECTS;
    pfxArr.splice(0, toRemove);
  }
  
  if (efxArr.length > MAX_ACTIVE_EFFECTS) {
    const toRemove = efxArr.length - MAX_ACTIVE_EFFECTS;
    efxArr.splice(0, toRemove);
  }
}

/**
 * Garbage collection manuale per evitare pause improvvise.
 * Viene eseguito periodicamente durante il gioco.
 */
let gcCounter = 0;

function manualGarbageCollection() {
  gcCounter++;
  
  // Esegui GC ogni 300 frame (~5 secondi a 60 FPS)
  if (gcCounter >= 300) {
    gcCounter = 0;
    
    // Pulisci array di effetti e particelle
    optimizeParticles();
    optimizeProjectiles();
    optimizeEffects();
  }
}

/**
 * Ottimizzazione del rendering della mappa.
 * Disegna solo gli elementi visibili nel viewport.
 */
function optimizeMapRendering() {
  const W = cv.width;
  const H = cv.height;
  const L = W * MAP_LIMITS.L;
  const R = W * MAP_LIMITS.R;
  const T = H * MAP_LIMITS.T;
  const B = H * MAP_LIMITS.B;
  
  // Calcola il viewport visibile
  const viewportX = camX - W / (2 * camZoom);
  const viewportY = camY - H / (2 * camZoom);
  const viewportW = W / camZoom;
  const viewportH = H / camZoom;
  
  return {
    x: viewportX,
    y: viewportY,
    w: viewportW,
    h: viewportH,
    isInViewport(x, y, size = 0) {
      return x + size > viewportX && x - size < viewportX + viewportW &&
             y + size > viewportY && y - size < viewportY + viewportH;
    }
  };
}

/**
 * Ottimizzazione della sincronizzazione multiplayer.
 * Invia aggiornamenti solo quando lo stato cambia significativamente.
 */
let lastSyncState = {};

function shouldSyncState(pi) {
  const pp = p[pi];
  if (!pp) return false;
  
  const key = 'p' + pi;
  const lastState = lastSyncState[key];
  
  if (!lastState) {
    lastSyncState[key] = {
      x: pp.x, y: pp.y, damage: pp.damage, stocks: pp.stocks
    };
    return true;
  }
  
  // Sincronizza solo se la posizione cambia di più di 5 pixel o il danno cambia
  const dx = Math.abs(pp.x - lastState.x);
  const dy = Math.abs(pp.y - lastState.y);
  const ddmg = Math.abs(pp.damage - lastState.damage);
  const dstocks = pp.stocks !== lastState.stocks;
  
  if (dx > 5 || dy > 5 || ddmg > 0 || dstocks) {
    lastSyncState[key] = {
      x: pp.x, y: pp.y, damage: pp.damage, stocks: pp.stocks
    };
    return true;
  }
  
  return false;
}

/**
 * Integrazione con il loop principale di rendering.
 * Questa funzione dovrebbe essere chiamata nel main loop di engine.js
 * per applicare le ottimizzazioni durante il gameplay.
 */
function applyPerformanceOptimizations() {
  // Gestione della memoria
  manualGarbageCollection();
  
  // Ottimizzazione del rendering
  optimizeCanvasRendering();
  
  // Aggiornamento della qualità di rendering
  updateRenderQuality();
}

/**
 * Inizializzazione delle ottimizzazioni di performance.
 * Deve essere chiamata una volta all'avvio del gioco.
 */
function initPerformanceOptimizations() {
  DOMCache.init();
  optimizeCanvasRendering();
}
