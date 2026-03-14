/**
 * powers.js — Battaglia Navale Smash
 * Gestisce la funzione usePower(playerIndex) e tutte le logiche dei superpoteri.
 * Ogni potere è implementato come un case nello switch su pp.ch.powType.
 * Dipende da: config.js, engine.js
 */

/* ============================================================
   HELPER: ANNUNCIO POTERE
============================================================ */

/**
 * Mostra il banner di annuncio del potere al centro dello schermo.
 * @param {string} text - Testo dell'annuncio (es. "💥 PUGNO DEVASTANTE!")
 * @param {string} col  - Colore del testo
 */
function showPowAnnounce(text, col) {
  const el   = document.getElementById('pow-name-el');
  const wrap = document.getElementById('pow-announce');
  el.textContent = text;
  el.style.color = col;
  el.style.textShadow = `0 0 40px ${col},0 0 80px ${col},5px 5px 0 rgba(0,0,0,.5)`;
  wrap.classList.remove('show');
  void wrap.offsetWidth; // forza reflow per riavviare la transizione CSS
  wrap.classList.add('show');
  setTimeout(() => wrap.classList.remove('show'), 1400);
}

/* ============================================================
   FUNZIONE PRINCIPALE: usePower
============================================================ */

/**
 * Attiva il superpotere del giocatore specificato.
 * Richiede che la barra del potere sia piena (pCharge >= 1).
 * @param {number} pi - Indice del giocatore che usa il potere (0 o 1)
 */
function usePower(pi) {
  const pp = p[pi], op = p[1 - pi];
  if (pp.pCharge < 1 || pp.isDead) return;
  pp.pCharge = 0;
  updPBar(pi);
  const ch = pp.ch;

  // Sincronizzazione multiplayer: notifica l'uso dell'abilità
  if (typeof isMultiplayer !== 'undefined' && isMultiplayer && pi === localPlayerIndex) {
    if (typeof onPowerUsed === 'function') onPowerUsed(pi);
  }

  switch (ch.powType) {

    /* ──────────────────────────────────────────────────────
       BRUTUS — Pugno Devastante
       8 proiettili esplosivi a cerchio + slam ravvicinato
    ────────────────────────────────────────────────────── */
    case 'Brutus': {
      showPowAnnounce('💥 PUGNO DEVASTANTE!', ch.col);
      flashScreen(ch.col, 0.65); shake = 1.3;
      for (let r = 0; r < 4; r++) {
        setTimeout(() => addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 220 + r * 55, life: 0.6, col: ch.col }), r * 70);
      }
      // 8 proiettili a cerchio
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        projs.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, owner: pi, dmg: ch.powDmg, col: ch.col, sz: 11, type: 'skull', life: 1.8, spin: 0 });
      }
      // Slam ravvicinato bonus
      if (pp.onGround && !op.isDead && op.invincT <= 0) {
        const dist = Math.hypot((pp.x + pp.w / 2) - (op.x + op.w / 2), pp.y - op.y);
        if (dist < 200) {
          setTimeout(() => {
            if (op.isDead || op.invincT > 0) return;
            const extraDmg = Math.round(ch.powDmg * 1.5);
            op.damage += extraDmg; op.vx += pp.facing * 18; op.vy = -24; op.hitFlash = 0.4;
            updPct(1 - pi); popDmg(op.x + op.w / 2, op.y, extraDmg, '💥', ch.col);
            spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
            shake = 1.6; hitstopFrames = 12;
          }, 110);
        }
      }
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 18, y: pp.y + pp.h * 0.5, vx: (Math.random() - 0.5) * 18, vy: -4 - Math.random() * 14, life: 1.2 + Math.random() * 0.5, ml: 1.7, col: ['#fff', ch.col, '#ff8800'][Math.floor(Math.random() * 3)], sz: 3 + Math.random() * 8 });
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       TORNARI — Ciclone Assassino
       Tornado che aspira e danneggia continuamente
    ────────────────────────────────────────────────────── */
    case 'Tornari': {
      showPowAnnounce('🌀 CICLONE ASSASSINO!', ch.col);
      flashScreen(ch.col, 0.4);
      efxArr.push({ type: 'tornado_mega', x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.3, life: 3.0, col: ch.col, pi, spin: 0, r: 0, vx: pp.facing * 2.5, dmgTimer: 0 });
      addPfx({ type: 'tornado_birth', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 0.8, col: ch.col });
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        const a = i / MAX_PARTICLES_PER_EXPLOSION * Math.PI * 8, r = i * 2;
        setTimeout(() => ptcls.push({ x: pp.x + pp.w / 2 + Math.cos(a) * r * 0.08, y: pp.y + pp.h / 2 + Math.sin(a) * r * 0.08, vx: Math.cos(a) * 4.5 * pp.facing, vy: Math.sin(a) * 4.5 - 3, life: 0.9, ml: 0.9, col: ch.col, sz: 2 + Math.random() * 3.5 }), i * 12);
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       SCOTTEX — Assorbimento Totale
       Ripristina fino a 45% di danno
    ────────────────────────────────────────────────────── */
    case 'Scottex': {
      showPowAnnounce('🧻 ASSORBIMENTO!', '#fff');
      const healed = Math.min(pp.damage, 45);
      pp.damage = Math.max(0, pp.damage - 45);
      updPct(pi);
      flashScreen('#fff', 0.6);
      flt('-' + healed + '% CURATO!', pp.x, pp.y, '#ffffff');
      addPfx({ type: 'heal_burst', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 1.1, col: '#fff' });
      for (let r = 0; r < 3; r++) addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 70 + r * 45, life: 0.5, col: '#ccccff' });
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        setTimeout(() => ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 55, y: pp.y + pp.h + (Math.random() - 0.5) * 55, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 8, life: 1.0, ml: 1.0, col: Math.random() > 0.5 ? '#fff' : '#ccccff', sz: 3 + Math.random() * 5 }), i * 18);
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       ERCOLANO — Inferno Magmatico
       Scudo + pioggia di lava sull'avversario
    ────────────────────────────────────────────────────── */
    case 'Ercolano': {
      showPowAnnounce('🌋 INFERNO MAGMATICO!', ch.col);
      pp.shielded = true; pp.pActive = true; pp.pTimer = 4.0;
      flashScreen(ch.col, 0.65); shake = 1.1;
      addPfx({ type: 'magma_shield', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 4.0, col: ch.col, pulse: 0, pi });
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 26, y: pp.y + pp.h, vx: (Math.random() - 0.5) * 14, vy: -5 - Math.random() * 18, life: 1.5, ml: 1.5, col: ['#fff', ch.col, '#ffcc00'][Math.floor(Math.random() * 3)], sz: 3 + Math.random() * 8 });
      }
      // Pioggia di lava sull'avversario
      for (let i = 0; i < 7; i++) {
        setTimeout(() => {
          if (!op || op.isDead) return;
          const lx = op.x + op.w / 2 + (Math.random() - 0.5) * 90;
          projs.push({ x: lx, y: -10, vx: (Math.random() - 0.5) * 3, vy: 7 + Math.random() * 5, owner: pi, dmg: Math.round(ch.powDmg / 3.5), col: '#ff6b00', sz: 10, type: 'bomb', life: 3.5, spin: 0 });
        }, i * 170 + 180);
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       PIERIGOAT — Raggio Divino
       Raggio a 3 colpi multipli
    ────────────────────────────────────────────────────── */
    case 'Pierigoat': {
      if (!op.isDead) {
        showPowAnnounce('🐐 RAGGIO DIVINO!', ch.col);
        flashScreen(ch.col, 0.6);
        addPfx({ type: 'divine_beam', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, tx: op.x + op.w / 2, ty: op.y + op.h / 2, life: 0.7, col: ch.col });
        const hitsPerHit = [Math.round(ch.powDmg * 0.35), Math.round(ch.powDmg * 0.35), Math.round(ch.powDmg * 0.3)];
        hitsPerHit.forEach((dmg, hit) => {
          setTimeout(() => {
            if (op.isDead || op.invincT > 0) return;
            op.damage += dmg; op.vx += pp.facing * (4 + hit * 4); op.vy -= (3 + hit * 2.5); op.hitFlash = 0.28;
            updPct(1 - pi); popDmg(op.x + op.w / 2, op.y - hit * 18, dmg, '✨', ch.col);
            spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, ch.col, 14);
            addPfx({ type: 'shockwave', x: op.x + op.w / 2, y: op.y + op.h / 2, r: 0, maxR: 70 + hit * 40, life: 0.3, col: ch.col });
            shake = 0.65 + hit * 0.18; hitstopFrames = 6 + hit * 2;
          }, hit * 230 + 280);
        });
        // Scia di scintille
        for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
          setTimeout(() => {
            const dx = op.x + op.w / 2 - (pp.x + pp.w / 2), dy = (op.y + op.h / 2) - (pp.y + pp.h / 2);
            const t = i / MAX_PARTICLES_PER_EXPLOSION;
            ptcls.push({ x: pp.x + pp.w / 2 + dx * t + (Math.random() - 0.5) * 18, y: pp.y + pp.h / 2 + dy * t + (Math.random() - 0.5) * 18, vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 3, life: 0.6, ml: 0.6, col: ch.col, sz: 3 + Math.random() * 4.5 });
          }, i * 11);
        }
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       GOATNATAN — Tsunami Devastante
       Carica orizzontale con danno massiccio al contatto
    ────────────────────────────────────────────────────── */
    case 'GoatNatan': {
      showPowAnnounce('🌊 TSUNAMI DEVASTANTE!', ch.col);
      flashScreen(ch.col, 0.55); shake = 1.4;
      pp.vx = pp.facing * 24; pp.pActive = true; pp.pTimer = 0.85;
      addPfx({ type: 'tidal_rush', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 0.85, col: ch.col, trail: [], facing: pp.facing });
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 28, y: pp.y + pp.h + (Math.random() - 0.5) * 28, vx: pp.facing * (9 + Math.random() * 12), vy: -3 - Math.random() * 8, life: 0.8, ml: 0.8, col: ['#fff', ch.col, '#88eeff'][Math.floor(Math.random() * 3)], sz: 3 + Math.random() * 7 });
      }
      const waveIv = setInterval(() => {
        if (!p[pi] || !p[1 - pi]) { clearInterval(waveIv); return; }
        const dx = Math.abs((p[pi].x + p[pi].w / 2) - (p[1 - pi].x + p[1 - pi].w / 2));
        if (dx < 85 && !p[1 - pi].isDead && p[1 - pi].invincT <= 0) {
          p[1 - pi].damage += ch.powDmg; p[1 - pi].vx += pp.facing * 22; p[1 - pi].vy = -18; p[1 - pi].hitFlash = 0.45;
          updPct(1 - pi); popDmg(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y, ch.powDmg, '🌊', ch.col);
          spawnHitParticles(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y + p[1 - pi].h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
          addPfx({ type: 'shockwave', x: p[1 - pi].x + p[1 - pi].w / 2, y: p[1 - pi].y + p[1 - pi].h / 2, r: 0, maxR: 260, life: 0.65, col: ch.col });
          shake = 2.0; hitstopFrames = 14; clearInterval(waveIv);
        }
      }, 40);
      setTimeout(() => clearInterval(waveIv), 1000);
      break;
    }

    /* ──────────────────────────────────────────────────────
       MARCELLO — Bombardamento Laser
       4 laser in direzioni diverse
    ────────────────────────────────────────────────────── */
    case 'Marcello': {
      showPowAnnounce('📡 BOMBARDAMENTO LASER!', ch.col);
      flashScreen(ch.col, 0.45);
      addPfx({ type: 'scan_grid', life: 1.6, col: ch.col, sL: 1.6 });
      setTimeout(() => {
        [-7, -2.5, 2.5, 7].forEach((vy, i) => {
          setTimeout(() => {
            projs.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.45, vx: pp.facing * 15, vy, owner: pi, dmg: Math.round(ch.powDmg / 3), col: ch.col, sz: 7, type: 'laser', life: 2.5, spin: 0 });
            for (let j = 0; j < 8; j++) {
              ptcls.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.45 + (Math.random() - 0.5) * 10, vx: pp.facing * (10 + Math.random() * 8), vy: vy + (Math.random() - 0.5) * 3, life: 0.14, ml: 0.14, col: j % 2 ? ch.col : '#fff', sz: 2 + Math.random() * 3 });
            }
          }, i * 75);
        });
      }, 480);
      break;
    }

    /* ──────────────────────────────────────────────────────
       TAJI — Teletrasporto Letale
       Teletrasporto sopra l'avversario + combo 4 colpi
    ────────────────────────────────────────────────────── */
    case 'Taji': {
      if (!op.isDead) {
        showPowAnnounce('🥷 TELETRASPORTO LETALE!', ch.col);
        flashScreen(ch.col, 0.75);
        addPfx({ type: 'ghost', x: pp.x, y: pp.y, w: pp.w, h: pp.h, life: 1.0, col: ch.col, em: ch.em, facing: pp.facing });
        pp.x = op.x; pp.y = op.y - pp.h - 4; pp.vx = 0; pp.vy = 0;
        spawnHitParticles(pp.x + pp.w / 2, pp.y + pp.h / 2, ch.col, 22);
        for (let i = 0; i < 4; i++) addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 35 + i * 28, life: 0.22, col: ch.col });
        const dmgPerHit = [Math.round(ch.powDmg * 0.12), Math.round(ch.powDmg * 0.18), Math.round(ch.powDmg * 0.25), Math.round(ch.powDmg * 0.45)];
        dmgPerHit.forEach((dmg, hit) => {
          setTimeout(() => {
            if (op.isDead || op.invincT > 0) return;
            op.damage += dmg;
            if (hit === 3) {
              op.vx += pp.facing * 26; op.vy = -30; shake = 2.0; hitstopFrames = 14;
              flashScreen('#fff', 0.55);
              addPfx({ type: 'shockwave', x: op.x + op.w / 2, y: op.y + op.h / 2, r: 0, maxR: 320, life: 0.65, col: '#fff' });
            } else {
              op.vx += pp.facing * (2 + hit * 2.5); op.vy -= (2 + hit * 2);
            }
            op.hitFlash = 0.32; updPct(1 - pi);
            popDmg(op.x + op.w / 2, op.y - hit * 14, dmg, hit === 3 ? '💥' : '⚡', ch.col);
            spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, hit === 3 ? '#fff' : ch.col, hit === 3 ? MAX_PARTICLES_PER_EXPLOSION : 10);
            if (hit < 3) { shake = 0.5 + hit * 0.15; hitstopFrames = 4 + hit * 2; }
          }, hit * 145 + 70);
        });
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       GIBO — Armata dei Nani
       Lancia 5 proiettili 'nano' che inseguono il bersaglio.
       La logica di inseguimento è in updProjectiles() in engine.js.
    ────────────────────────────────────────────────────── */
    case 'armata_nani': {
      showPowAnnounce('🧔‍♂️ ARMATA DEI NANI!', ch.col);
      flashScreen(ch.col, 0.5); shake = 0.8;
      addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 180, life: 0.5, col: ch.col });
      // Lancia 5 nani in direzioni diverse, ognuno insegue il bersaglio
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spd = 5 + Math.random() * 3;
        setTimeout(() => {
          projs.push({
            x: pp.x + pp.w / 2, y: pp.y + pp.h / 2,
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
            owner: pi, dmg: Math.round(ch.powDmg / 5),
            col: ch.col, sz: 10, type: 'nano', life: 4.0, spin: 0,
          });
        }, i * 120);
      }
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 30, y: pp.y + pp.h / 2, vx: (Math.random() - 0.5) * 10, vy: -3 - Math.random() * 8, life: 0.8, ml: 0.8, col: ch.col, sz: 3 + Math.random() * 5 });
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       BOLLY — Super Rimbalzo
       Rimbalzo super potenziato + controlli invertiti all'avversario.
       Stato alterato: p.controlsInverted con timer setTimeout.
    ────────────────────────────────────────────────────── */
    case 'gigantismo': {
      showPowAnnounce('🎈 BOLLY GIGANTE!!!', ch.col);
      flashScreen(ch.col, 0.85);
      shake = 2.5;

      // Onde d'urto multiple alla trasformazione
      for (let r = 0; r < 5; r++) {
        setTimeout(() => {
          addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 280 + r * 60, life: 0.7, col: ch.col });
        }, r * 80);
      }

      // Applica gigantismo ENORME: scala 5.5x visiva, hitbox 2.5x, danno 4x
      pp.gigantScale       = 5.5;   // Scala visiva enormemente amplificata
      pp.w                 = 44 * 2.5;  // Hitbox fisica allargata
      pp.h                 = 58 * 2.5;  // Hitbox fisica alta
      pp.speedMultiplier   = 0.45;  // Più lento (è enorme)
      pp.damageMultiplier  = 4.0;   // Danno quadruplicato
      pp.invincT           = 0.6;   // Breve invincibilità alla trasformazione

      // Esplosione di particelle massiccia
      for (let i = 0; i < 40; i++) {
        const ang = i / 40 * Math.PI * 2;
        const spd = 8 + Math.random() * 18;
        ptcls.push({
          x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 60,
          y: pp.y + pp.h / 2,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 4,
          life: 1.4, ml: 1.4, col: ch.col, sz: 8 + Math.random() * 14
        });
      }

      // Testo flottante
      flt('🎈 GIGANTE!!!', pp.x, pp.y - 40, ch.col);

      // Ripristina dopo 7 secondi
      const piCapture = pi;
      setTimeout(() => {
        if (p[piCapture]) {
          p[piCapture].gigantScale     = 1.0;
          p[piCapture].w               = 44;
          p[piCapture].h               = 58;
          p[piCapture].speedMultiplier = 1.0;
          p[piCapture].damageMultiplier= 1.0;
          flashScreen(p[piCapture].ch.col, 0.4);
          flt('Gigantismo terminato', p[piCapture].x, p[piCapture].y, '#88ff88');
        }
      }, 7000);
      break;
    }

    /* ──────────────────────────────────────────────────────
       CAPPELS — Onda Musicale
       Tre onde sonore che si espandono orizzontalmente
    ────────────────────────────────────────────────────── */
    case 'onda_musicale': {
      showPowAnnounce('🎓 RAFFICA MUSICALE!', ch.col);
      flashScreen(ch.col, 0.5);
      shake = 1.2;
      // Lancia 15 note musicali in raffica rapida
      for (let i = 0; i < 15; i++) {
        setTimeout(() => {
          const angle = (i / 15) * Math.PI * 0.6 - Math.PI * 0.3;
          const spd = 14 + Math.random() * 4;
          projs.push({
            x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.5,
            vx: Math.cos(angle) * spd * pp.facing, vy: Math.sin(angle) * spd,
            owner: pi, dmg: Math.round(ch.powDmg / 15 * 1.5),
            col: ch.col, sz: 8, type: 'onda', life: 2.5, spin: 0
          });
          for (let j = 0; j < 3; j++) {
            ptcls.push({
              x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.5 + (Math.random() - 0.5) * 15,
              vx: Math.cos(angle) * (10 + Math.random() * 4) * pp.facing, vy: Math.sin(angle) * (10 + Math.random() * 4),
              life: 0.4, ml: 0.4, col: ch.col, sz: 2 + Math.random() * 4
            });
          }
        }, i * 40);
      }
      addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 200, life: 0.6, col: ch.col });
      break;
    }

    /* ──────────────────────────────────────────────────────
       CERCHIONI — Turbo Derapata
       Carica orizzontale ultra veloce con scia di fumo
    ────────────────────────────────────────────────────── */
    case 'turbo_derapata': {
      showPowAnnounce('🛞 TURBO DERAPATA!', ch.col);
      flashScreen(ch.col, 0.55); shake = 1.0;
      pp.vx = pp.facing * 32; // velocità estrema
      pp.pActive = true; pp.pTimer = 0.7;
      pp.invincT = 0.4;
      // Scia di fumo e scintille
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        setTimeout(() => {
          ptcls.push({ x: pp.x + pp.w / 2 - pp.facing * i * 4, y: pp.y + pp.h * 0.8, vx: -pp.facing * (1 + Math.random() * 3), vy: -Math.random() * 3, life: 0.5, ml: 0.5, col: i % 3 === 0 ? '#ff8800' : i % 3 === 1 ? ch.col : '#888', sz: 3 + Math.random() * 5 });
        }, i * 15);
      }
      // Danno al contatto durante la derapata
      const driftIv = setInterval(() => {
        if (!p[pi] || !p[1 - pi]) { clearInterval(driftIv); return; }
        const dist = Math.hypot((p[pi].x + p[pi].w / 2) - (p[1 - pi].x + p[1 - pi].w / 2), (p[pi].y + p[pi].h / 2) - (p[1 - pi].y + p[1 - pi].h / 2));
        if (dist < 70 && !p[1 - pi].isDead && p[1 - pi].invincT <= 0) {
          p[1 - pi].damage += ch.powDmg;
          p[1 - pi].vx += pp.facing * 20; p[1 - pi].vy = -16; p[1 - pi].hitFlash = 0.4;
          updPct(1 - pi); popDmg(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y, ch.powDmg, '🛞', ch.col);
          spawnHitParticles(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y + p[1 - pi].h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
          addPfx({ type: 'shockwave', x: p[1 - pi].x + p[1 - pi].w / 2, y: p[1 - pi].y + p[1 - pi].h / 2, r: 0, maxR: 200, life: 0.5, col: ch.col });
          shake = 1.5; hitstopFrames = 10; clearInterval(driftIv);
        }
      }, 30);
      setTimeout(() => clearInterval(driftIv), 800);
      break;
    }

    /* ──────────────────────────────────────────────────────
       JOEY SCHIATTI — Presa Tombale
       Teletrasporto + presa che azzera la velocità e infligge danno massiccio
    ────────────────────────────────────────────────────── */
    case 'presa_tombale': {
      if (!op.isDead) {
        showPowAnnounce('💀 PRESA TOMBALE!', ch.col);
        flashScreen('#000', 0.7);
        // Teletrasporto accanto all'avversario
        addPfx({ type: 'ghost', x: pp.x, y: pp.y, w: pp.w, h: pp.h, life: 0.8, col: ch.col, em: ch.em, facing: pp.facing });
        pp.x = op.x + (pp.facing > 0 ? -pp.w - 5 : op.w + 5);
        pp.y = op.y; pp.vx = 0; pp.vy = 0;
        // Effetti visivi
        for (let i = 0; i < 5; i++) addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 40 + i * 25, life: 0.3 + i * 0.05, col: ch.col });
        spawnHitParticles(pp.x + pp.w / 2, pp.y + pp.h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
        // Presa: blocca l'avversario e infligge danno in 3 fasi
        setTimeout(() => {
          if (op.isDead || op.invincT > 0) return;
          // Fase 1: blocco
          op.vx = 0; op.vy = 0;
          flt('💀 PRESA!', op.x, op.y, ch.col);
          // Fase 2: danno massiccio
          setTimeout(() => {
            if (op.isDead || op.invincT > 0) return;
            op.damage += ch.powDmg;
            op.vx = pp.facing * 28; op.vy = -26;
            op.hitFlash = 0.5;
            updPct(1 - pi);
            popDmg(op.x + op.w / 2, op.y, ch.powDmg, '💀', ch.col);
            spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
            addPfx({ type: 'shockwave', x: op.x + op.w / 2, y: op.y + op.h / 2, r: 0, maxR: 280, life: 0.7, col: ch.col });
            flashScreen(ch.col, 0.6); shake = 2.0; hitstopFrames = 16;
          }, 350);
        }, 150);
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       COPPA — Luce della Vittoria
       Scudo dorato + burst di luce che danneggia e cura
    ────────────────────────────────────────────────────── */
    case 'luce_vittoria': {
      showPowAnnounce('🏆 LUCE DELLA VITTORIA!', ch.col);
      // Flash dorato speciale
      const goldFlash = document.createElement('div');
      goldFlash.className = 'golden-flash';
      document.body.appendChild(goldFlash);
      setTimeout(() => goldFlash.remove(), 600);
      // Scudo temporaneo
      pp.shielded = true; pp.pActive = true; pp.pTimer = 3.0;
      pp.isImmune = true;
      setTimeout(() => { if (p[pi]) p[pi].isImmune = false; }, 1500);
      // Piccola cura
      const healed = Math.min(pp.damage, 20);
      pp.damage = Math.max(0, pp.damage - 20);
      updPct(pi);
      flt('-' + healed + '% CURATO!', pp.x, pp.y, ch.col);
      addPfx({ type: 'heal_burst', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 1.0, col: ch.col });
      // Burst di luce che danneggia l'avversario
      for (let r = 0; r < 5; r++) {
        setTimeout(() => addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 100 + r * 60, life: 0.6, col: ch.col }), r * 80);
      }
      if (!op.isDead && op.invincT <= 0) {
        const dist = Math.hypot((pp.x + pp.w / 2) - (op.x + op.w / 2), pp.y - op.y);
        if (dist < 280) {
          setTimeout(() => {
            if (op.isDead || op.invincT > 0) return;
            op.damage += ch.powDmg;
            op.vx += pp.facing * 14; op.vy = -18; op.hitFlash = 0.35;
            updPct(1 - pi); popDmg(op.x + op.w / 2, op.y, ch.powDmg, '🏆', ch.col);
            spawnHitParticles(op.x + op.w / 2, op.y + op.h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
            shake = 1.0; hitstopFrames = 8;
          }, 200);
        }
      }
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        const a = Math.random() * Math.PI * 2;
        ptcls.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, vx: Math.cos(a) * (4 + Math.random() * 8), vy: Math.sin(a) * (4 + Math.random() * 8), life: 1.0, ml: 1.0, col: ch.col, sz: 4 + Math.random() * 6 });
      }
      break;
    }

    /* ──────────────────────────────────────────────────────
       DB — System Error
       Inverte i controlli dell'avversario + glitch visivo.
       Stato alterato: p.controlsInverted con timer setTimeout.
    ────────────────────────────────────────────────────── */
    case 'system_error': {
      showPowAnnounce('💾 SYSTEM ERROR!', ch.col);
      flashScreen(ch.col, 0.5);
      addPfx({ type: 'scan_grid', life: 2.0, col: ch.col, sL: 2.0 });
      // Effetti glitch
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 60, y: pp.y + pp.h / 2 + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 0.4, ml: 0.4, col: Math.random() > 0.5 ? ch.col : '#fff', sz: 2 + Math.random() * 4 });
      }
      // Applica controlli invertiti all'avversario per 4 secondi
      if (!op.isDead) {
        op.controlsInverted = true;
        flt('💾 CONTROLLI INVERTITI!', op.x, op.y - 20, ch.col);
        // Piccolo danno da glitch
        op.damage += ch.powDmg;
        op.hitFlash = 0.3;
        updPct(1 - pi);
        popDmg(op.x + op.w / 2, op.y, ch.powDmg, '💾', ch.col);
        setTimeout(() => {
          if (p[1 - pi]) {
            p[1 - pi].controlsInverted = false;
            flt('✓ Sistema ripristinato', p[1 - pi].x, p[1 - pi].y, '#88ff88');
          }
        }, 4000);
      }
      shake = 0.7; hitstopFrames = 6;
      break;
    }

    /* ──────────────────────────────────────────────────────
       GIULS — Pasticcini Esplosivi
       Lancia 4 pasticcini che esplodono al contatto
    ────────────────────────────────────────────────────── */
    case 'pasticcini_esplosivi': {
      showPowAnnounce('🎀 PASTICCINI ESPLOSIVI!', ch.col);
      flashScreen(ch.col, 0.4);
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          const angle = (i / 4) * Math.PI - Math.PI / 2 + (Math.random() - 0.5) * 0.8;
          projs.push({
            x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.3,
            vx: pp.facing * (8 + Math.random() * 4) + Math.cos(angle) * 3,
            vy: Math.sin(angle) * 8 - 5,
            owner: pi, dmg: Math.round(ch.powDmg / 4),
            col: ch.col, sz: 12, type: 'pasticcino', life: 2.5, spin: 0,
          });
        }, i * 100);
      }
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        ptcls.push({ x: pp.x + pp.w / 2 + (Math.random() - 0.5) * 20, y: pp.y + pp.h * 0.3, vx: (Math.random() - 0.5) * 10, vy: -3 - Math.random() * 8, life: 0.6, ml: 0.6, col: ch.col, sz: 3 + Math.random() * 5 });
      }
      addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 120, life: 0.4, col: ch.col });
      shake = 0.5;
      break;
    }

    /* ──────────────────────────────────────────────────────
       NITRATO — Nube Tossica
       Crea un'area di danno continuo (oggetto in areas[]).
    ────────────────────────────────────────────────────── */
    case 'nube_tossica': {
      showPowAnnounce('🧪 NUBE TOSSICA!', ch.col);
      flashScreen(ch.col, 0.35);
      // Crea l'area di danno continuo
      const nubeArea = {
        type: 'nube_tossica',
        x: pp.x + pp.w / 2, y: pp.y + pp.h / 2,
        r: 110, // raggio dell'area
        life: 5.0, // durata in secondi
        owner: pi,
        col: ch.col,
        dmgPerTick: 3, // danno ogni 0.15 secondi
        dmgTimer: 0,
        particleTimer: 0,
      };
      areas.push(nubeArea);
      // Aggiunge anche l'effetto visivo overlay
      pfxArr.push({ type: 'toxic_cloud', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 110, life: 5.0, col: ch.col });
      flt('☠️ NUBE TOSSICA!', pp.x, pp.y, ch.col);
      shake = 0.4;
      break;
    }

    /* ──────────────────────────────────────────────────────
       OGBI — Vortice Gravitazionale
       Crea un vortice che attrae l'avversario e infligge danno.
    ────────────────────────────────────────────────────── */
    case 'vortice': {
      showPowAnnounce('🌀 VORTICE GRAVITAZIONALE!', ch.col);
      flashScreen(ch.col, 0.4);
      // Crea l'area vortice
      const vortexArea = {
        type: 'vortice',
        x: pp.x + pp.w / 2, y: pp.y + pp.h / 2,
        r: 140, // raggio di attrazione
        life: 4.0,
        owner: pi,
        col: ch.col,
        force: 120, // forza di attrazione
        dmgPerTick: 2,
        dmgTimer: 0,
        particleTimer: 0,
        angle: 0,
      };
      areas.push(vortexArea);
      pfxArr.push({ type: 'vortex_field', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 140, life: 4.0, col: ch.col });
      addPfx({ type: 'tornado_birth', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, life: 0.8, col: ch.col });
      flt('🌀 VORTICE!', pp.x, pp.y, ch.col);
      shake = 0.6;
      break;
    }

    /* ──────────────────────────────────────────────────────
       PINGUS — Scivolata Glaciale
       Scivolata ultra veloce che congela l'avversario
    ────────────────────────────────────────────────────── */
    case 'scivolata_glaciale': {
      showPowAnnounce('🐧 SCIVOLATA GLACIALE!', ch.col);
      flashScreen(ch.col, 0.4);
      pp.vx = pp.facing * 28;
      pp.atkAnim = 'slide'; pp.atkT = 0.6; pp.atkProg = 0;
      pp.invincT = 0.3;
      // Scia di ghiaccio
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        setTimeout(() => {
          ptcls.push({ x: pp.x + pp.w / 2 - pp.facing * i * 5, y: pp.y + pp.h, vx: -pp.facing * (1 + Math.random() * 2), vy: -Math.random() * 2, life: 0.5, ml: 0.5, col: i % 2 === 0 ? '#aaddff' : '#ffffff', sz: 2 + Math.random() * 4 });
        }, i * 12);
      }
      // Danno al contatto con effetto congelamento
      const iceIv = setInterval(() => {
        if (!p[pi] || !p[1 - pi]) { clearInterval(iceIv); return; }
        const dist = Math.hypot((p[pi].x + p[pi].w / 2) - (p[1 - pi].x + p[1 - pi].w / 2), (p[pi].y + p[pi].h / 2) - (p[1 - pi].y + p[1 - pi].h / 2));
        if (dist < 65 && !p[1 - pi].isDead && p[1 - pi].invincT <= 0) {
          p[1 - pi].damage += ch.powDmg;
          p[1 - pi].vx += pp.facing * 16; p[1 - pi].vy = -14; p[1 - pi].hitFlash = 0.35;
          // Effetto congelamento: rallenta l'avversario
          p[1 - pi].speedMultiplier = 0.3;
          setTimeout(() => { if (p[1 - pi]) p[1 - pi].speedMultiplier = 1; }, 2000);
          flt('❄️ CONGELATO!', p[1 - pi].x, p[1 - pi].y, ch.col);
          updPct(1 - pi); popDmg(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y, ch.powDmg, '❄️', ch.col);
          spawnHitParticles(p[1 - pi].x + p[1 - pi].w / 2, p[1 - pi].y + p[1 - pi].h / 2, ch.col, MAX_PARTICLES_PER_EXPLOSION);
          addPfx({ type: 'shockwave', x: p[1 - pi].x + p[1 - pi].w / 2, y: p[1 - pi].y + p[1 - pi].h / 2, r: 0, maxR: 180, life: 0.5, col: ch.col });
          shake = 1.1; hitstopFrames = 8; clearInterval(iceIv);
        }
      }, 30);
      setTimeout(() => clearInterval(iceIv), 700);
      break;
    }

    /* ──────────────────────────────────────────────────────
       TAFF — Troppa Aura
       Mostra "TROPPA AURA BRO" e azzera il danno ricevuto.
       Effetto visivo: testo speciale + flash dorato.
    ────────────────────────────────────────────────────── */
    case 'troppa_aura': {
      showPowAnnounce('🍬 TROPPA AURA!', ch.col);
      // Mostra il testo speciale "TROPPA AURA BRO" al centro schermo
      const auraTxt = document.getElementById('aura-txt');
      auraTxt.textContent = '✨ TROPPA AURA BRO ✨';
      auraTxt.className = '';
      void auraTxt.offsetWidth;
      auraTxt.className = 'show';
      setTimeout(() => { auraTxt.className = ''; }, 2500);
      // Flash dorato
      const goldFlash2 = document.createElement('div');
      goldFlash2.className = 'golden-flash';
      document.body.appendChild(goldFlash2);
      setTimeout(() => goldFlash2.remove(), 600);
      // Azzera il danno del giocatore
      const prevDmg = pp.damage;
      pp.damage = 0;
      updPct(pi);
      flt('-' + prevDmg + '% AURA TOTALE!', pp.x, pp.y, ch.col);
      // Scudo temporaneo di aura
      pp.shielded = true; pp.pActive = true; pp.pTimer = 2.5;
      pp.isImmune = true;
      setTimeout(() => { if (p[pi]) p[pi].isImmune = false; }, 2000);
      // Burst di particelle dorate
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        const a = Math.random() * Math.PI * 2;
        ptcls.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, vx: Math.cos(a) * (5 + Math.random() * 10), vy: Math.sin(a) * (5 + Math.random() * 10), life: 1.2, ml: 1.2, col: ch.col, sz: 4 + Math.random() * 8 });
      }
      for (let r = 0; r < 4; r++) {
        setTimeout(() => addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 150 + r * 50, life: 0.7, col: ch.col }), r * 100);
      }
      shake = 0.8;
      break;
    }

    /* ──────────────────────────────────────────────────────
       CHIVEZ — Furia Piccante
       Potenzia velocità e danno per 4 secondi + proiettili di fuoco
    ────────────────────────────────────────────────────── */
    case 'furia_piccante': {
      showPowAnnounce('🌶️ FURIA PICCANTE!', ch.col);
      flashScreen(ch.col, 0.6); shake = 1.2;
      // Potenziamento: velocità aumentata per 4 secondi
      pp.speedMultiplier = 2.0;
      setTimeout(() => { if (p[pi]) p[pi].speedMultiplier = 1; }, 4000);
      flt('🌶️ FURIA ATTIVATA!', pp.x, pp.y, ch.col);
      // Proiettili di fuoco in avanti
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          projs.push({
            x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.4,
            vx: pp.facing * (14 + i * 2), vy: (i - 2) * 1.5,
            owner: pi, dmg: Math.round(ch.powDmg / 5),
            col: ch.col, sz: 9, type: 'skull', life: 1.8, spin: 0,
          });
          for (let j = 0; j < 4; j++) {
            ptcls.push({ x: pp.x + pp.w / 2, y: pp.y + pp.h * 0.4 + (Math.random() - 0.5) * 10, vx: pp.facing * (10 + Math.random() * 6), vy: (Math.random() - 0.5) * 4, life: 0.2, ml: 0.2, col: j % 2 ? '#ff4400' : '#ffaa00', sz: 3 + Math.random() * 4 });
          }
        }, i * 80);
      }
      // Aura di fuoco attorno al personaggio
      for (let i = 0; i < MAX_PARTICLES_PER_EXPLOSION; i++) {
        const a = Math.random() * Math.PI * 2;
        ptcls.push({ x: pp.x + pp.w / 2 + Math.cos(a) * 20, y: pp.y + pp.h / 2 + Math.sin(a) * 20, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 2, life: 0.8, ml: 0.8, col: Math.random() > 0.5 ? ch.col : '#ff8800', sz: 4 + Math.random() * 6 });
      }
      for (let r = 0; r < 3; r++) {
        setTimeout(() => addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 120 + r * 40, life: 0.5, col: ch.col }), r * 80);
      }
      break;
    }

    default:
      // Potere non implementato: effetto generico
      showPowAnnounce('⚡ POTERE!', ch.col);
      flashScreen(ch.col, 0.4);
      for (let r = 0; r < 3; r++) addPfx({ type: 'shockwave', x: pp.x + pp.w / 2, y: pp.y + pp.h / 2, r: 0, maxR: 100 + r * 50, life: 0.5, col: ch.col });
      break;
  }
}
