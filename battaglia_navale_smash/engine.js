/**
 * engine.js — Battaglia Navale Smash
 * Gestisce il loop di gioco, la fisica (gravità, attrito, rimbalzo),
 * le collisioni con le piattaforme, il rendering Canvas e l'input da tastiera.
 * Dipende da: config.js, powers.js
 */

/* ============================================================
   STATO GLOBALE DI GIOCO
============================================================ */

/** Array dei due giocatori attivi */
let p = [null, null];

/** Personaggio selezionato da P1 e P2 (chiavi di CHARS) */
let sel1 = null, sel2 = null;

/** Turno di selezione corrente (1 = P1, 2 = P2) */
let selTurn = 1;

/** Flag di stato del gioco */
let paused = false, started = false;

/** Mappa dei tasti premuti e dei tasti appena premuti in questo frame */
let keys = {}, justDown = {};

/** Array di particelle, proiettili, effetti canvas e effetti overlay */
let ptcls = [], projs = [], efxArr = [], pfxArr = [], wepObjs = [];

/** Array delle aree ad effetto continuo (nube tossica, vortice, ecc.) */
let areas = [];

/** Timer di gioco in secondi e ID intervallo */
let gTimer = 180, timerIv = null, rafId = null;

/** Timestamp dell'ultimo frame e variabili di sfondo */
let lastTs = 0, bgT = 0, stars = [], wepSpawnT = 8;

/** Intensità e offset dello screen shake */
let shake = 0, shakeX = 0, shakeY = 0;

/** Frame di "hitstop" (freeze fisico su colpi forti, stile Smash Bros) */
let hitstopFrames = 0;

/* ============================================================
   TELECAMERA E MAPPA INFINITA
============================================================ */

/** Posizione della telecamera nel mondo (pixel) */
let camX = 0, camY = 0;

/** Zoom corrente della telecamera */
let camZoom = 1.0;

/** Target di zoom (per interpolazione smooth) */
let targetZoom = 1.0;

/* ============================================================
   RIFERIMENTI CANVAS
============================================================ */

/** Canvas principale del gioco */
const cv  = document.getElementById('game-canvas');
const cx  = cv.getContext('2d');

/** Canvas overlay per effetti visivi (shockwave, raggi, ecc.) */
const pCv = document.getElementById('pfx-canvas');
const pCx = pCv.getContext('2d');

/* ============================================================
   NAVIGAZIONE TRA SCHERMI
============================================================ */

/** Nasconde tutti gli schermi */
function hideAll() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
}

/** Mostra la schermata del titolo */
function showTitle() {
  hideAll();
  document.getElementById('screen-title').classList.remove('hidden');
  stopAll();
  buildTitleIcons();
}

/** Mostra la schermata di selezione personaggio */
function showSelect() {
  hideAll();
  document.getElementById('screen-select').classList.remove('hidden');
  sel1 = null; sel2 = null; selTurn = 1;
  buildGrid();
  updateSelUI();
}

/** Mostra la schermata pre-fight con le statistiche dei personaggi */
function showPreFight() {
  if (!sel1 || !sel2) return;
  hideAll();
  document.getElementById('screen-prefight').classList.remove('hidden');
  buildPreFight();
}

/** Mostra il canvas di gioco */
function showGame() {
  hideAll();
  document.getElementById('screen-game').classList.remove('hidden');
}

/** Mostra la schermata dei risultati con il vincitore */
function showResult(winner) {
  stopAll();
  hideAll();
  document.getElementById('screen-result').classList.remove('hidden');
  const ch = CHARS[winner];
  document.getElementById('res-em').textContent = ch.em;
  document.getElementById('res-name').textContent = ch.nome;
  document.getElementById('res-name').style.color = ch.col;
  document.getElementById('res-sub').textContent = ch.desc + ' · VITTORIA!';
}

/** Ferma tutto: cancella RAF, timer, array di stato e reset UI */
function stopAll() {
  started = false; paused = false;
  shake = 0; shakeX = 0; shakeY = 0; hitstopFrames = 0;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (timerIv) { clearInterval(timerIv); timerIv = null; }
  ptcls = []; projs = []; efxArr = []; pfxArr = []; wepObjs = []; areas = [];
  const kf = document.getElementById('kill-feed');
  if (kf) kf.innerHTML = '';
  const ai = document.getElementById('arena-inner');
  if (ai) ai.style.transform = 'rotateX(5deg)';
  document.getElementById('win-emote').style.display = 'none';
  const eo = document.getElementById('expl-overlay');
  eo.style.display = 'none'; eo.innerHTML = '';
  document.getElementById('pow-announce').classList.remove('show');
}

/** Attiva/disattiva la guida e mette in pausa il gioco */
function toggleGuide() {
  const ov = document.getElementById('guide-ov');
  ov.classList.toggle('open');
  paused = ov.classList.contains('open');
  if (!paused) { keys = {}; justDown = {}; lastTs = performance.now(); }
}

/* ============================================================
   UI SELEZIONE PERSONAGGIO
============================================================ */

/**
 * Costruisce le icone flottanti nella schermata del titolo.
 * Ogni icona rappresenta un personaggio con il suo colore e emoji.
 */
function buildTitleIcons() {
  const c = document.getElementById('t-icons');
  c.innerHTML = '';
  Object.entries(CHARS).forEach(([id, ch], i) => {
    const d = document.createElement('div');
    d.className = 't-icon';
    d.style.cssText = `border-color:${ch.col};box-shadow:0 0 12px ${ch.col}44;animation:floatI ${2.5 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`;
    d.textContent = ch.em;
    d.title = ch.nome;
    c.appendChild(d);
  });
  // Inietta keyframe solo una volta
  if (!document.getElementById('floatI-style')) {
    const style = document.createElement('style');
    style.id = 'floatI-style';
    style.textContent = '@keyframes floatI{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}';
    document.head.appendChild(style);
  }
}

/**
 * Costruisce la griglia di selezione personaggi.
 * Ogni card mostra emoji, nome, descrizione e tag del potere.
 */
function buildGrid() {
  const g = document.getElementById('char-grid');
  g.innerHTML = '';
  Object.entries(CHARS).forEach(([id, ch]) => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.style.setProperty('--cc', ch.col);
    card.innerHTML = `<span class="cc-em">${ch.em}</span>
      <div class="cc-nm">${ch.nome}</div>
      <div class="cc-ds">${ch.desc}</div>
      <div class="cc-tg" style="background:${ch.col}">${ch.pow}</div>`;
    card.onclick = () => pickChar(id, card);
    g.appendChild(card);
  });
}

/**
 * Gestisce la selezione di un personaggio da parte di P1 o P2.
 * @param {string} id - Chiave del personaggio in CHARS
 * @param {HTMLElement} card - Elemento DOM della card selezionata
 */
function pickChar(id, card) {
  if (selTurn === 1) {
    sel1 = id;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('sel'));
    card.classList.add('sel');
    selTurn = 2;
  } else {
    if (id === sel1) return; // P2 non può scegliere lo stesso personaggio di P1
    sel2 = id;
  }
  updateSelUI();
}

/** Aggiorna gli avatar e il testo di stato nella schermata di selezione */
function updateSelUI() {
  const c1 = sel1 ? CHARS[sel1] : null;
  const c2 = sel2 ? CHARS[sel2] : null;
  const a1 = document.getElementById('av1');
  const a2 = document.getElementById('av2');
  a1.textContent = c1 ? c1.em : '?';
  a1.style.borderColor = c1 ? c1.col : 'rgba(255,255,255,.15)';
  a1.style.boxShadow = c1 ? `0 0 20px ${c1.col}` : 'none';
  document.getElementById('nm1').textContent = c1 ? c1.nome : 'Nessuno';
  a2.textContent = c2 ? c2.em : '?';
  a2.style.borderColor = c2 ? c2.col : 'rgba(255,255,255,.15)';
  a2.style.boxShadow = c2 ? `0 0 20px ${c2.col}` : 'none';
  document.getElementById('nm2').textContent = c2 ? c2.nome : 'Nessuno';
  const step = document.getElementById('sel-step');
  const btn  = document.getElementById('fight-btn');
  if (!sel1) { step.textContent = '▶ P1: scegli il personaggio'; btn.classList.remove('show'); }
  else if (!sel2) { step.textContent = '▶ P2: scegli il personaggio'; btn.classList.remove('show'); }
  else { step.textContent = '✓ Pronti al combattimento!'; btn.classList.add('show'); }
}

/* ============================================================
   SCHERMATA PRE-FIGHT
============================================================ */

/**
 * Popola la schermata pre-fight con le statistiche dei due personaggi selezionati.
 */
function buildPreFight() {
  function fill(n, cid) {
    const ch = CHARS[cid];
    const side = document.getElementById('pf-s' + n);
    side.style.borderColor = ch.col;
    side.style.background = ch.col + '15';
    document.getElementById('pf-em' + n).textContent = ch.em;
    const nm = document.getElementById('pf-nm' + n);
    nm.textContent = ch.nome; nm.style.color = ch.col;
    document.getElementById('pf-ds' + n).textContent = ch.desc;
    const pw = document.getElementById('pf-pw' + n);
    pw.textContent = '⚡ ' + ch.pow; pw.style.background = ch.col;
    document.getElementById('pf-spd' + n).style.cssText = `width:${ch.spd / 5.5 * 100}%;background:${ch.col}`;
    document.getElementById('pf-jmp' + n).style.cssText = `width:${ch.jump / 14 * 100}%;background:${ch.col}`;
    document.getElementById('pf-dmg' + n).style.cssText = `width:${ch.aD / 20 * 100}%;background:${ch.col}`;
    document.getElementById('pf-wt' + n).style.cssText  = `width:${Math.min(ch.wt / 2, 1) * 100}%;background:${ch.col}`;
  }
  fill(1, sel1); fill(2, sel2);
  document.getElementById('pf-go').style.display = '';
  const cd = document.getElementById('pf-cd');
  cd.style.display = 'none'; cd.textContent = ''; cd.className = '';
}

/**
 * Avvia il conto alla rovescia 3-2-1-FIGHT! prima dell'inizio della partita.
 */
function startCountdown() {
  document.getElementById('pf-go').style.display = 'none';
  const cd = document.getElementById('pf-cd');
  cd.style.display = 'block';
  let n = 3;
  function tick() {
    if (n > 0) {
      cd.textContent = n; cd.className = '';
      void cd.offsetWidth; // forza reflow per riavviare animazione CSS
      n--;
      setTimeout(tick, 800);
    } else {
      cd.textContent = 'FIGHT!'; cd.className = 'fight';
      setTimeout(startGame, 700);
    }
  }
  tick();
}

/* ============================================================
   HELPER PIATTAFORME
============================================================ */

/**
 * Converte le coordinate relative delle piattaforme in pixel assoluti.
 * @returns {Array} Array di oggetti piattaforma con x, y, w, h, main
 */
function getPlats() {
  const W = cv.width, H = cv.height;
  return PLATS.map(pl => ({
    x: pl.rx * W, y: pl.ry * H,
    w: pl.rw * W, h: pl.rh * H,
    main: !!pl.main,
  }));
}

/* ============================================================
   INIZIALIZZAZIONE PARTITA
============================================================ */

/**
 * Crea l'oggetto giocatore con tutti i suoi attributi iniziali.
 * @param {string} cid - Chiave del personaggio in CHARS
 * @param {number} frac - Posizione orizzontale relativa (0-1)
 * @param {string} col - Colore del giocatore (P1 rosso, P2 blu)
 * @param {Object} ctrl - Mappa dei controlli da tastiera
 * @returns {Object} Oggetto giocatore inizializzato
 */
function mkPlayer(cid, frac, col, ctrl) {
  const W = cv.width, H = cv.height;
  return {
    cid, ch: CHARS[cid],
    x: frac * W, y: H * 0.7,
    vx: 0, vy: 0,
    w: 44, h: 58,
    onGround: false,
    facing: frac < 0.5 ? 1 : -1,
    damage: 0, stocks: 3,
    pCharge: 0, pActive: false, pTimer: 0,
    shielded: false,
    aCool: 0, atkT: 0, atkAnim: null, atkProg: 0,
    combo: 0, comboT: 0, comboIc: '',
    crouching: false, weapon: null,
    col, ctrl,
    isDead: false, respT: 0,
    exploding: false,
    jumpCount: 0, walkT: 0,
    hitFlash: 0, landSquash: 0, invincT: 0,
    lArmA: 0, rArmA: 0, lLegA: 0, rLegA: 0,
    // Flag per stati alterati (usati dai poteri)
    controlsInverted: false,
    isImmune: false,
    isFrozen: false,
    speedMultiplier: 1,
  };
}

/**
 * Avvia una nuova partita: inizializza giocatori, HUD, timer e loop.
 */
function startGame() {
  if (!sel1 || !sel2) return;
  showGame();
  resizeCanvases();

  p[0] = mkPlayer(sel1, 0.28, '#ff4466', { L: 'a', R: 'd', U: 'w', D: 's', atk: 'f', pwr: 'q', pick: 'e' });
  // BUGFIX: tasti P2 allineati con il keydown handler (atk='l', pwr='/', pick='.')  
  p[1] = mkPlayer(sel2, 0.72, '#44aaff', { L: 'arrowleft', R: 'arrowright', U: 'arrowup', D: 'arrowdown', atk: 'l', pwr: '/', pick: '.' });

  // Aggiorna HUD con nomi e colori
  document.getElementById('sh-nm1').textContent = CHARS[sel1].nome;
  document.getElementById('sh-nm1').style.color = p[0].col;
  document.getElementById('sh-nm2').textContent = CHARS[sel2].nome;
  document.getElementById('sh-nm2').style.color = p[1].col;
  buildLives(0); buildLives(1);
  updPct(0); updPct(1);
  updPBar(0); updPBar(1);

  // Timer partita
  gTimer = 180; updTimer();
  if (timerIv) clearInterval(timerIv);
  timerIv = setInterval(() => {
    if (!paused) { gTimer--; updTimer(); if (gTimer <= 0) endGame(); }
  }, 1000);

  // Reset array di stato
  ptcls = []; projs = []; efxArr = []; pfxArr = []; wepObjs = []; areas = [];
  wepSpawnT = 8;
  started = true; paused = false;
  keys = {}; justDown = {}; hitstopFrames = 0;

  // Inizializza telecamera sulla posizione media dei giocatori
  camX = (p[0].x + p[1].x) / 2;
  camY = (p[0].y + p[1].y) / 2;
  camZoom = 1.0;
  targetZoom = 1.0;

  ann('FIGHT!', '#ffd700');
  if (rafId) cancelAnimationFrame(rafId);
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
}

/**
 * Ridimensiona i canvas in base alla finestra corrente.
 * Viene chiamata all'avvio e al resize della finestra.
 */
function resizeCanvases() {
  const tb  = document.getElementById('top-bar');
  const hud = document.getElementById('smash-hud');
  const cb  = document.getElementById('ctrl-bar');
  const tbH  = tb  ? tb.offsetHeight  : 36;
  const hudH = hud ? hud.offsetHeight : 70;
  const cbH  = cb  ? cb.offsetHeight  : 20;
  cv.width  = window.innerWidth;
  cv.height = Math.max(260, window.innerHeight - tbH - hudH - cbH);
  const ai = document.getElementById('arena-inner');
  if (ai) ai.style.height = cv.height + 'px';
  pCv.width  = window.innerWidth;
  pCv.height = window.innerHeight;
  initStars();
}

/* ============================================================
   AGGIORNAMENTO HUD
============================================================ */

/**
 * Ricostruisce le icone delle vite di un giocatore nell'HUD.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function buildLives(pi) {
  const el = document.getElementById(pi === 0 ? 'sh-lv1' : 'sh-lv2');
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('div');
    s.className = 'sh-life' + (i >= p[pi].stocks ? ' lost' : '');
    s.style.cssText = `border-color:${p[pi].col};background:${i < p[pi].stocks ? p[pi].col + '44' : 'transparent'}`;
    s.textContent = p[pi].ch.em;
    el.appendChild(s);
  }
}

/**
 * Aggiorna il display della percentuale di danno nell'HUD.
 * Il colore cambia da blu a giallo a rosso all'aumentare del danno.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function updPct(pi) {
  const el = document.getElementById(pi === 0 ? 'sh-pct1' : 'sh-pct2');
  const d  = p[pi].damage;
  el.textContent = d + '%';
  if (d >= 150) {
    el.style.color = '#ff0000';
    el.style.textShadow = '0 0 20px #ff0000,3px 3px 0 rgba(0,0,0,.5)';
  } else if (d >= 100) {
    el.style.color = `hsl(${Math.max(0, 25 - d * 0.15)},100%,62%)`;
    el.style.textShadow = '0 0 14px currentColor,3px 3px 0 rgba(0,0,0,.4)';
  } else if (d >= 60) {
    el.style.color = `hsl(${Math.max(0, 45 - d * 0.3)},100%,65%)`;
    el.style.textShadow = '2px 2px 0 rgba(0,0,0,.4)';
  } else {
    el.style.color = p[pi].col;
    el.style.textShadow = '3px 3px 0 rgba(0,0,0,.4)';
  }
  el.classList.remove('shake', 'crit');
  void el.offsetWidth;
  el.classList.add('shake');
  if (d >= 150) el.classList.add('crit');
}

/**
 * Aggiorna la barra di carica del potere nell'HUD.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function updPBar(pi) {
  const pp   = p[pi];
  const fill = document.getElementById(pi === 0 ? 'sh-pb1' : 'sh-pb2');
  const lbl  = document.getElementById(pi === 0 ? 'sh-pl1' : 'sh-pl2');
  fill.style.width = Math.round(pp.pCharge * 100) + '%';
  if (pp.pCharge >= 1) {
    fill.classList.add('rdy'); lbl.classList.add('rdy'); lbl.textContent = '⚡ PRONTO!';
  } else {
    fill.classList.remove('rdy'); lbl.classList.remove('rdy'); lbl.textContent = '⚡';
  }
}

/**
 * Aggiorna il display dell'arma equipaggiata nell'HUD.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function updWepHud(pi) {
  const pp = p[pi];
  const ws = document.getElementById(pi === 0 ? 'sh-w1' : 'sh-w2');
  if (!pp.weapon) { ws.style.display = 'none'; return; }
  ws.style.display = 'flex';
  document.getElementById(pi === 0 ? 'sh-we1' : 'sh-we2').textContent = pp.weapon.def.em;
  const pct = pp.weapon.dur / pp.weapon.def.dur * 100;
  const f   = document.getElementById(pi === 0 ? 'sh-wd1' : 'sh-wd2');
  f.style.width = pct + '%';
  f.style.background = pct > 60 ? '#00ff6a' : pct > 30 ? '#ffd700' : '#ff3322';
}

/**
 * Aggiorna il timer di gioco visualizzato nell'HUD superiore.
 */
function updTimer() {
  const m  = Math.floor(gTimer / 60);
  const s  = gTimer % 60;
  const el = document.getElementById('timer');
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  el.className = gTimer <= 10 ? 'low' : '';
}

/* ============================================================
   ARMI SULL'ARENA
============================================================ */

/** Fa apparire un'arma casuale su una piattaforma casuale */
function spawnStageWep() {
  const W = cv.width, H = cv.height;
  const def = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
  const pl  = PLATS[1 + Math.floor(Math.random() * (PLATS.length - 1))];
  wepObjs.push({
    def,
    x: W * (pl.rx + pl.rw * 0.2 + Math.random() * pl.rw * 0.6),
    y: H * pl.ry - 22,
    vx: (Math.random() - 0.5) * 2, vy: -2,
    onGround: false, glow: Math.random() * Math.PI * 2, spin: 0,
  });
}

/**
 * Aggiorna la fisica delle armi sul terreno (gravità, collisioni piattaforme).
 * Rimuove le armi cadute fuori dallo schermo per evitare memory leak.
 * @param {number} dt - Delta time in secondi
 */
function updWepObjs(dt) {
  wepSpawnT -= dt;
  if (wepSpawnT <= 0 && wepObjs.length < 3) {
    spawnStageWep();
    wepSpawnT = 7 + Math.random() * 5;
  }
  const plats = getPlats();
  for (let i = wepObjs.length - 1; i >= 0; i--) {
    const w = wepObjs[i];
    w.spin += dt * 3; w.vy += 20 * dt; w.x += w.vx; w.y += w.vy;
    w.vx *= 0.96; w.onGround = false;
    for (const pl of plats) {
      if (w.x > pl.x && w.x < pl.x + pl.w && w.y + 10 > pl.y && w.vy >= 0) {
        w.y = pl.y - 10; w.vy = 0; w.vx *= 0.6; w.onGround = true;
      }
    }
    // Rimozione per evitare memory leak: armi fuori dallo schermo
    if (w.y > cv.height + 100) wepObjs.splice(i, 1);
  }
}

/* ============================================================
   AGGIORNAMENTO GIOCATORE (fisica + input)
============================================================ */

/**
 * Aggiorna la fisica, l'input e lo stato di un giocatore per un frame.
 * @param {number} pi - Indice giocatore (0 o 1)
 * @param {number} dt - Delta time in secondi
 */
function updPlayer(pi, dt) {
  const pp = p[pi];
  if (pp.isDead) { pp.respT -= dt; if (pp.respT <= 0) respawnP(pi); return; }
  const ch = pp.ch, W = cv.width, H = cv.height, ctrl = pp.ctrl;

  // Carica passiva del potere
  if (pp.pCharge < 1) {
    pp.pCharge = Math.min(1, pp.pCharge + dt / POWER_SECS);
    updPBar(pi);
  }

  // Stato: controlli invertiti (potere system_error di DB)
  const ctrlL = pp.controlsInverted ? ctrl.R : ctrl.L;
  const ctrlR = pp.controlsInverted ? ctrl.L : ctrl.R;

  // Accovacciamento
  const wantCrouch = isKey(ctrl.D) && pp.onGround;
  pp.crouching = wantCrouch;
  const targetH = pp.crouching ? 30 : 58;
  if (Math.abs(pp.h - targetH) > 0.5) {
    const prev = pp.h;
    pp.h += (targetH - pp.h) * Math.min(1, dt * 14);
    pp.y += prev - pp.h;
  }

  // Movimento orizzontale (con attrito)
  const spd = ch.spd * (pp.speedMultiplier || 1);
  if (!pp.crouching && !pp.isFrozen) {
    if (isKey(ctrlL)) { pp.vx -= spd * 0.62; pp.facing = -1; pp.walkT += dt; }
    else if (isKey(ctrlR)) { pp.vx += spd * 0.62; pp.facing = 1; pp.walkT += dt; }
    else pp.walkT *= 0.9;
  } else {
    pp.walkT *= 0.9;
  }

  // Attrito
  pp.vx *= pp.onGround ? 0.78 : 0.92;
  pp.vx = Math.max(-18, Math.min(18, pp.vx));

  // Gravità
  pp.vy = Math.min(22, pp.vy + 24 * dt * ch.wt);

  // Integrazione posizione
  const prevY = pp.y;
  pp.x += pp.vx; pp.y += pp.vy;
  const wasAir = !pp.onGround;
  pp.onGround = false;

  // Collisioni con le piattaforme
  const plats = getPlats();
  for (const pl of plats) {
    const wantsDrop = !pl.main && isKey(ctrl.D) && pp.vy >= 0 && pp.jumpCount > 0;
    if (
      pp.x + pp.w > pl.x + 2 && pp.x < pl.x + pl.w - 2 &&
      prevY + pp.h <= pl.y + 6 && pp.y + pp.h >= pl.y &&
      pp.vy >= 0 && !wantsDrop
    ) {
      if (wasAir && pp.vy > 4) {
        pp.landSquash = 0.55;
        // Particelle di atterraggio (max 7 per non sovraccaricare)
        for (let i = 0; i < 7; i++) {
          ptcls.push({
            x: pp.x + Math.random() * pp.w, y: pl.y,
            vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2.5,
            life: 0.28, ml: 0.28,
            col: pl.main ? '#4488ff' : pp.col,
            sz: 2 + Math.random() * 2,
          });
        }
      }
      pp.y = pl.y - pp.h; pp.vy = 0; pp.onGround = true; pp.jumpCount = 0;
    }
  }
  pp.landSquash = Math.max(0, pp.landSquash - dt * 3.5);

  // Sicurezza: pavimento principale (solo se sopra l'isola)
  const mainPl = plats.find(pl => pl.main);
  if (mainPl && pp.x + pp.w > mainPl.x && pp.x < mainPl.x + mainPl.w && pp.y + pp.h > mainPl.y + 6 && !pp.isDead) {
    pp.y = mainPl.y - pp.h;
    if (pp.vy > 0) pp.vy = 0;
    pp.onGround = true; pp.jumpCount = 0;
  }

  // Limiti fisici della mappa (pareti invisibili)
  const mapL = W * MAP_LIMITS.L, mapR = W * MAP_LIMITS.R, mapT = H * MAP_LIMITS.T;
  if (pp.x < mapL) { pp.x = mapL; pp.vx = 0; }
  if (pp.x + pp.w > mapR) { pp.x = mapR - pp.w; pp.vx = 0; }
  if (pp.y < mapT) { pp.y = mapT; pp.vy = 0; }

  // Kill zone: solo caduta nel vuoto (B)
  if (pp.invincT <= 0 && pp.y > H * MAP_LIMITS.B) {
    killPlayer(pi);
  }

  // Animazione arti
  const walkCyc = Math.sin(pp.walkT * 8);
  const isWalk  = pp.onGround && Math.abs(pp.vx) > 0.4;
  const inAir   = !pp.onGround;
  const isAtk   = pp.atkT > 0;
  const atkP    = pp.atkProg;
  let tLL = isWalk ? walkCyc * 0.55  : inAir ? -0.25 : 0;
  let tRL = isWalk ? -walkCyc * 0.55 : inAir ?  0.25 : 0;
  let tLA = isWalk ? -walkCyc * 0.5  : 0;
  let tRA = isWalk ?  walkCyc * 0.5  : 0;
  if (isAtk) {
    if (pp.atkAnim === 'jab')                             { tRA = -0.2 - atkP * 0.55; tLA = 0.2; }
    else if (pp.atkAnim === 'hook')                       { tRA = atkP * -1.1; tLA = 0.4 - atkP * 0.3; }
    else if (pp.atkAnim === 'kick' || pp.atkAnim === 'airKick') { tRL = atkP * -1.15; tLL = 0.3; }
    else if (pp.atkAnim === 'slide')                      { tRL = 0.5; tLL = 0.5; tRA = -0.3; tLA = -0.3; }
  }
  const lerpA = (a, b, f) => a + (b - a) * Math.min(1, f);
  const LF = isAtk ? dt * 22 : dt * 16;
  pp.lLegA = lerpA(pp.lLegA, tLL, LF); pp.rLegA = lerpA(pp.rLegA, tRL, LF);
  pp.lArmA = lerpA(pp.lArmA, tLA, LF); pp.rArmA = lerpA(pp.rArmA, tRA, LF);

  // Decremento timer
  if (pp.aCool > 0) pp.aCool -= dt;
  if (pp.atkT > 0) { pp.atkT -= dt; pp.atkProg = 1 - pp.atkT / 0.22; }
  else { pp.atkAnim = null; pp.atkProg = 0; }
  if (pp.comboT > 0) pp.comboT -= dt; else { pp.combo = 0; pp.comboIc = ''; }
  if (pp.pActive) { pp.pTimer -= dt; if (pp.pTimer <= 0) { pp.pActive = false; pp.shielded = false; } }
  if (pp.hitFlash > 0) pp.hitFlash -= dt;
  if (pp.invincT > 0) pp.invincT -= dt;

  // Raccolta / lancio arma
  if (justDown[ctrl.pick]) {
    if (pp.weapon) throwWeapon(pi);
    else {
      for (let i = wepObjs.length - 1; i >= 0; i--) {
        const w = wepObjs[i];
        if (Math.hypot(w.x - (pp.x + pp.w / 2), w.y - (pp.y + pp.h / 2)) < 56) {
          pp.weapon = { def: w.def, dur: w.def.dur };
          wepObjs.splice(i, 1);
          flt('⚔️ ' + w.def.name + '!', pp.x, pp.y, w.def.col);
          updWepHud(pi);
          break;
        }
      }
    }
  }
}

/**
 * Lancia l'arma equipaggiata dal giocatore come proiettile.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function throwWeapon(pi) {
  const pp = p[pi]; if (!pp.weapon) return;
  const d  = pp.weapon.def;
  const vx = pp.facing * (d.type === 'boomer' ? 10 : 9);
  const wo = { def: d, x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.4, vx, vy: -3, onGround: false, dur: pp.weapon.dur, spin: 0, glow: 0 };
  if (d.type === 'boomer') {
    wo.boomerOwner = pi; wo.boomerReturn = false;
    setTimeout(() => { wo.boomerReturn = true; }, 800);
  }
  wepObjs.push(wo);
  pp.weapon = null;
  updWepHud(pi);
}

/* ============================================================
   SISTEMA DI ATTACCO
============================================================ */

/**
 * Esegue un attacco normale con la sequenza combo.
 * Calcola danno, knockback e effetti visivi.
 * @param {number} pi - Indice giocatore attaccante (0 o 1)
 */
function doAttack(pi) {
  const pp = p[pi], op = p[1 - pi];
  if (op.isDead) return;
  const ch = pp.ch, dir = pp.facing, inAir = !pp.onGround, isCrouch = pp.crouching;
  const mi = isCrouch ? 0 : inAir ? 2 : Math.min(pp.combo, 2);
  const mv = COMBO[mi];
  const animName = isCrouch ? 'slide' : inAir ? 'airKick' : mv.an;
  pp.atkAnim = animName; pp.atkT = 0.22; pp.atkProg = 0;
  pp.combo   = pp.comboT > 0 ? Math.min(pp.combo + 1, 3) : 1;
  pp.comboT  = 0.62; pp.comboIc = mv.ic;

  // Effetti visivi del colpo
  const hx = pp.x + pp.w / 2 + dir * 26;
  const hy = pp.y + pp.h * (isCrouch ? 0.85 : inAir ? 0.25 : 0.5);
  spawnSwipeVfx(hx, hy, dir, ch.col, animName);

  if (pp.weapon) { doWeaponAttack(pi); return; }
  if (op.invincT > 0) return;

  const dx = Math.abs((pp.x + pp.w / 2) - (op.x + op.w / 2));
  const dy = Math.abs(pp.y - op.y);
  if (dx < ch.aR + (inAir ? 18 : 0) && dy < (isCrouch ? 32 : 62)) {
    if (op.crouching && !isCrouch) { flt('SCHIVATO!', op.x, op.y, '#88aaff'); return; }
    const dmg = Math.round(ch.aD * mv.dM * (0.85 + Math.random() * 0.3));
    const kb  = dmg * (1 + op.damage / 65) * mv.kM;
    op.damage += dmg;
    op.vx += dir * kb * (op.onGround ? 0.4 : 0.6);
    op.vy -= kb * (inAir ? 0.42 : 0.26);
    op.vx = Math.max(-24, Math.min(24, op.vx));
    op.vy = Math.max(-20, op.vy);
    op.hitFlash = 0.18;
    pp.pCharge = Math.min(1, pp.pCharge + 1 / POWER_HITS);
    updPBar(pi);
    updPct(1 - pi);
    popDmg(op.x + op.w / 2, op.y, dmg, mv.ic || ch.col, ch.col);
    // Particelle limitate: max 8 per colpo normale
    spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, ch.col, 8);
    // Shake potenziato per compensare la rimozione del freeze (hitstop)
    shake = Math.min(0.65, dmg * 0.022);
    if (pp.combo >= 3) {
      flt(pp.combo + 'x ' + mv.ic, op.x, op.y - 36, '#ff4422');
      addPfx({ type: 'shockwave', x: op.x + op.w / 2, y: op.y + op.h / 2, r: 0, maxR: 115, life: 0.38, col: ch.col });
      shake = 0.85; // Shake forte per combo, senza freeze
    }
  }
}

/**
 * Esegue un attacco con l'arma equipaggiata.
 * Gestisce ranged, boomerang, bombe e armi corpo a corpo.
 * @param {number} pi - Indice giocatore attaccante (0 o 1)
 */
function doWeaponAttack(pi) {
  const pp = p[pi], op = p[1 - pi], w = pp.weapon, d = w.def, dir = pp.facing;
  const wx = pp.x + pp.w / 2, wy = pp.y + pp.h * 0.45;
  spawnWeaponVfx(d.id, wx, wy, dir, d.col);

  if (d.type === 'ranged') {
    projs.push({ x: wx, y: wy, vx: dir * 13, vy: -1, owner: pi, dmg: d.dmg, col: d.col, sz: 7, type: 'laser', life: 2, spin: 0 });
  } else if (d.type === 'boomer') {
    const bm = { x: wx, y: wy, vx: dir * 11, vy: -1.5, owner: pi, dmg: d.dmg, col: d.col, sz: 8, type: 'boomer', life: 3, spin: 0, boomerOwner: pi, boomerReturn: false };
    setTimeout(() => { bm.boomerReturn = true; }, 800);
    projs.push(bm);
  } else if (d.type === 'aoe') {
    projs.push({ x: wx, y: wy, vx: dir * 9, vy: -6, owner: pi, dmg: d.dmg, col: d.col, sz: 13, type: 'bomb', life: 1.8, spin: 0 });
  } else if (!op.isDead && op.invincT <= 0) {
    spawnSwipeVfx(wx + dir * 30, wy, dir, d.col, 'kick');
    if (Math.abs(wx - (op.x + op.w / 2)) < d.range && Math.abs(pp.y - op.y) < 62) {
      const kb = d.dmg * (1 + op.damage / 65) * d.km;
      op.damage += d.dmg; op.vx += dir * kb * 0.62; op.vy -= kb * 0.28; op.hitFlash = 0.2;
      op.vx = Math.max(-24, Math.min(24, op.vx)); op.vy = Math.max(-20, op.vy);
      if (d.type === 'stun') { op.vx *= 0.25; flt('⚡ STUN!', op.x, op.y, d.col); }
      if (d.type === 'magnet' && !op.isDead) op.vx += (wx - (op.x + op.w / 2)) * 0.3;
      updPct(1 - pi);
      popDmg(op.x + op.w / 2, op.y, d.dmg, d.col, d.col);
      spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, d.col, 10);
      pp.pCharge = Math.min(1, pp.pCharge + 2 / POWER_HITS); updPBar(pi);
      addPfx({ type: 'shockwave', x: op.x + op.w / 2, y: op.y + op.h / 2, r: 0, maxR: 85, life: 0.28, col: d.col });
      shake = Math.min(0.55, d.dmg * 0.018); // Shake potenziato, senza freeze
    }
  }
  w.dur--;
  if (w.dur <= 0) { flt('💔 ' + d.name + ' ROTTA!', pp.x, pp.y, '#ff4422'); pp.weapon = null; }
  updWepHud(pi);
}

/* ============================================================
   KILL, RESPAWN E FINE PARTITA
============================================================ */

/**
 * Gestisce l'eliminazione di un giocatore: decrementa le vite,
 * genera effetti visivi e avvia il respawn o la fine partita.
 * @param {number} pi - Indice giocatore eliminato (0 o 1)
 */
function killPlayer(pi) {
  const pp = p[pi]; if (pp.isDead) return;
  pp.stocks--; buildLives(pi); pp.weapon = null; updWepHud(pi);
  // Esplosione arcobaleno di morte
  ['#ff0040', '#ff8800', '#ffd700', '#00ff88', '#00ccff', '#cc44ff'].forEach((col, i) =>
    setTimeout(() => addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 155 + i * 28, life: 0.52 + i * 0.04, col }), i * 45)
  );
  spawnHitParticles(pp.x + pp.w / 2, pp.y + pp.h / 2, pp.col, MAX_PARTICLES_PER_EXPLOSION);
  ann(pp.ch.nome + ' KO! 💥', pp.col);
  killFeed(pp.ch.em + ' ' + pp.ch.nome + ' KO! — Vite: ' + Math.max(0, pp.stocks), pp.col);
  shake = 1.1;
  if (pp.stocks <= 0) { endGame(); return; }
  pp.isDead = true; pp.respT = 2.2; pp.damage = 0; pp.exploding = false;
  updPct(pi);
}

/**
 * Aggiunge una notifica al kill feed in alto a destra.
 * @param {string} msg - Testo della notifica
 * @param {string} col - Colore del testo
 */
function killFeed(msg, col) {
  const feed = document.getElementById('kill-feed');
  const item = document.createElement('div');
  item.className = 'kf-item';
  item.textContent = msg; item.style.color = col; item.style.borderColor = col + '44';
  feed.appendChild(item);
  setTimeout(() => { if (item.parentNode) item.remove(); }, 3000);
}

/**
 * Fa riapparire un giocatore eliminato sopra la piattaforma principale.
 * @param {number} pi - Indice giocatore da far rispawnare (0 o 1)
 */
function respawnP(pi) {
  const pp = p[pi], W = cv.width, H = cv.height;
  const mainPl = getPlats().find(pl => pl.main);
  const spY = mainPl ? mainPl.y - pp.h - 75 : H * 0.52;
  pp.isDead = false;
  pp.x = (pi === 0 ? 0.3 : 0.7) * W; pp.y = spY;
  pp.vx = 0; pp.vy = 0;
  pp.shielded = false; pp.pActive = false; pp.hitFlash = 0;
  pp.crouching = false; pp.h = 58; pp.jumpCount = 0;
  pp.invincT = 1.8; pp.exploding = false;
  // Reset stati alterati
  pp.controlsInverted = false; pp.isImmune = false; pp.isFrozen = false; pp.speedMultiplier = 1;
  spawnHitParticles(pp.x + pp.w / 2, pp.y + pp.h / 2, pp.col, 16);
  flt('RESPAWN!', pp.x, pp.y, pp.col);
}

/** Determina il vincitore e mostra la schermata risultati */
function endGame() {
  stopAll();
  const w = p[0].stocks <= 0 ? sel2 : p[1].stocks <= 0 ? sel1 : p[0].damage <= p[1].damage ? sel1 : sel2;
  setTimeout(() => showResult(w), 1100);
}

/* ============================================================
   ESPLOSIONE E VINCITORE
============================================================ */

/**
 * Genera l'animazione DOM di esplosione per un KO spettacolare.
 * @param {number} pxPct - Posizione X in percentuale dello schermo
 * @param {number} pyPx  - Posizione Y in pixel
 * @param {string} col   - Colore del personaggio eliminato
 * @param {string} em    - Emoji del personaggio eliminato
 */
function triggerExplosion(pxPct, pyPx, col, em) {
  const ov = document.getElementById('expl-overlay');
  ov.style.display = 'block'; ov.innerHTML = '';
  const fl = document.createElement('div'); fl.className = 'expl-flash'; fl.style.background = col; ov.appendChild(fl);
  for (let i = 0; i < 6; i++) {
    const ring = document.createElement('div'); ring.className = 'expl-ring';
    ring.style.cssText = `left:${pxPct}%;top:${pyPx}px;width:56px;height:56px;border-color:${i % 2 === 0 ? col : '#fff'};animation-delay:${i * 0.07}s;animation-duration:${0.7 + i * 0.09}s`;
    ov.appendChild(ring);
  }
  const shards = ['💥', '⭐', '✨', '🔥', '💫', '🌟', '⚡', '🎆', '💎', '🌈'];
  for (let i = 0; i < 14; i++) {
    const sh = document.createElement('div'); sh.className = 'expl-shard';
    const angle = i / 14 * Math.PI * 2, dist = 80 + Math.random() * 130;
    sh.style.cssText = `left:${pxPct}%;top:${pyPx}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 55}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.1}s`;
    sh.textContent = shards[i % shards.length]; ov.appendChild(sh);
  }
  const bigEm = document.createElement('div'); bigEm.className = 'expl-shard';
  bigEm.style.cssText = `left:${pxPct}%;top:${pyPx}px;font-size:68px;--dx:0px;--dy:-95px;--rot:0deg;animation-duration:1.2s`;
  bigEm.textContent = em; ov.appendChild(bigEm);
  const txt = document.createElement('div'); txt.className = 'expl-txt';
  txt.style.cssText = `left:${pxPct}%;top:${pyPx}px;color:${col};text-shadow:0 0 38px ${col},5px 5px 0 rgba(0,0,0,.6)`;
  txt.textContent = KO_TEXTS[Math.floor(Math.random() * KO_TEXTS.length)]; ov.appendChild(txt);
  setTimeout(() => { ov.style.display = 'none'; ov.innerHTML = ''; }, 2100);
}

/** Mostra l'emote del vincitore a centro schermo */
function showWinnerEmote(winnerIdx) {
  const em     = WIN_EMOTES[Math.floor(Math.random() * WIN_EMOTES.length)];
  const winner = p[winnerIdx];
  document.getElementById('win-em-icon').textContent = em;
  const wt = document.getElementById('win-em-txt');
  wt.textContent = (winner ? winner.ch.nome : 'VINCITORE') + ' VINCE!!! 🏆';
  wt.style.color = winner ? winner.col : '#ffd700';
  wt.style.textShadow = '3px 3px 0 rgba(0,0,0,.5)';
  document.getElementById('win-emote').style.display = 'flex';
  setTimeout(() => document.getElementById('win-emote').style.display = 'none', 4000);
}

/**
 * Controlla se un giocatore ha raggiunto il 200% di danno e innesca l'esplosione.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function checkExplosion(pi) {
  const pp = p[pi]; if (!pp || pp.isDead || pp.exploding) return;
  const hpPct = 100 - pp.damage * 0.5;
  if (hpPct <= 0) {
    pp.exploding = true;
    const pxPct = (pp.x + pp.w / 2) / cv.width * 100;
    const pyPx  = pp.y + pp.h / 2;
    triggerExplosion(pxPct, pyPx, pp.col, pp.ch.em);
    pp.vx = (Math.random() - 0.5) * 35; pp.vy = -24;
    shake = 2.0; flashScreen(pp.col, 0.8);
    if (pp.stocks <= 1) setTimeout(() => showWinnerEmote(1 - pi), 780);
    setTimeout(() => { if (pp.exploding) { pp.exploding = false; killPlayer(pi); } }, 420);
  }
}

/* ============================================================
   SISTEMA DI PARTICELLE (ottimizzato, max 20 per evento)
============================================================ */

/**
 * Genera particelle di impatto a partire da un punto.
 * Il numero è limitato a MAX_PARTICLES_PER_EXPLOSION per evitare cali di FPS.
 * @param {number} x   - Posizione X del centro
 * @param {number} y   - Posizione Y del centro
 * @param {string} col - Colore delle particelle
 * @param {number} n   - Numero di particelle (clamped a MAX_PARTICLES_PER_EXPLOSION)
 */
function spawnHitParticles(x, y, col, n) {
  const count = Math.min(n, MAX_PARTICLES_PER_EXPLOSION);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 5.5;
    ptcls.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 0.35 + Math.random() * 0.35, ml: 1, col, sz: 1.5 + Math.random() * 3.5 });
  }
}

/**
 * Genera particelle di salto sotto i piedi del giocatore.
 * @param {Object} pp - Oggetto giocatore
 */
function spawnJumpParticles(pp) {
  for (let i = 0; i < 10; i++) {
    ptcls.push({
      x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 22, y: pp.y + pp.h,
      vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2.5,
      life: 0.4, ml: 0.4, col: pp.col, sz: 2 + Math.random() * 3,
    });
  }
}

/**
 * Aggiorna la posizione e la vita di tutte le particelle.
 * Rimuove le particelle scadute per evitare memory leak.
 * @param {number} dt - Delta time in secondi
 */
function updParticles(dt) {
  for (let i = ptcls.length - 1; i >= 0; i--) {
    const pt = ptcls[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life -= dt;
    if (pt.life <= 0) ptcls.splice(i, 1);
  }
}

/**
 * Genera effetti visivi di scia per gli attacchi (slash, calci, scivolate).
 * @param {number} x     - Posizione X del punto di impatto
 * @param {number} y     - Posizione Y del punto di impatto
 * @param {number} dir   - Direzione (-1 sinistra, 1 destra)
 * @param {string} col   - Colore dell'effetto
 * @param {string} anim  - Tipo di animazione ('jab', 'hook', 'kick', 'slide')
 */
function spawnSwipeVfx(x, y, dir, col, anim) {
  const isKick  = anim === 'kick' || anim === 'airKick';
  const isHook  = anim === 'hook';
  const isSlide = anim === 'slide';
  const n = isKick ? 13 : isHook ? 8 : 5;
  for (let i = 0; i < n; i++) {
    const spd = isKick ? 8 + Math.random() * 9 : isHook ? 5 + Math.random() * 7 : 3 + Math.random() * 5;
    const ang = (Math.random() - 0.5) * (isKick ? 1.1 : 1.0) - (isKick ? 0.42 : 0.15);
    ptcls.push({
      x, y, vx: Math.cos(ang) * spd * dir, vy: Math.sin(ang) * spd - 1.2,
      life: 0.22 + Math.random() * 0.12, ml: 0.34,
      col: isKick ? (i % 3 === 0 ? '#ff6600' : i % 3 === 1 ? col : '#ffaa00') : isHook ? (i % 2 ? col : '#ffd700') : col,
      sz: isKick ? 5 + Math.random() * 7 : 3 + Math.random() * 4.5,
    });
  }
  if (isKick) {
    efxArr.push({ type: 'slash', x, y, dir, col: '#ff6600', life: 0.22, ml: 0.22 });
    efxArr.push({ type: 'slash', x, y: y + 12, dir, col, life: 0.15, ml: 0.15, sm: true });
  } else if (isHook) {
    efxArr.push({ type: 'slash', x, y, dir, col, life: 0.16, ml: 0.16, sm: true });
  } else if (isSlide) {
    for (let i = 0; i < 5; i++) {
      ptcls.push({ x: x - dir * i * 8, y: y + (Math.random() - 0.5) * 6, vx: dir * (1.5 + Math.random() * 3), vy: -Math.random() * 1.5, life: 0.2, ml: 0.2, col: '#aaddff', sz: 2 + Math.random() * 2 });
    }
  }
}

/**
 * Genera effetti visivi specifici per ogni tipo di arma.
 * @param {string} wid - ID dell'arma
 * @param {number} wx  - Posizione X
 * @param {number} wy  - Posizione Y
 * @param {number} dir - Direzione
 * @param {string} col - Colore dell'arma
 */
function spawnWeaponVfx(wid, wx, wy, dir, col) {
  switch (wid) {
    case 'sword':
      efxArr.push({ type: 'sword_slash', x: wx + dir * 28, y: wy, dir, life: 0.22, ml: 0.22, col: '#aaddff' });
      for (let i = 0; i < 8; i++) ptcls.push({ x: wx + dir * 20, y: wy + (Math.random() - 0.5) * 26, vx: dir * (4 + Math.random() * 9), vy: (Math.random() - 0.5) * 6, life: 0.25, ml: 0.25, col: ['#fff', '#aaddff', '#88eeff'][i % 3], sz: 2 + Math.random() * 3 });
      addPfx({ type: 'shockwave', x: wx + dir * 32, y: wy, r: 0, maxR: 58, life: 0.2, col: '#aaddff' }); break;
    case 'gun':
      for (let i = 0; i < 5; i++) { const a = (Math.random() - 0.5) * 0.5; ptcls.push({ x: wx + dir * 22, y: wy + (Math.random() - 0.5) * 8, vx: Math.cos(a) * dir * (6 + Math.random() * 5), vy: Math.sin(a) * 3, life: 0.12, ml: 0.12, col: i % 2 ? '#ff8800' : '#ffcc00', sz: 2 + Math.random() * 3 }); }
      addPfx({ type: 'muzzle_flash', x: wx + dir * 22, y: wy, dir, life: 0.14, col: '#ff8800' }); break;
    case 'bomb':
      for (let i = 0; i < 7; i++) ptcls.push({ x: wx + (Math.random() - 0.5) * 12, y: wy + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 4, life: 0.4, ml: 0.4, col: i % 2 ? '#886644' : '#555', sz: 5 + Math.random() * 8 }); break;
    case 'boomer':
      for (let i = 0; i < 6; i++) ptcls.push({ x: wx + dir * 14, y: wy + (Math.random() - 0.5) * 10, vx: dir * (3 + Math.random() * 5), vy: (Math.random() - 0.5) * 4, life: 0.25, ml: 0.25, col: '#ffd700', sz: 2 + Math.random() * 4 });
      efxArr.push({ type: 'slash', x: wx + dir * 20, y: wy, dir, life: 0.14, ml: 0.14, col: '#ffd700', sm: true }); break;
    case 'thunder':
      for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; ptcls.push({ x: wx + Math.cos(a) * 14, y: wy + Math.sin(a) * 14, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5 - 1.5, life: 0.18, ml: 0.18, col: i % 2 ? '#fff' : '#ffffaa', sz: 1.5 + Math.random() * 2.5 }); }
      addPfx({ type: 'lightning_burst', x: wx + dir * 18, y: wy, life: 0.3, col: '#ffffaa' }); break;
    case 'anchor':
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ptcls.push({ x: wx + Math.cos(a) * 18, y: wy + Math.sin(a) * 18, vx: -Math.cos(a) * 3, vy: -Math.sin(a) * 3, life: 0.3, ml: 0.3, col: '#aaaaff', sz: 2 + Math.random() * 2.5 }); }
      addPfx({ type: 'magnet_pulse', x: wx, y: wy, life: 0.45, col: '#aaaaff' }); break;
  }
}

/* ============================================================
   AGGIORNAMENTO PROIETTILI
   Bugfix: i proiettili vengono rimossi quando escono dai bordi.
============================================================ */

/**
 * Aggiorna posizione, collisioni e vita di tutti i proiettili.
 * I proiettili fuori dai bordi vengono rimossi per evitare memory leak.
 * @param {number} dt - Delta time in secondi
 */
function updProjectiles(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i];
    pr.spin += dt * 6; pr.x += pr.vx; pr.y += pr.vy; pr.life -= dt;
    if (pr.type === 'bomb') pr.vy = Math.min(18, pr.vy + 22 * dt);

    // Logica di ritorno del boomerang
    if (pr.boomerReturn) {
      const own = p[pr.boomerOwner];
      if (own && !own.isDead) {
        const dx = (own.x + own.w / 2) - pr.x;
        const dy = (own.y + own.h / 2) - pr.y;
        const d  = Math.hypot(dx, dy);
        pr.vx += dx / d * 1.2; pr.vy += dy / d * 0.6;
        if (d < 28) { projs.splice(i, 1); continue; }
      }
    }

    // Logica di inseguimento per i nani di Gibo (type: 'nano')
    if (pr.type === 'nano') {
      const target = p[1 - pr.owner];
      if (target && !target.isDead) {
        const dx = (target.x + target.w / 2) - pr.x;
        const dy = (target.y + target.h / 2) - pr.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          // Curva graduale verso il bersaglio ogni frame
          pr.vx += (dx / dist) * 0.35;
          pr.vy += (dy / dist) * 0.35;
          // Limita la velocità massima
          const spd = Math.hypot(pr.vx, pr.vy);
          if (spd > 9) { pr.vx = pr.vx / spd * 9; pr.vy = pr.vy / spd * 9; }
        }
      }
    }

    // Collisione con il giocatore avversario
    const op = p[1 - pr.owner];
    if (op && !op.isDead && op.invincT <= 0 && Math.hypot(pr.x - (op.x + op.w / 2), pr.y - (op.y + op.h / 2)) < 28 + pr.sz) {
      op.damage += pr.dmg;
      op.vx += pr.vx * 0.4; op.vy -= pr.type === 'bomb' ? 14 : 4;
      op.hitFlash = 0.16;
      updPct(1 - pr.owner);
      spawnHitParticles(pr.x, pr.y, pr.col, pr.type === 'bomb' ? MAX_PARTICLES_PER_EXPLOSION : 5);
      popDmg(op.x + op.w / 2, op.y, pr.dmg, '', pr.col);
      if (pr.type === 'bomb') addPfx({ type: 'shockwave', x: pr.x, y: pr.y, r: 0, maxR: 175, life: 0.45, col: '#ff4422' });
      p[pr.owner].pCharge = Math.min(1, p[pr.owner].pCharge + 2 / POWER_HITS);
      updPBar(pr.owner);
      shake = Math.min(0.50, pr.dmg * 0.018); // Shake potenziato, senza freeze
      projs.splice(i, 1); continue;
    }

    // BUGFIX: rimozione proiettili fuori dai bordi per evitare memory leak
    if (pr.x < -120 || pr.x > cv.width + 120 || pr.y < -120 || pr.y > cv.height + 250 || pr.life <= 0) {
      projs.splice(i, 1);
    }
  }
}

/* ============================================================
   AGGIORNAMENTO AREE AD EFFETTO CONTINUO
   Usate da: nube_tossica (Nitrato), vortice (Ogbi)
============================================================ */

/**
 * Aggiorna le aree ad effetto continuo (nube tossica, vortice).
 * Applica danni o forze ai giocatori nelle vicinanze.
 * @param {number} dt - Delta time in secondi
 */
function updAreas(dt) {
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    a.life -= dt;
    if (a.life <= 0) { areas.splice(i, 1); continue; }

    // Effetti sulle particelle dell'area
    if (a.type === 'nube_tossica') {
      // Genera particelle tossiche periodicamente
      a.particleTimer = (a.particleTimer || 0) + dt;
      if (a.particleTimer > 0.08) {
        a.particleTimer = 0;
        for (let j = 0; j < 2; j++) {
          ptcls.push({
            x: a.x + (Math.random() - 0.5) * a.r * 2,
            y: a.y + (Math.random() - 0.5) * a.r * 2,
            vx: (Math.random() - 0.5) * 1.5, vy: -0.8 - Math.random() * 1.5,
            life: 0.6 + Math.random() * 0.4, ml: 1,
            col: a.col, sz: 4 + Math.random() * 6,
          });
        }
      }
    }

    if (a.type === 'vortice') {
      // Ruota l'angolo del vortice
      a.angle = (a.angle || 0) + dt * 3;
      // Genera particelle di vortice
      a.particleTimer = (a.particleTimer || 0) + dt;
      if (a.particleTimer > 0.05) {
        a.particleTimer = 0;
        const ang = a.angle + Math.random() * Math.PI * 2;
        ptcls.push({
          x: a.x + Math.cos(ang) * a.r * 0.8,
          y: a.y + Math.sin(ang) * a.r * 0.4,
          vx: -Math.sin(ang) * 3, vy: Math.cos(ang) * 1.5 - 1,
          life: 0.4, ml: 0.4, col: a.col, sz: 3 + Math.random() * 4,
        });
      }
    }

    // Applica effetti ai giocatori nelle vicinanze
    for (let pi = 0; pi < 2; pi++) {
      const pp = p[pi];
      if (!pp || pp.isDead || pi === a.owner) continue;
      const dx = (pp.x + pp.w / 2) - a.x;
      const dy = (pp.y + pp.h / 2) - a.y;
      const dist = Math.hypot(dx, dy);

      if (dist < a.r) {
        if (a.type === 'nube_tossica') {
          // Danno continuo ogni 0.15 secondi
          a.dmgTimer = (a.dmgTimer || 0) + dt;
          if (a.dmgTimer >= 0.15) {
            a.dmgTimer = 0;
            if (pp.invincT <= 0) {
              pp.damage += a.dmgPerTick;
              pp.hitFlash = 0.05;
              updPct(pi);
            }
          }
        } else if (a.type === 'vortice') {
          // Forza di attrazione verso il centro del vortice
          if (dist > 0) {
            pp.vx -= (dx / dist) * a.force * dt;
            pp.vy -= (dy / dist) * a.force * dt;
          }
          // Danno leggero continuo
          a.dmgTimer = (a.dmgTimer || 0) + dt;
          if (a.dmgTimer >= 0.2) {
            a.dmgTimer = 0;
            if (pp.invincT <= 0) { pp.damage += a.dmgPerTick; updPct(pi); }
          }
        }
      }
    }
  }
}

/* ============================================================
   AGGIORNAMENTO EFFETTI
============================================================ */

/** Aggiunge un effetto all'array degli effetti overlay */
function addPfx(e) { pfxArr.push(e); }

/**
 * Aggiorna tutti gli effetti canvas (tornado, scudi, ecc.) e overlay.
 * @param {number} dt - Delta time in secondi
 */
function updEffects(dt) {
  bgT += dt;
  // Aggiornamento effetti canvas
  for (let i = efxArr.length - 1; i >= 0; i--) {
    const e = efxArr[i]; e.life -= dt;
    if (e.life <= 0) { efxArr.splice(i, 1); continue; }
    if (e.type === 'tornado_mega') {
      e.spin += dt * 5; e.r = Math.min(105, e.r + 230 * dt); e.x += e.vx;
      const op = p[1 - e.pi];
      if (op && !op.isDead) {
        const dx = e.x - (op.x + op.w / 2);
        op.vx += dx * 0.09; op.vy -= 2.8 * dt;
        if (Math.abs(dx) < e.r * 1.1) {
          e.dmgTimer = (e.dmgTimer || 0) + dt;
          if (e.dmgTimer >= 0.12) {
            e.dmgTimer = 0;
            const dmg = Math.round(CHARS[p[e.pi].cid].powDmg * 0.15);
            op.damage += dmg; updPct(1 - e.pi); op.hitFlash = 0.04;
          }
        }
      }
    }
  }
  // Aggiornamento effetti overlay
  for (let i = pfxArr.length - 1; i >= 0; i--) {
    const e = pfxArr[i]; e.life -= dt;
    if (e.life <= 0) { pfxArr.splice(i, 1); continue; }
    if (e.type === 'magma_shield') {
      e.pulse = (e.pulse || 0) + dt * 7;
      const pp = p[e.pi];
      if (pp && !pp.isDead) { e.x = pp.x + pp.w / 2; e.y = pp.y + pp.h / 2; }
    }
    if (e.type === 'tidal_rush' && e.trail) {
      e.trail.push({ x: e.x, y: e.y, a: 0.5 });
      if (e.trail.length > 14) e.trail.shift();
      e.trail.forEach(t => t.a *= 0.86);
    }
  }
}

/* ============================================================
   SFONDO E STELLE
============================================================ */

/** Inizializza le stelle dello sfondo con posizioni e velocità casuali */
function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      r: Math.random() * 2, al: 0.06 + Math.random() * 0.32,
      ph: Math.random() * Math.PI * 2, sp: 0.2 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.12,
    });
  }
}

/** Disegna lo sfondo: gradiente stilizzato neon, griglia prospettica, stelle e nebbia */
/**
 * Disegna i bordi della mappa per indicare i limiti invalicabili.
 */
function drawBoundaries() {
  const W = cv.width, H = cv.height;
  const L = W * MAP_LIMITS.L, R = W * MAP_LIMITS.R, T = H * MAP_LIMITS.T, B = H * MAP_LIMITS.B;

  cx.save();
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 2.5);
  const pulseIntense = 0.6 + 0.4 * Math.sin(bgT * 3.2);
  
  // Linea principale dei bordi con stile realistico
  cx.strokeStyle = `rgba(200, 60, 150, ${0.4 + 0.2 * pulse})`;
  cx.lineWidth = 6 / camZoom;
  cx.setLineDash([25, 10]);
  cx.lineDashOffset = -bgT * 50;
  cx.strokeRect(L, T, R - L, B - T);

  // Effetto barriera energetica ai bordi
  const gradL = cx.createLinearGradient(L, 0, L + 120, 0);
  gradL.addColorStop(0, `rgba(200, 60, 150, ${0.25 * pulseIntense})`);
  gradL.addColorStop(0.5, `rgba(150, 100, 200, ${0.15 * pulse})`);
  gradL.addColorStop(1, 'rgba(200, 60, 150, 0)');
  cx.fillStyle = gradL;
  cx.fillRect(L, T, 120, B - T);

  const gradR = cx.createLinearGradient(R, 0, R - 120, 0);
  gradR.addColorStop(0, `rgba(200, 60, 150, ${0.25 * pulseIntense})`);
  gradR.addColorStop(0.5, `rgba(150, 100, 200, ${0.15 * pulse})`);
  gradR.addColorStop(1, 'rgba(200, 60, 150, 0)');
  cx.fillStyle = gradR;
  cx.fillRect(R - 120, T, 120, B - T);

  // Effetto barriera superiore
  const gradT = cx.createLinearGradient(0, T, 0, T + 80);
  gradT.addColorStop(0, `rgba(200, 60, 150, ${0.2 * pulseIntense})`);
  gradT.addColorStop(1, 'rgba(200, 60, 150, 0)');
  cx.fillStyle = gradT;
  cx.fillRect(L, T, R - L, 80);

  cx.restore();
}

function drawBg() {
  const W = cv.width, H = cv.height;
  // Gradiente base stilizzato — viola/indaco profondo con riflessi neon
  const g = cx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.5, W * 1.1);
  g.addColorStop(0,   '#1e1060');
  g.addColorStop(0.3, '#120840');
  g.addColorStop(0.65,'#0c0530');
  g.addColorStop(1,   '#060220');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);

  // Alone colorato centrale (aurora)
  const aur = cx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.55);
  aur.addColorStop(0,   `rgba(80,40,200,${0.18 + 0.06 * Math.sin(bgT * 0.4)})`);
  aur.addColorStop(0.5, `rgba(40,80,180,${0.10 + 0.04 * Math.sin(bgT * 0.3)})`);
  aur.addColorStop(1,   'rgba(0,0,0,0)');
  cx.fillStyle = aur; cx.fillRect(0, 0, W, H);

  // Griglia prospettica 3D — colore neon coerente con lo stile
  cx.save();
  const gridAlpha = 0.10 + 0.04 * Math.sin(bgT * 0.65);
  cx.globalAlpha = gridAlpha;
  const fY = H * 0.76, vY = H * 0.38;
  // Linee orizzontali con gradiente colore
  for (let i = 0; i < 14; i++) {
    const t = i / 14, y = fY + (H - fY) * t;
    const sp = (y - vY) / (H - vY) * W * 0.82;
    const hue = 220 + t * 40;
    cx.strokeStyle = `hsl(${hue},90%,65%)`;
    cx.lineWidth = 0.6 + t * 0.5;
    cx.beginPath(); cx.moveTo(W / 2 - sp, y); cx.lineTo(W / 2 + sp, y); cx.stroke();
  }
  // Linee verticali convergenti
  for (let i = -12; i <= 12; i++) {
    const hue = 200 + Math.abs(i) * 5;
    cx.strokeStyle = `hsl(${hue},85%,60%)`;
    cx.lineWidth = 0.5;
    cx.beginPath(); cx.moveTo(W / 2, vY); cx.lineTo(W / 2 + i * (W * 0.09), H); cx.stroke();
  }
  cx.globalAlpha = 1; cx.restore();

  // Stelle in movimento — più luminose e colorate
  stars.forEach(s => {
    s.x += s.vx; if (s.x < -5) s.x = W + 5; if (s.x > W + 5) s.x = -5;
    const a = s.al * (0.5 + 0.5 * Math.sin(bgT * s.sp + s.ph));
    const hue = 180 + (s.ph * 60) % 120;
    cx.fillStyle = `hsla(${hue},80%,85%,${a})`;
    cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, Math.PI * 2); cx.fill();
  });

  // Nebbia al suolo — colore neon coerente
  const bot = cx.createLinearGradient(0, H * 0.65, 0, H);
  bot.addColorStop(0, 'rgba(30,10,100,0)');
  bot.addColorStop(0.5,'rgba(20,5,80,0.22)');
  bot.addColorStop(1,  'rgba(10,0,50,0.55)');
  cx.fillStyle = bot; cx.fillRect(0, H * 0.65, W, H * 0.35);

  // Linea orizzonte luminosa
  const hor = cx.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
  hor.addColorStop(0,   'rgba(80,120,255,0)');
  hor.addColorStop(0.2, `rgba(100,160,255,${0.18 + 0.08 * Math.sin(bgT * 0.7)})`);
  hor.addColorStop(0.5, `rgba(140,100,255,${0.28 + 0.10 * Math.sin(bgT * 0.5)})`);
  hor.addColorStop(0.8, `rgba(100,160,255,${0.18 + 0.08 * Math.sin(bgT * 0.7)})`);
  hor.addColorStop(1,   'rgba(80,120,255,0)');
  cx.fillStyle = hor;
  cx.fillRect(W * 0.05, H * 0.74 - 1.5, W * 0.9, 3);

  // Vignette laterali di pericolo — neon rosso/viola
  const dL = cx.createLinearGradient(0, 0, W * 0.08, 0);
  dL.addColorStop(0, 'rgba(200,20,120,.22)'); dL.addColorStop(1, 'rgba(200,20,120,0)');
  cx.fillStyle = dL; cx.fillRect(0, 0, W * 0.08, H);
  const dR = cx.createLinearGradient(W * 0.92, 0, W, 0);
  dR.addColorStop(0, 'rgba(200,20,120,0)'); dR.addColorStop(1, 'rgba(200,20,120,.22)');
  cx.fillStyle = dR; cx.fillRect(W * 0.92, 0, W * 0.08, H);

  // Particelle di sfondo fluttuanti (neon)
  cx.save();
  for (let i = 0; i < 8; i++) {
    const px = W * (0.1 + 0.1 * i + 0.04 * Math.sin(bgT * 0.3 + i * 1.2));
    const py = H * (0.15 + 0.08 * Math.sin(bgT * 0.25 + i * 0.8));
    const hue = 200 + i * 20;
    cx.fillStyle = `hsla(${hue},90%,70%,${0.06 + 0.03 * Math.sin(bgT + i)})`;
    cx.shadowBlur = 18; cx.shadowColor = `hsl(${hue},90%,70%)`;
    cx.beginPath(); cx.arc(px, py, 3 + 2 * Math.sin(bgT * 0.5 + i), 0, Math.PI * 2); cx.fill();
  }
  cx.shadowBlur = 0; cx.globalAlpha = 1; cx.restore();
}

/* ============================================================
   RENDERING PIATTAFORME
============================================================ */

/** Disegna tutte le piattaforme con effetto 3D neon e bordo luminoso stilizzato */
function drawPlatforms() {
  getPlats().forEach(pl => {
    cx.save();
    const depth = pl.main ? 20 : 12;
    const pulse = 0.03 + 0.015 * Math.sin(bgT * 1.8 + pl.x * 0.008);

    // Faccia inferiore 3D — colore viola/indaco neon
    const g3 = cx.createLinearGradient(pl.x, pl.y + pl.h, pl.x, pl.y + pl.h + depth);
    g3.addColorStop(0, pl.main ? '#1a0a50' : '#150840');
    g3.addColorStop(1, 'rgba(5,0,20,.08)');
    cx.fillStyle = g3;
    cx.beginPath(); cx.moveTo(pl.x, pl.y + pl.h); cx.lineTo(pl.x + pl.w, pl.y + pl.h);
    cx.lineTo(pl.x + pl.w, pl.y + pl.h + depth); cx.lineTo(pl.x, pl.y + pl.h + depth); cx.fill();

    // Faccia destra — ombra laterale neon
    cx.fillStyle = pl.main ? '#0f0535' : '#0d0428';
    cx.beginPath(); cx.moveTo(pl.x + pl.w, pl.y); cx.lineTo(pl.x + pl.w + 4, pl.y + 4);
    cx.lineTo(pl.x + pl.w + 4, pl.y + pl.h + depth + 4);
    cx.lineTo(pl.x + pl.w, pl.y + pl.h + depth); cx.lineTo(pl.x + pl.w, pl.y); cx.fill();

    // Superficie superiore — gradiente neon viola/blu
    const glowCol = pl.main ? 'rgba(120,80,255,.55)' : 'rgba(100,60,220,.40)';
    cx.shadowBlur = pl.main ? 28 : 18; cx.shadowColor = glowCol;
    const g = cx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h * 2);
    if (pl.main) {
      g.addColorStop(0,   '#3a1a8c');
      g.addColorStop(0.3, '#261060');
      g.addColorStop(1,   '#0e0530');
    } else {
      g.addColorStop(0,   '#4020a0');
      g.addColorStop(0.4, '#2a1270');
      g.addColorStop(1,   '#120840');
    }
    cx.fillStyle = g;
    cx.beginPath(); cx.roundRect(pl.x, pl.y, pl.w, pl.h, pl.main ? 5 : 6); cx.fill();

    // Pattern a righe luminose sulla superficie
    if (pl.main) {
      cx.save();
      cx.globalAlpha = 0.06 + 0.02 * Math.sin(bgT * 1.5);
      for (let xi = 0; xi < pl.w; xi += 32) {
        cx.fillStyle = `rgba(180,120,255,0.5)`;
        cx.fillRect(pl.x + xi, pl.y, 1, pl.h);
      }
      cx.globalAlpha = 1; cx.restore();
    }

    // Bordo superiore luminoso neon
    const eg = cx.createLinearGradient(pl.x, 0, pl.x + pl.w, 0);
    const edgeCol = pl.main ? '160,100,255' : '140,80,240';
    eg.addColorStop(0,    `rgba(${edgeCol},0)`);
    eg.addColorStop(0.08, `rgba(${edgeCol},.98)`);
    eg.addColorStop(0.5,  `rgba(${edgeCol},1)`);
    eg.addColorStop(0.92, `rgba(${edgeCol},.98)`);
    eg.addColorStop(1,    `rgba(${edgeCol},0)`);
    cx.strokeStyle = eg;
    cx.lineWidth = pl.main ? 2.8 : 2.2;
    cx.shadowBlur = 20; cx.shadowColor = `rgba(${edgeCol},.8)`;
    cx.beginPath(); cx.moveTo(pl.x + 8, pl.y); cx.lineTo(pl.x + pl.w - 8, pl.y); cx.stroke();

    // Bagliore interno pulsante
    cx.fillStyle = `rgba(160,100,255,${pulse})`;
    cx.beginPath(); cx.roundRect(pl.x, pl.y, pl.w, pl.h, pl.main ? 5 : 6); cx.fill();

    // Piccoli punti luminosi ai bordi della piattaforma principale
    if (pl.main) {
      cx.shadowBlur = 10; cx.shadowColor = 'rgba(200,150,255,.9)';
      cx.fillStyle = `rgba(200,150,255,${0.5 + 0.3 * Math.sin(bgT * 2)})`;
      [0.08, 0.5, 0.92].forEach(fx => {
        cx.beginPath(); cx.arc(pl.x + pl.w * fx, pl.y, 3, 0, Math.PI * 2); cx.fill();
      });
    }

    cx.shadowBlur = 0; cx.restore();
  });
}

/* ============================================================
   RENDERING ARMI SULL'ARENA
============================================================ */

/** Disegna le armi presenti sull'arena con effetto pulsante */
function drawStageWeapons() {
  wepObjs.forEach(w => {
    if (w.boomerOwner !== undefined) return; // i boomerang lanciati sono proiettili
    const g = 0.5 + 0.4 * Math.sin(bgT * 3 + w.glow);
    cx.save(); cx.translate(w.x, w.y); cx.rotate(w.spin * 0.5);
    cx.shadowBlur = 22 * g; cx.shadowColor = w.def.col;
    cx.font = '22px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.globalAlpha = 0.72 + 0.28 * g; cx.fillText(w.def.em, 0, 0);
    cx.strokeStyle = w.def.col; cx.lineWidth = 1.2; cx.globalAlpha = g * 0.32;
    cx.beginPath(); cx.arc(0, 0, 16 + g * 5, 0, Math.PI * 2); cx.stroke();
    cx.globalAlpha = 1; cx.shadowBlur = 0; cx.restore();
  });
}

/* ============================================================
   RENDERING GIOCATORE
============================================================ */

/**
 * Interpola un colore esadecimale verso il bianco o il nero.
 * @param {string} hex - Colore esadecimale (#RRGGBB)
 * @param {number} amt - Quantità di interpolazione (-1 a 1)
 * @returns {string} Colore RGB risultante
 */
function lerpColor(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + amt * 130)},${Math.min(255, g + amt * 130)},${Math.min(255, b + amt * 130)})`;
}

/**
 * Disegna un giocatore con corpo articolato, animazioni e effetti visivi.
 * Supporta il gigantismo di Bolly: scala visiva enorme.
 * @param {number} pi - Indice giocatore (0 o 1)
 */
function drawPlayer(pi) {
  const pp = p[pi]; if (pp.isDead) return;
  // Riferimento al personaggio del giocatore (BUGFIX: ch era undefined causando crash del rendering)
  const ch = pp.ch;
  // Lampeggio di invincibilità dopo il respawn
  if (pp.invincT > 0 && Math.floor(pp.invincT * 9) % 2 === 0) return;

  // Gigantismo di Bolly: scala visiva enormemente amplificata
  const giantScale = pp.gigantScale || 1.0;
  const isGiant    = giantScale > 1.05;

  // Dimensioni effettive di rendering (scala visiva, non fisica)
  const PW = pp.w * giantScale;
  const PH = pp.h * giantScale;
  // Centro del personaggio (basato sulla posizione fisica reale)
  const bcx = pp.x + pp.w / 2;
  const bcy = pp.y + pp.h / 2;
  const isAtk = pp.atkT > 0, anim = pp.atkAnim || '', kp = pp.atkProg;
  const isKick = anim.includes('kick'), isPunch = anim === 'jab' || anim === 'hook', isSlide = anim === 'slide';

  // Ombra a terra
  cx.save();
  const sw = PW * (pp.crouching ? 0.55 : 0.42) * (1 + pp.landSquash * 0.3);
  const sg = cx.createRadialGradient(bcx, pp.y + PH + 2, 0, bcx, pp.y + PH + 2, sw * 1.4);
  sg.addColorStop(0, ch.col + '44'); sg.addColorStop(1, 'transparent');
  cx.fillStyle = sg; cx.beginPath(); cx.ellipse(bcx, pp.y + PH + 4, sw * 1.4, 7, 0, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = 'rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(bcx, pp.y + PH + 3, sw, 4, 0, 0, Math.PI * 2); cx.fill();
  cx.restore();

  // Flash bianco all'impatto
  if (pp.hitFlash > 0) {
    cx.save(); cx.globalAlpha = Math.min(0.92, pp.hitFlash * 6.5);
    cx.fillStyle = '#fff'; cx.fillRect(pp.x - 8, pp.y - 8, PW + 16, PH + 16);
    cx.globalAlpha = 1; cx.restore();
  }

  // Scudo luminoso (Ercolano, Coppa, ecc.)
  if (pp.shielded) {
    cx.save(); const sa = 0.32 + 0.18 * Math.sin(bgT * 9);
    cx.strokeStyle = ch.col; cx.lineWidth = 3.5; cx.globalAlpha = sa; cx.shadowBlur = 28; cx.shadowColor = ch.col;
    cx.beginPath(); cx.ellipse(bcx, bcy, PW * 0.88, PH * 0.76, 0, 0, Math.PI * 2); cx.stroke();
    cx.lineWidth = 1.5; cx.globalAlpha = sa * 0.32;
    cx.beginPath(); cx.ellipse(bcx, bcy, PW * 1.18, PH * 1.04, 0, 0, Math.PI * 2); cx.stroke();
    cx.globalAlpha = 1; cx.shadowBlur = 0; cx.restore();
  }

  // Aura del personaggio
  cx.save();
  cx.strokeStyle = ch.col; cx.lineWidth = isGiant ? 4 : 1.8;
  cx.globalAlpha = isGiant ? 0.22 + 0.10 * Math.sin(bgT * 3 + pi) : 0.06 + 0.04 * Math.sin(bgT * 2.5 + pi);
  cx.shadowBlur = isGiant ? 40 : 14; cx.shadowColor = ch.col;
  cx.beginPath(); cx.ellipse(bcx, bcy, PW * 0.68, PH * 0.68, 0, 0, Math.PI * 2); cx.stroke();
  if (isGiant) {
    // Aura esterna extra per il gigantismo
    cx.lineWidth = 2.5; cx.globalAlpha = 0.12 + 0.06 * Math.sin(bgT * 2);
    cx.beginPath(); cx.ellipse(bcx, bcy, PW * 0.9, PH * 0.9, 0, 0, Math.PI * 2); cx.stroke();
    // Testo GIGANTE sopra il personaggio
    cx.font = 'bold 18px Nunito,sans-serif'; cx.textAlign = 'center'; cx.fillStyle = ch.col;
    cx.globalAlpha = 0.85 + 0.15 * Math.sin(bgT * 4);
    cx.shadowBlur = 20; cx.shadowColor = ch.col;
    cx.fillText('GIGANTE!', bcx, bcy - PH * 0.72);
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0; cx.restore();

  cx.save(); cx.translate(bcx, bcy);
  // Applica scala gigante al rendering del corpo
  if (isGiant) cx.scale(giantScale, giantScale);
  if (pp.facing < 0) cx.scale(-1, 1);
  const sqX = 1 + pp.landSquash * 0.28, sqY = 1 - pp.landSquash * 0.18;
  cx.scale(sqX, sqY);
  let bodyLean = isAtk && isPunch ? pp.facing * 0.2 * kp : Math.abs(pp.vx) > 0.5 ? pp.vx *
 0.009 : 0;
  if (isSlide) bodyLean = 0.32;
  cx.rotate(bodyLean);

  // Usa le dimensioni fisiche base (non scalate) per il corpo,
  // poiché la scala gigante è già applicata tramite cx.scale(giantScale)
  const bW = pp.w, bH = pp.h;
  const BW = bW * 0.33, BH = bH * 0.43, LW = bW * 0.17, LH = bH * 0.34;
  const AW = bW * 0.13, AH = bH * 0.22, HR = bW * 0.24;

  // GAMBA POSTERIORE
  cx.save(); cx.translate(-bW * 0.1, BH * 0.35); cx.rotate(pp.lLegA);
  cx.fillStyle = lerpColor(ch.col, -0.24); cx.beginPath(); cx.roundRect(-LW / 2, 0, LW, LH * 0.55, 3); cx.fill();
  cx.fillStyle = ch.skin; cx.beginPath(); cx.roundRect(-LW / 2 + 1, LH * 0.52, LW - 2, LH * 0.48, 3); cx.fill();
  cx.fillStyle = lerpColor(ch.col, -0.4); cx.beginPath(); cx.roundRect(-LW / 2, LH * 0.88, LW + 5, LH * 0.18, 3); cx.fill();
  cx.restore();

  // GAMBA ANTERIORE
  cx.save(); cx.translate(bW * 0.1, BH * 0.35);
  let fLA = pp.rLegA;
  if (isKick) { const ka = kp < 0.6 ? (kp / 0.6) : (1 - (kp - 0.6) / 0.4); fLA = 0.4 - ka * 1.6; }
  cx.rotate(fLA);
  cx.fillStyle = lerpColor(ch.col, -0.12); cx.beginPath(); cx.roundRect(-LW / 2, 0, LW, LH * 0.55, 3); cx.fill();
  cx.fillStyle = ch.skin; cx.beginPath(); cx.roundRect(-LW / 2 + 1, LH * 0.52, LW - 2, LH * 0.48, 3); cx.fill();
  cx.fillStyle = lerpColor(ch.col, -0.28); cx.beginPath(); cx.roundRect(-LW / 2, LH * 0.88, LW + 5, LH * 0.18, 3); cx.fill();
  cx.restore();

  // CORPO — Outfit unico per ogni personaggio
  const bGrad = cx.createLinearGradient(-BW / 2, -BH / 2, BW / 2, BH / 2);
  const outfitColor = ch.outfit || ch.col;
  const outfitAccent = ch.outfitAccent || lerpColor(ch.col, 0.18);
  bGrad.addColorStop(0, outfitAccent); bGrad.addColorStop(1, lerpColor(outfitColor, -0.28));
  cx.fillStyle = bGrad; cx.shadowBlur = 10; cx.shadowColor = outfitColor + '88';
  cx.beginPath(); cx.roundRect(-BW / 2, -BH / 2, BW, BH, 6); cx.fill();
  cx.shadowBlur = 0;
  // Riflesso sul corpo con accento outfit
  const bShine = cx.createLinearGradient(-BW / 2, -BH / 2, BW * 0.3, BH * 0.1);
  bShine.addColorStop(0, 'rgba(255,255,255,.22)'); bShine.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = bShine; cx.beginPath(); cx.roundRect(-BW / 2, -BH / 2, BW, BH, 6); cx.fill();
  // Dettagli outfit (strisce, pattern)
  cx.strokeStyle = outfitAccent; cx.lineWidth = 1.2; cx.globalAlpha = 0.4;
  cx.beginPath(); cx.moveTo(-BW / 2 + 4, -BH / 2 + 8); cx.lineTo(BW / 2 - 4, -BH / 2 + 8); cx.stroke();
  cx.globalAlpha = 1;

  // BRACCIO POSTERIORE
  const ah2 = AH * 0.5;
  cx.save(); cx.translate(-BW * 0.42, -BH * 0.22); cx.rotate(pp.lArmA - 0.15);
  cx.fillStyle = lerpColor(ch.col, -0.18); cx.beginPath(); cx.roundRect(-AW / 2, -ah2, AW, AH * 0.55, 3); cx.fill();
  cx.fillStyle = ch.skin; cx.beginPath(); cx.roundRect(-AW / 2 + 1, ah2 * 0.08, AW - 2, AH * 0.48, 3); cx.fill();
  cx.restore();

  // BRACCIO ANTERIORE
  cx.save(); cx.translate(BW * 0.42, -BH * 0.22); cx.rotate(pp.rArmA + 0.15);
  cx.fillStyle = lerpColor(ch.col, -0.06); cx.beginPath(); cx.roundRect(-AW / 2, -ah2, AW, AH * 0.55, 3); cx.fill();
  cx.fillStyle = ch.skin; cx.beginPath(); cx.roundRect(-AW / 2 + 1, ah2 * 0.08, AW - 2, AH * 0.48, 3); cx.fill();
  // Pugno durante attacco
  if (isPunch) {
    const fa = Math.sin(Math.PI * kp);
    cx.fillStyle = '#fff'; cx.globalAlpha = fa * 0.72;
    cx.beginPath(); cx.arc(0, ah2 * 1.04, AW * 0.92, 0, Math.PI * 2); cx.fill();
    for (let t = 1; t <= 3; t++) {
      cx.globalAlpha = fa * (1 - t * 0.25) * 0.3; cx.fillStyle = ch.col;
      cx.beginPath(); cx.arc(-t * 7, ah2 * (1 - 0.05 * t), AW * (1 - t * 0.15), 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1; cx.shadowBlur = 0;
  }
  // Arma in mano
  if (pp.weapon && !isKick) {
    cx.save(); cx.translate(AW * 1.2, ah2 * 1.1);
    cx.font = `${PW * 0.6}px serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowBlur = 16; cx.shadowColor = pp.weapon.def.col;
    cx.fillText(pp.weapon.def.em, 0, 0); cx.shadowBlur = 0; cx.restore();
  }
  cx.restore();

  // TESTA
  cx.save();
  const hTilt = isPunch ? kp * 0.12 : isKick ? -kp * 0.07 : 0;
  const hBob  = pp.onGround ? Math.sin(pp.walkT * 8) * 0.8 : 0;
  cx.translate(0, -BH * 0.65 - HR * 0.82 + hBob); cx.rotate(hTilt);
  cx.fillStyle = ch.skin; cx.shadowBlur = 12; cx.shadowColor = ch.col + '66';
  cx.beginPath(); cx.arc(0, 0, HR, 0, Math.PI * 2); cx.fill();
  // Riflesso sulla testa
  const hshg = cx.createRadialGradient(-HR * 0.3, -HR * 0.3, 0, 0, 0, HR);
  hshg.addColorStop(0, 'rgba(255,255,255,.22)'); hshg.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = hshg; cx.beginPath(); cx.arc(0, 0, HR, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = ch.col; cx.lineWidth = 1.8; cx.globalAlpha = 0.4;
  cx.beginPath(); cx.arc(0, 0, HR, 0, Math.PI * 2); cx.stroke(); cx.globalAlpha = 1; cx.shadowBlur = 0;
  // Occhio
  const ex = HR * 0.28, ey2 = -HR * 0.08;
  cx.fillStyle = ch.col; if (isAtk) { cx.shadowBlur = 12; cx.shadowColor = ch.col; }
  cx.fillRect(ex, ey2, HR * 0.38, PH * 0.058); cx.shadowBlur = 0;
  cx.fillStyle = 'rgba(255,255,255,.95)'; cx.fillRect(ex + HR * 0.04, ey2 + PH * 0.009, HR * 0.16, PH * 0.035);
  // Sopracciglio arrabbiato durante attacco
  if (isAtk) {
    cx.strokeStyle = ch.col; cx.lineWidth = 2.2; cx.globalAlpha = kp;
    cx.beginPath(); cx.moveTo(HR * 0.1, ey2 - PH * 0.045); cx.lineTo(HR * 0.68, ey2 - PH * 0.01); cx.stroke();
    cx.globalAlpha = 1;
  }
  cx.restore();

  // Emoji del personaggio sopra la testa (più grande durante il gigantismo)
  const emSize = isGiant ? bW * 1.1 : bW * 0.52;
  cx.font = `${emSize}px serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.globalAlpha = 0.88;
  if (isGiant) { cx.shadowBlur = 30; cx.shadowColor = ch.col; }
  cx.fillText(ch.em, 0, -BH * 0.65 - HR * 1.95 + hBob); cx.globalAlpha = 1; cx.shadowBlur = 0;

  // Burst di impatto durante attacco
  if (isAtk && kp > 0.4 && kp < 0.7) {
    const bx = isKick ? bW * 0.86 : bW * 0.7, by = isKick ? -bH * 0.12 : -BH * 0.26;
    const br = isKick ? 28 : 20, ba = (1 - Math.abs(kp - 0.55) / 0.13) * 0.78;
    cx.fillStyle = ch.col; cx.globalAlpha = ba; cx.shadowBlur = 32; cx.shadowColor = ch.col;
    cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#fff'; cx.globalAlpha = ba * 0.6; cx.beginPath(); cx.arc(bx, by, br * 0.5, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.globalAlpha = ba * 0.5;
    for (let si = 0; si < 8; si++) {
      const a = si / 8 * Math.PI * 2;
      cx.beginPath(); cx.moveTo(bx + Math.cos(a) * br * 0.58, by + Math.sin(a) * br * 0.58);
      cx.lineTo(bx + Math.cos(a) * br * 1.52, by + Math.sin(a) * br * 1.52); cx.stroke();
    }
    cx.globalAlpha = 1; cx.shadowBlur = 0;
  }
  cx.restore();

  // Icona combo
  if (pp.comboT > 0 && pp.comboIc) {
    const fade = Math.min(1, pp.comboT * 2.2);
    cx.save(); cx.globalAlpha = fade; cx.font = `${PW * 0.78}px serif`;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(pp.comboIc, bcx + (pp.facing > 0 ? PW * 1.12 : -PW * 1.12), bcy - PH * 0.55 - pp.combo * 4);
    cx.globalAlpha = 1; cx.restore();
  }

  // Etichetta P1/P2
  cx.font = 'bold 10px Nunito,sans-serif'; cx.textAlign = 'center';
  cx.fillStyle = pp.col; cx.globalAlpha = 0.6;
  cx.fillText('P' + (pi + 1), bcx, pp.y - 12); cx.globalAlpha = 1;

  // Restyling outfit personaggi
  if (typeof drawCharacterWithOutfit === 'function') {
    drawCharacterWithOutfit(pi, pp.cid);
  }
}

/* ============================================================
   RENDERING PARTICELLE E PROIETTILI
============================================================ */

/** Disegna tutte le particelle attive */
function drawParticles() {
  cx.save();
  ptcls.forEach(pt => {
    cx.globalAlpha = Math.max(0, pt.life / pt.ml);
    cx.fillStyle = pt.col; cx.shadowBlur = 6; cx.shadowColor = pt.col;
    cx.beginPath(); cx.arc(pt.x, pt.y, pt.sz, 0, Math.PI * 2); cx.fill();
  });
  cx.shadowBlur = 0; cx.globalAlpha = 1; cx.restore();
}

/** Disegna tutti i proiettili attivi con forme specifiche per tipo */
function drawProjectiles() {
  projs.forEach(pr => {
    cx.save(); cx.shadowBlur = 22; cx.shadowColor = pr.col;
    if (pr.type === 'skull' || pr.type === 'nano') {
      cx.translate(pr.x, pr.y); cx.rotate(pr.spin);
      cx.font = '21px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(pr.type === 'nano' ? '👺' : '💀', 0, 0);
    } else if (pr.type === 'laser') {
      cx.save(); cx.translate(pr.x, pr.y); cx.rotate(Math.atan2(pr.vy, pr.vx));
      cx.fillStyle = pr.col; cx.globalAlpha = 0.92;
      cx.beginPath(); cx.ellipse(0, 0, pr.sz * 3.8, pr.sz * 0.92, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#fff'; cx.globalAlpha = 0.58;
      cx.beginPath(); cx.ellipse(0, 0, pr.sz * 2.2, pr.sz * 0.44, 0, 0, Math.PI * 2); cx.fill();
      cx.restore();
    } else if (pr.type === 'boomer') {
      cx.translate(pr.x, pr.y); cx.rotate(pr.spin);
      cx.font = '20px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🪃', 0, 0);
    } else if (pr.type === 'bomb') {
      cx.translate(pr.x, pr.y); cx.rotate(pr.spin * 0.3);
      cx.font = '24px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('💣', 0, 0);
    } else if (pr.type === 'pasticcino') {
      cx.translate(pr.x, pr.y); cx.rotate(pr.spin);
      cx.font = '18px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🧁', 0, 0);
    } else if (pr.type === 'onda') {
      cx.save(); cx.translate(pr.x, pr.y); cx.rotate(Math.atan2(pr.vy, pr.vx));
      cx.strokeStyle = pr.col; cx.lineWidth = 4; cx.globalAlpha = 0.85;
      cx.beginPath();
      for (let j = 0; j < 3; j++) {
        cx.arc(0, 0, pr.sz * (0.5 + j * 0.4), -Math.PI * 0.4, Math.PI * 0.4);
      }
      cx.stroke(); cx.restore();
    } else {
      cx.fillStyle = pr.col; cx.globalAlpha = 0.9;
      cx.beginPath(); cx.arc(pr.x, pr.y, pr.sz, 0, Math.PI * 2); cx.fill();
    }
    cx.shadowBlur = 0; cx.globalAlpha = 1; cx.restore();
  });
}

/** Disegna gli effetti canvas (slash, tornado, ecc.) */
function drawEffects() {
  efxArr.forEach(e => {
    if (e.type === 'sword_slash') {
      const p2 = 1 - (e.life / e.ml), al = (1 - p2) * 0.92;
      cx.save(); cx.strokeStyle = e.col; cx.lineWidth = 7; cx.globalAlpha = al; cx.shadowBlur = 22; cx.shadowColor = e.col;
      cx.translate(e.x, e.y); cx.scale(e.dir, 1);
      cx.beginPath(); cx.arc(0, 0, 52 * (0.3 + p2 * 0.7), -Math.PI * 0.78, -Math.PI * 0.04); cx.stroke();
      cx.strokeStyle = '#fff'; cx.lineWidth = 2.5; cx.globalAlpha = al * 0.68;
      cx.beginPath(); cx.arc(0, 0, 52 * (0.3 + p2 * 0.7) * 0.55, -Math.PI * 0.7, -Math.PI * 0.09); cx.stroke();
      cx.shadowBlur = 0; cx.restore();
    }
    if (e.type === 'slash') {
      const p2 = 1 - (e.life / e.ml), al = (1 - p2) * 0.88, r = e.sm ? 30 : 44;
      cx.save(); cx.strokeStyle = e.col; cx.lineWidth = e.sm ? 3.5 : 6; cx.globalAlpha = al; cx.shadowBlur = 18; cx.shadowColor = e.col;
      cx.translate(e.x, e.y); cx.scale(e.dir, 1);
      cx.beginPath(); cx.arc(0, 0, r * (0.4 + p2 * 0.6), -Math.PI * 0.74, -Math.PI * 0.06); cx.stroke();
      cx.strokeStyle = '#fff'; cx.lineWidth = e.sm ? 1.5 : 2.5; cx.globalAlpha = al * 0.52;
      cx.beginPath(); cx.arc(0, 0, r * (0.4 + p2 * 0.6) * 0.58, -Math.PI * 0.64, -Math.PI * 0.11); cx.stroke();
      cx.shadowBlur = 0; cx.restore();
    }
    if (e.type === 'tornado_mega') {
      cx.save(); const al = Math.min(1, e.life * 0.5);
      for (let i = 0; i < 14; i++) {
        const fr = i / 14, r = e.r * fr * 0.9 + 8, ang = e.spin + fr * Math.PI * 5;
        const tx = e.x + Math.cos(ang) * r * 1.5, ty = e.y + Math.sin(ang) * r * 0.48 + fr * 32;
        cx.strokeStyle = e.col; cx.lineWidth = 2.2 - fr * 1.6; cx.globalAlpha = al * (1 - fr) * 0.72; cx.shadowBlur = 12; cx.shadowColor = e.col;
        cx.beginPath(); cx.arc(tx, ty, 3.5 + fr * 5.5, 0, Math.PI * 2); cx.stroke();
      }
      cx.globalAlpha = al * 0.38;
      const vg = cx.createRadialGradient(e.x, e.y + 18, 0, e.x, e.y + 18, e.r * 0.8);
      vg.addColorStop(0, e.col + '99'); vg.addColorStop(1, 'transparent');
      cx.fillStyle = vg; cx.beginPath(); cx.ellipse(e.x, e.y + 18, e.r * 0.8, e.r * 0.4, 0, 0, Math.PI * 2); cx.fill();
      cx.globalAlpha = 1; cx.shadowBlur = 0; cx.restore();
    }
  });
}

/* ============================================================
   RENDERING EFFETTI OVERLAY (su pCv)
============================================================ */

/** Disegna tutti gli effetti overlay (shockwave, raggi, scudi, ecc.) sul canvas pCv */
function drawOverlayFx() {
  pCx.clearRect(0, 0, pCv.width, pCv.height);
  const tbH = document.getElementById('top-bar').getBoundingClientRect().bottom || 36;

  pfxArr.forEach(e => {
    const ey = e.y !== undefined ? e.y + tbH : 0;

    if (e.type === 'shockwave') {
      const prog = 1 - (e.life / 0.55), r = e.maxR * prog, a = (1 - prog) * 0.82;
      pCx.save(); pCx.strokeStyle = e.col; pCx.lineWidth = 6 * (1 - prog) + 0.8; pCx.globalAlpha = a; pCx.shadowBlur = 26; pCx.shadowColor = e.col;
      pCx.beginPath(); pCx.arc(e.x, ey, r, 0, Math.PI * 2); pCx.stroke(); pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'tornado_birth') {
      const a = e.life / 0.8;
      for (let i = 0; i < 16; i++) {
        const ang = i / 16 * Math.PI * 2 + bgT * 6, r = 72 * (1 - a) + 18;
        pCx.save(); pCx.globalAlpha = a * 0.58; pCx.strokeStyle = e.col; pCx.lineWidth = 2; pCx.shadowBlur = 8; pCx.shadowColor = e.col;
        pCx.beginPath(); pCx.arc(e.x + Math.cos(ang) * r, e.y + tbH + Math.sin(ang) * r * 0.4, 4, 0, Math.PI * 2); pCx.stroke(); pCx.restore();
      }
    } else if (e.type === 'heal_burst') {
      const a = e.life, r = (1 - a) * 145 + 18;
      pCx.save(); pCx.strokeStyle = e.col; pCx.lineWidth = 3.5; pCx.globalAlpha = a * 0.88; pCx.shadowBlur = 28; pCx.shadowColor = e.col;
      pCx.beginPath(); pCx.arc(e.x, ey, r, 0, Math.PI * 2); pCx.stroke();
      const rg = pCx.createRadialGradient(e.x, ey, 0, e.x, ey, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (a * 0.28) + ')'); rg.addColorStop(1, 'transparent');
      pCx.fillStyle = rg; pCx.globalAlpha = 1; pCx.beginPath(); pCx.arc(e.x, ey, r, 0, Math.PI * 2); pCx.fill();
      pCx.shadowBlur = 0; pCx.restore();
    } else if (e.type === 'magma_shield') {
      const pulse = e.pulse || 0, a = 0.4 + 0.16 * Math.sin(pulse), eys = e.y + tbH;
      pCx.save();
      [50, 68, 85, 102].forEach((r, i) => {
        const rr = r + Math.sin(pulse + i) * 0.8;
        pCx.strokeStyle = ['#ff6b00', '#ff3300', '#ffaa00', '#ffee44'][i];
        pCx.lineWidth = 3 - i * 0.4; pCx.globalAlpha = a * (1 - i * 0.18); pCx.shadowBlur = 18; pCx.shadowColor = '#ff6b00';
        pCx.beginPath(); pCx.arc(e.x, eys, rr, 0, Math.PI * 2); pCx.stroke();
      });
      for (let i = 0; i < 14; i++) {
        const ang = i / 14 * Math.PI * 2 + pulse * 0.6;
        pCx.fillStyle = i % 2 ? '#ff8800' : '#ffcc00'; pCx.globalAlpha = a * 0.72;
        pCx.beginPath(); pCx.arc(e.x + Math.cos(ang) * 72, eys + Math.sin(ang) * 72, 4, 0, Math.PI * 2); pCx.fill();
      }
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'divine_beam') {
      const a = e.life / 0.7, ey1 = e.y + tbH, ey2 = e.ty + tbH;
      pCx.save();
      [16, 10, 5].forEach((lw, i) => {
        pCx.strokeStyle = i === 2 ? '#fff' : e.col;
        pCx.lineWidth = lw + a * 20 * (1 - i * 0.32); pCx.globalAlpha = a * (i === 2 ? 0.92 : 0.42 - 0.08 * i);
        pCx.shadowBlur = 38 * (1 - i * 0.25); pCx.shadowColor = e.col;
        pCx.beginPath(); pCx.moveTo(e.x, ey1); pCx.lineTo(e.tx, ey2); pCx.stroke();
      });
      for (let t = 0; t < 6; t++) {
        const bx = e.x + (e.tx - e.x) * t / 6, by = ey1 + (ey2 - ey1) * t / 6;
        pCx.strokeStyle = e.col; pCx.lineWidth = 1.5; pCx.globalAlpha = a * 0.48;
        pCx.beginPath(); pCx.arc(bx, by, 8 * (1 + Math.sin(bgT * 8 + t)), 0, Math.PI * 2); pCx.stroke();
      }
      pCx.font = '30px serif'; pCx.textAlign = 'center'; pCx.textBaseline = 'middle'; pCx.globalAlpha = a * 0.88;
      pCx.fillText('🐐', e.tx, ey2);
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'ghost') {
      const a = e.life / 1.0, gey = e.y + tbH;
      pCx.save(); pCx.globalAlpha = a * 0.42; pCx.shadowBlur = 24; pCx.shadowColor = e.col; pCx.fillStyle = e.col;
      pCx.beginPath(); pCx.ellipse(e.x + e.w / 2, gey + e.h / 2, e.w * 0.32, e.h * 0.52, 0, 0, Math.PI * 2); pCx.fill();
      pCx.font = `${e.w * 0.52}px serif`; pCx.textAlign = 'center'; pCx.textBaseline = 'middle'; pCx.globalAlpha = a * 0.62;
      pCx.fillText(e.em, e.x + e.w / 2, gey + e.h / 2); pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'tidal_rush' && e.trail) {
      e.trail.forEach(tr => {
        pCx.save(); pCx.fillStyle = e.col; pCx.globalAlpha = tr.a * 0.22;
        pCx.beginPath(); pCx.ellipse(tr.x, tr.y + tbH, 22, 38, 0, 0, Math.PI * 2); pCx.fill(); pCx.restore();
      });
      for (let i = 0; i < 4; i++) {
        pCx.save(); pCx.strokeStyle = e.col; pCx.lineWidth = 2; pCx.globalAlpha = (e.life / 0.85) * (1 - i * 0.24) * 0.52;
        pCx.beginPath(); pCx.arc(e.x, e.y + tbH, 34 + i * 24, 0, Math.PI * 2); pCx.stroke(); pCx.restore();
      }
    } else if (e.type === 'scan_grid') {
      const prog = 1 - (e.life / e.sL), sx = pCv.width * prog;
      pCx.save(); pCx.fillStyle = e.col; pCx.globalAlpha = 0.04; pCx.fillRect(0, 0, sx, pCv.height);
      pCx.strokeStyle = e.col; pCx.globalAlpha = (1 - prog) * 0.42;
      for (let y = 0; y < pCv.height; y += 40) {
        pCx.lineWidth = y % 120 === 0 ? 2.5 : 0.5;
        pCx.beginPath(); pCx.moveTo(0, y); pCx.lineTo(sx, y); pCx.stroke();
      }
      pCx.strokeStyle = '#fff'; pCx.lineWidth = 2.5; pCx.globalAlpha = (1 - prog) * 0.82; pCx.shadowBlur = 18; pCx.shadowColor = e.col;
      pCx.beginPath(); pCx.moveTo(sx, 0); pCx.lineTo(sx, pCv.height); pCx.stroke();
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'muzzle_flash') {
      const a = e.life / 0.14, mey = e.y + tbH;
      pCx.save(); pCx.translate(e.x, mey); pCx.scale(e.dir || 1, 1); pCx.shadowBlur = 22; pCx.shadowColor = e.col;
      pCx.fillStyle = e.col; pCx.globalAlpha = a * 0.82;
      for (let i = 0; i < 6; i++) { const ang = (i / 5 - 0.5) * 0.7; pCx.save(); pCx.rotate(ang); pCx.fillRect(0, -2, 28 + Math.random() * 14, 4); pCx.restore(); }
      pCx.fillStyle = '#fff'; pCx.globalAlpha = a * 0.62; pCx.beginPath(); pCx.arc(0, 0, 9 * a, 0, Math.PI * 2); pCx.fill();
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'lightning_burst') {
      const a = e.life / 0.3, ley = e.y + tbH;
      pCx.save(); pCx.translate(e.x, ley); pCx.shadowBlur = 20; pCx.shadowColor = e.col;
      for (let i = 0; i < 6; i++) {
        const ang = i / 6 * Math.PI * 2;
        pCx.strokeStyle = i % 2 ? e.col : '#fff'; pCx.lineWidth = 2; pCx.globalAlpha = a * 0.72;
        pCx.beginPath(); let bx2 = 0, by2 = 0;
        for (let s = 0; s < 4; s++) {
          const nx = bx2 + Math.cos(ang + (Math.random() - 0.5) * 0.5) * (9 + s * 8);
          const ny = by2 + Math.sin(ang + (Math.random() - 0.5) * 0.5) * (9 + s * 8);
          pCx.moveTo(bx2, by2); pCx.lineTo(nx, ny); bx2 = nx; by2 = ny;
        }
        pCx.stroke();
      }
      pCx.fillStyle = '#fff'; pCx.globalAlpha = a * 0.42; pCx.beginPath(); pCx.arc(0, 0, 14 * a, 0, Math.PI * 2); pCx.fill();
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'magnet_pulse') {
      const a = e.life / 0.45, mpy = e.y + tbH;
      pCx.save();
      for (let r = 0; r < 3; r++) {
        const rr = (1 - a) * 72 + r * 17;
        pCx.strokeStyle = e.col; pCx.lineWidth = 1.8 - r * 0.32; pCx.globalAlpha = a * (1 - r * 0.24) * 0.52;
        pCx.shadowBlur = 10; pCx.shadowColor = e.col; pCx.setLineDash([6, 6]);
        pCx.beginPath(); pCx.arc(e.x, mpy, rr, 0, Math.PI * 2); pCx.stroke(); pCx.setLineDash([]);
      }
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'toxic_cloud') {
      // Effetto visivo nube tossica di Nitrato
      const a = Math.min(1, e.life * 0.5), cey = e.y + tbH;
      pCx.save();
      for (let i = 0; i < 5; i++) {
        const ang = i / 5 * Math.PI * 2 + bgT * 0.8;
        const rx = e.x + Math.cos(ang) * e.r * 0.6, ry = cey + Math.sin(ang) * e.r * 0.3;
        const rg = pCx.createRadialGradient(rx, ry, 0, rx, ry, e.r * 0.5);
        rg.addColorStop(0, e.col + Math.round(a * 0.4 * 255).toString(16).padStart(2, '0'));
        rg.addColorStop(1, 'transparent');
        pCx.fillStyle = rg; pCx.globalAlpha = a * 0.6;
        pCx.beginPath(); pCx.arc(rx, ry, e.r * 0.5, 0, Math.PI * 2); pCx.fill();
      }
      pCx.strokeStyle = e.col; pCx.lineWidth = 2; pCx.globalAlpha = a * 0.35;
      pCx.setLineDash([8, 4]);
      pCx.beginPath(); pCx.arc(e.x, cey, e.r, 0, Math.PI * 2); pCx.stroke();
      pCx.setLineDash([]); pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    } else if (e.type === 'vortex_field') {
      // Effetto visivo vortice di Ogbi
      const a = Math.min(1, e.life * 0.5), vey = e.y + tbH;
      pCx.save();
      for (let i = 0; i < 3; i++) {
        const r = e.r * (0.3 + i * 0.35);
        pCx.strokeStyle = e.col; pCx.lineWidth = 3 - i * 0.8; pCx.globalAlpha = a * (1 - i * 0.25) * 0.6;
        pCx.shadowBlur = 14; pCx.shadowColor = e.col;
        pCx.beginPath(); pCx.arc(e.x, vey, r, 0, Math.PI * 2); pCx.stroke();
      }
      // Spirale animata
      pCx.strokeStyle = e.col; pCx.lineWidth = 1.5; pCx.globalAlpha = a * 0.5;
      pCx.beginPath();
      for (let t = 0; t < Math.PI * 4; t += 0.1) {
        const r = e.r * (t / (Math.PI * 4));
        const ang = t + bgT * 2;
        const px = e.x + Math.cos(ang) * r, py = vey + Math.sin(ang) * r * 0.5;
        t === 0 ? pCx.moveTo(px, py) : pCx.lineTo(px, py);
      }
      pCx.stroke();
      pCx.shadowBlur = 0; pCx.globalAlpha = 1; pCx.restore();
    }
  });
}

/* ============================================================
   INDICATORI DI RESPAWN
============================================================ */

/** Disegna gli indicatori di respawn per i giocatori morti */
function drawRespawnIndicators() {
  p.forEach((pp, pi) => {
    if (!pp || !pp.isDead) return;
    const W = cv.width, x = (pi === 0 ? 0.3 : 0.7) * W, y = 58;
    cx.save(); cx.globalAlpha = 0.55 + 0.3 * Math.sin(bgT * 5);
    cx.font = '26px serif'; cx.textAlign = 'center'; cx.fillText(pp.ch.em, x, y);
    cx.font = 'bold 11px Nunito,sans-serif'; cx.fillStyle = pp.col;
    cx.fillText(Math.ceil(pp.respT) + 's', x, y + 18);
    cx.globalAlpha = 1; cx.restore();
  });
}

/* ============================================================
   HELPER DOM FX
============================================================ */

/**
 * Mostra un popup di danno flottante sopra il giocatore colpito.
 * @param {number} x   - Posizione X
 * @param {number} y   - Posizione Y
 * @param {number} d   - Danno inflitto
 * @param {string} ic  - Icona emoji
 * @param {string} col - Colore del testo
 */
function popDmg(x, y, d, ic, col) {
  const el = document.createElement('div'); el.className = 'dmg-pop';
  const big = d >= 20;
  el.textContent = (big && ic ? ic + ' ' : '') + '+' + Math.round(d) + '%';
  el.style.cssText = `left:${x - 22}px;top:${y + 52}px;color:${col};text-shadow:2px 2px 0 #000,0 0 12px ${col};font-size:${big ? Math.min(40, 24 + d * 0.14) : 22}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), big ? 1050 : 850);
}

/**
 * Mostra un testo flottante generico (es. "RESPAWN!", "SCHIVATO!").
 * @param {string} text - Testo da mostrare
 * @param {number} x    - Posizione X
 * @param {number} y    - Posizione Y
 * @param {string} col  - Colore del testo
 */
function flt(text, x, y, col) {
  const el = document.createElement('div'); el.className = 'flt-txt';
  el.textContent = text;
  el.style.cssText = `left:${x}px;top:${y + 52}px;color:${col};text-shadow:2px 2px 0 #000`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/**
 * Genera un flash colorato sull'intero schermo.
 * @param {string} col   - Colore del flash
 * @param {number} alpha - Opacità iniziale (0-1)
 */
function flashScreen(col, alpha) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;inset:0;background:${col};opacity:${alpha};pointer-events:none;z-index:600;transition:opacity 0.35s`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 400);
}

/**
 * Mostra un annuncio testuale grande al centro dello schermo.
 * @param {string} text - Testo dell'annuncio
 * @param {string} col  - Colore del testo
 */
function ann(text, col) {
  const a = document.getElementById('ann-txt');
  a.textContent = text; a.style.color = col;
  a.style.textShadow = `5px 5px 0 rgba(0,0,0,.5),0 0 50px ${col}`;
  a.className = ''; void a.offsetWidth; a.className = 'pop';
  setTimeout(() => { a.className = ''; }, 1500);
}

/* ============================================================
   TILT 3D DELL'ARENA
============================================================ */

/**
 * Applica una rotazione 3D all'arena in risposta allo screen shake.
 * @param {number} sx        - Offset X dello shake
 * @param {number} sy        - Offset Y dello shake
 * @param {number} intensity - Intensità dello shake (0-1+)
 */
function tilt3D(sx, sy, intensity) {
  const wrap = document.getElementById('arena-inner'); if (!wrap) return;
  wrap.style.transform = `rotateX(${5 + sy * 0.9 * intensity}deg) rotateY(${-sx * 0.5 * intensity}deg) rotateZ(${intensity * 0.32}deg)`;
}

/* ============================================================
   LOOP PRINCIPALE DI GIOCO
============================================================ */

/**
 * Loop principale del gioco, chiamato ogni frame tramite requestAnimationFrame.
 * Gestisce hitstop, screen shake, aggiornamento fisica e rendering.
 * @param {number} ts - Timestamp corrente in millisecondi
 */
function loop(ts) {
  rafId = requestAnimationFrame(loop);
  if (paused) { lastTs = ts; justDown = {}; return; }
  const rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  const dt = Math.min(rawDt, 0.05); // Clamp a 50ms per evitare salti fisici

  if (!started) { pCx.clearRect(0, 0, pCv.width, pCv.height); justDown = {}; return; }

  // Hitstop: effetto visivo senza freeze della fisica
  // Il freeze è stato rimosso per evitare la schermata congelata.
  // L'effetto di impatto è ora gestito solo tramite screen shake e flash visivo.
  if (hitstopFrames > 0) {
    hitstopFrames = 0; // Azzera immediatamente per non congelare mai
  }

  // Screen shake
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 7);
    shakeX = (Math.random() - 0.5) * shake * 16;
    shakeY = (Math.random() - 0.5) * shake * 10;
    cx.save(); cx.translate(shakeX, shakeY);
  } else {
    shakeX = 0; shakeY = 0;
  }

  // Aggiornamento telecamera
  updateCamera(dt);

  cx.clearRect(0, 0, cv.width, cv.height);
  
  // Disegna lo sfondo statico prima della trasformazione della telecamera
  drawBg();

  // Applica trasformazione telecamera (mappa dinamica)
  cx.save();
  cx.translate(cv.width / 2, cv.height / 2);
  cx.scale(camZoom, camZoom);
  cx.translate(-camX, -camY);
  
  // Disegna i confini e gli elementi del mondo trasformati
  drawBoundaries();
  
  // Miglioramenti mappa realistici
  if (typeof renderMapEnhancements === 'function') {
    renderMapEnhancements();
  }
  
  // Effetto bagliore globale dell'arena
  cx.save();
  cx.globalCompositeOperation = 'screen';
  const arenaGlow = cx.createRadialGradient(cv.width/2, cv.height/2, 0, cv.width/2, cv.height/2, cv.width * 0.8);
  arenaGlow.addColorStop(0, 'rgba(80, 40, 200, 0.05)');
  arenaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  cx.fillStyle = arenaGlow;
  cx.fillRect(-cv.width, -cv.height, cv.width*3, cv.height*3);
  cx.restore();

  drawPlatforms(); drawStageWeapons(); drawEffects(); drawProjectiles();

  // Aggiornamento fisica e logica
  updPlayer(0, dt); updPlayer(1, dt);
  updParticles(dt); updProjectiles(dt); updEffects(dt); updWepObjs(dt); updAreas(dt);

  drawParticles(); drawPlayer(0); drawPlayer(1); drawRespawnIndicators();
  
  cx.restore();
  
  // Disegna indicatori fuori schermo (non trasformati)
  drawOffscreenIndicators();

  if (shake > 0) { tilt3D(shakeX, shakeY, shake); cx.restore(); }
  else tilt3D(0, 0, 0);

  // Controllo esplosione a 200% di danno
  checkExplosion(0); checkExplosion(1);

  drawOverlayFx();
  justDown = {};
}

/* ============================================================
   GESTIONE INPUT DA TASTIERA
============================================================ */

/**
 * Controlla se un tasto è attualmente premuto.
 * @param {string} k - Nome del tasto (lowercase)
 * @returns {boolean} true se il tasto è premuto
 */
function isKey(k) { return keys[k.toLowerCase()] === true; }

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  // Previeni comportamenti default per i tasti di gioco (scroll, navigazione, ecc.)
  if (['arrowleft', 'arrowup', 'arrowright', 'arrowdown', ' '].includes(k) || k === '/' || k === '.' || k === 'l') e.preventDefault();
  if (!keys[k]) justDown[k] = true;
  keys[k] = true;
  if (!started || paused) return;

  // Salto P1
  if (k === 'w' && p[0] && !p[0].isDead && !p[0].crouching) {
    if (p[0].onGround) { p[0].vy = -p[0].ch.jump * 1.35; p[0].onGround = false; p[0].jumpCount = 1; spawnJumpParticles(p[0]); }
    else if (p[0].jumpCount === 1 && p[0].vy > -p[0].ch.jump * 0.4) { p[0].vy = -p[0].ch.jump * 1.1; p[0].jumpCount = 2; spawnJumpParticles(p[0]); }
  }
  // Salto P2
  if (k === 'arrowup' && p[1] && !p[1].isDead && !p[1].crouching) {
    if (p[1].onGround) { p[1].vy = -p[1].ch.jump * 1.35; p[1].onGround = false; p[1].jumpCount = 1; spawnJumpParticles(p[1]); }
    else if (p[1].jumpCount === 1 && p[1].vy > -p[1].ch.jump * 0.4) { p[1].vy = -p[1].ch.jump * 1.1; p[1].jumpCount = 2; spawnJumpParticles(p[1]); }
  }
  // Attacco P1
  if (k === 'f' && p[0] && !p[0].isDead && p[0].aCool <= 0) { doAttack(0); p[0].aCool = 0.28; }
  // Attacco P2
  if (k === 'l' && p[1] && !p[1].isDead && p[1].aCool <= 0) { doAttack(1); p[1].aCool = 0.28; }
  // Potere P1
  if (k === 'q' && p[0]) usePower(0);
  // Potere P2
  if (k === '/' && p[1]) usePower(1);
});

document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

window.addEventListener('resize', () => { if (started) resizeCanvases(); });

/* ============================================================
   TELECAMERA E MAPPA INFINITA
============================================================ */

/**
 * Aggiorna la posizione e lo zoom della telecamera per seguire entrambi i giocatori.
 * Implementa zoom dinamico basato sulla distanza tra i giocatori.
 * @param {number} dt - Delta time in secondi
 */
function updateCamera(dt) {
  if (!p[0] || !p[1] || p[0].isDead && p[1].isDead) return;

  // Calcola il centro tra i due giocatori
  const p0x = p[0].x + p[0].w / 2;
  const p0y = p[0].y + p[0].h / 2;
  const p1x = p[1].x + p[1].w / 2;
  const p1y = p[1].y + p[1].h / 2;
  
  const targetCamX = (p0x + p1x) / 2;
  const targetCamY = (p0y + p1y) / 2;

  // Interpolazione smooth della posizione della telecamera
  camX += (targetCamX - camX) * CAMERA_CONFIG.panSpeed;
  camY += (targetCamY - camY) * CAMERA_CONFIG.panSpeed;

  // Calcola lo zoom basato sulla distanza tra i giocatori
  const dist = Math.hypot(p1x - p0x, p1y - p0y);
  const zoomFactor = Math.max(CAMERA_CONFIG.minZoom, Math.min(CAMERA_CONFIG.maxZoom, 1 - (dist / CAMERA_CONFIG.maxDist) * 0.4));
  targetZoom = zoomFactor;

  // Interpolazione smooth dello zoom
  camZoom += (targetZoom - camZoom) * CAMERA_CONFIG.zoomSpeed;
}

/**
 * Disegna gli indicatori freccia per i giocatori fuori schermo.
 * Mostra una freccia che punta verso la posizione del giocatore.
 */
function drawOffscreenIndicators() {
  const W = cv.width, H = cv.height;
  const margin = CAMERA_CONFIG.offscreenIndicatorDist;

  p.forEach((pp, pi) => {
    if (!pp || pp.isDead) return;
    
    const px = pp.x + pp.w / 2;
    const py = pp.y + pp.h / 2;

    // Calcola la posizione relativa alla telecamera
    const screenX = (px - camX) * camZoom + W / 2;
    const screenY = (py - camY) * camZoom + H / 2;

    // Se il giocatore è fuori schermo, mostra un indicatore
    if (screenX < -margin || screenX > W + margin || screenY < -margin || screenY > H + margin) {
      cx.save();
      cx.translate(W / 2, H / 2);
      const angle = Math.atan2(screenY - H / 2, screenX - W / 2);
      cx.rotate(angle);
      
      // Disegna freccia
      const arrowDist = Math.min(W, H) * 0.35;
      cx.fillStyle = pp.col;
      cx.globalAlpha = 0.8;
      cx.beginPath();
      cx.moveTo(arrowDist, 0);
      cx.lineTo(arrowDist - 12, -8);
      cx.lineTo(arrowDist - 12, 8);
      cx.closePath();
      cx.fill();
      
      // Testo con percentuale di danno
      cx.font = 'bold 14px Nunito,sans-serif';
      cx.textAlign = 'right';
      cx.textBaseline = 'middle';
      cx.fillText(Math.round(pp.damage) + '%', arrowDist - 18, 0);
      
      cx.globalAlpha = 1;
      cx.restore();
    }
  });
}

