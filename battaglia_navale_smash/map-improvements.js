/**
 * map-improvements.js — Battaglia Navale Smash v3.0
 * RESTYLING COMPLETO MAPPA:
 * [MAP-01] Telecamera FISSA: nessun pan, nessun zoom, nessuna rotazione
 * [MAP-02] Bordi fisici invalicabili: montagne, oceano, muri architettonici
 * [MAP-03] Sfondo realistico HD con illuminazione dinamica e parallax
 * [MAP-04] Piattaforme ridisegnate con texture pietra/metallo
 * [MAP-05] Indicatori di pericolo ai bordi (effetto vignette rosso)
 * [MAP-06] Effetti atmosferici: nebbia, nuvole, raggi di luce
 */

/* ============================================================
   [MAP-01] TELECAMERA FISSA
   Sovrascrive updateCamera con una funzione no-op.
   La mappa rimane centrata e immobile nel frame.
   camX e camY sono fissati al centro del canvas.
   camZoom è sempre 1.0.
============================================================ */
(function patchStaticCamera() {
  // Aspetta che il DOM e il canvas siano pronti
  function applyPatch() {
    // Fissa la telecamera al centro del canvas
    if (typeof cv !== 'undefined' && cv) {
      window.camX    = cv.width  / 2;
      window.camY    = cv.height / 2;
      window.camZoom = 1.0;
      window.targetZoom = 1.0;
    }
    // Sostituisce updateCamera con una funzione fissa
    window.updateCamera = function(dt) {
      // [MAP-01] Telecamera FISSA — nessun movimento, nessuno zoom
      if (typeof cv !== 'undefined' && cv) {
        window.camX    = cv.width  / 2;
        window.camY    = cv.height / 2;
        window.camZoom = 1.0;
        window.targetZoom = 1.0;
      }
    };
    console.log('[MAP v3.0] Telecamera fissa applicata');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPatch);
  } else {
    // Ritarda leggermente per assicurarsi che engine.js sia caricato
    setTimeout(applyPatch, 50);
  }
})();

/* ============================================================
   [MAP-02] BORDI FISICI INVALICABILI
   Aggiorna MAP_LIMITS per bordi stretti (nessuna mappa infinita).
   I giocatori vengono respinti fisicamente dai bordi.
   Ridisegna drawBoundaries con elementi visivi realistici:
   - Sinistra/Destra: montagne rocciose invalicabili
   - Alto: cielo con nuvole (limite superiore)
   - Basso: oceano (kill zone)
============================================================ */

/** Variabile globale per l'animazione dello sfondo */
let bgT = 0;
let mapBgLayers = null;

/**
 * Inizializza i layer di sfondo per il parallax.
 * Chiamata una volta all'avvio.
 */
function initMapBgLayers() {
  mapBgLayers = {
    clouds: [],
    birds:  [],
    debris: [],
  };
  // Genera nuvole
  for (let i = 0; i < 12; i++) {
    mapBgLayers.clouds.push({
      x:    Math.random(),
      y:    0.05 + Math.random() * 0.35,
      w:    0.08 + Math.random() * 0.14,
      h:    0.03 + Math.random() * 0.05,
      spd:  0.00005 + Math.random() * 0.00008,
      al:   0.15 + Math.random() * 0.35,
      type: Math.floor(Math.random() * 3),
    });
  }
  // Genera uccelli/particelle atmosferiche
  for (let i = 0; i < 6; i++) {
    mapBgLayers.birds.push({
      x:   Math.random(),
      y:   0.1 + Math.random() * 0.3,
      spd: 0.0001 + Math.random() * 0.0002,
      al:  0.3 + Math.random() * 0.4,
      sz:  2 + Math.random() * 3,
    });
  }
}

/**
 * [MAP-03] Disegna lo sfondo realistico HD con illuminazione dinamica.
 * Sostituisce la funzione drawBg originale.
 */
function drawRealisticBg() {
  if (!cv || !cx) return;
  const W = cv.width, H = cv.height;
  bgT += 0.016; // ~60fps

  // ── Layer 1: Cielo con gradiente realistico ──────────────
  const skyGrad = cx.createLinearGradient(0, 0, 0, H * 0.65);
  const hour    = (Math.sin(bgT * 0.02) + 1) / 2; // ciclo giorno/notte lento
  if (hour > 0.6) {
    // Giorno
    skyGrad.addColorStop(0,    '#0a1628');
    skyGrad.addColorStop(0.15, '#0d2040');
    skyGrad.addColorStop(0.4,  '#1a3a6e');
    skyGrad.addColorStop(0.7,  '#2a5a9e');
    skyGrad.addColorStop(1,    '#3a7abf');
  } else {
    // Tramonto/alba
    skyGrad.addColorStop(0,    '#050a14');
    skyGrad.addColorStop(0.2,  '#0d1a30');
    skyGrad.addColorStop(0.5,  '#1a2a50');
    skyGrad.addColorStop(0.75, '#8b3a1a');
    skyGrad.addColorStop(1,    '#c06030');
  }
  cx.fillStyle = skyGrad;
  cx.fillRect(0, 0, W, H * 0.65);

  // ── Layer 2: Sole/luna ───────────────────────────────────
  const sunX = W * (0.75 + 0.15 * Math.sin(bgT * 0.015));
  const sunY = H * (0.08 + 0.04 * Math.cos(bgT * 0.02));
  const sunGrad = cx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.12);
  if (hour > 0.6) {
    sunGrad.addColorStop(0,   'rgba(255, 240, 180, 0.9)');
    sunGrad.addColorStop(0.3, 'rgba(255, 200, 80, 0.4)');
    sunGrad.addColorStop(0.7, 'rgba(255, 160, 40, 0.15)');
    sunGrad.addColorStop(1,   'rgba(255, 120, 0, 0)');
  } else {
    sunGrad.addColorStop(0,   'rgba(255, 120, 40, 0.8)');
    sunGrad.addColorStop(0.4, 'rgba(220, 80, 20, 0.3)');
    sunGrad.addColorStop(1,   'rgba(180, 40, 0, 0)');
  }
  cx.fillStyle = sunGrad;
  cx.fillRect(0, 0, W, H * 0.65);

  // ── Layer 3: Stelle (solo di notte) ──────────────────────
  if (hour < 0.5) {
    cx.save();
    cx.globalAlpha = (0.5 - hour) * 2;
    if (typeof stars !== 'undefined') {
      stars.forEach(s => {
        const a = s.al * (0.4 + 0.6 * Math.sin(bgT * s.sp + s.ph));
        cx.fillStyle = `rgba(220, 230, 255, ${a})`;
        cx.beginPath();
        cx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2);
        cx.fill();
      });
    }
    cx.globalAlpha = 1;
    cx.restore();
  }

  // ── Layer 4: Nuvole con parallax ─────────────────────────
  if (!mapBgLayers) initMapBgLayers();
  cx.save();
  mapBgLayers.clouds.forEach(c => {
    c.x = (c.x + c.spd) % 1.2;
    const cx2 = c.x * W, cy2 = c.y * H;
    const cw = c.w * W, ch2 = c.h * H;
    cx.globalAlpha = c.al * (0.7 + 0.3 * Math.sin(bgT * 0.3 + c.x * 5));
    const cGrad = cx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cw * 0.6);
    cGrad.addColorStop(0,   'rgba(255, 255, 255, 0.9)');
    cGrad.addColorStop(0.5, 'rgba(220, 230, 255, 0.5)');
    cGrad.addColorStop(1,   'rgba(180, 200, 240, 0)');
    cx.fillStyle = cGrad;
    cx.beginPath();
    cx.ellipse(cx2, cy2, cw * 0.5, ch2 * 0.5, 0, 0, Math.PI * 2);
    cx.fill();
    // Secondo blob per nuvola più realistica
    cx.globalAlpha = c.al * 0.6;
    cx.beginPath();
    cx.ellipse(cx2 + cw * 0.2, cy2 - ch2 * 0.1, cw * 0.35, ch2 * 0.4, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(cx2 - cw * 0.15, cy2 + ch2 * 0.05, cw * 0.3, ch2 * 0.35, 0, 0, Math.PI * 2);
    cx.fill();
  });
  cx.globalAlpha = 1;
  cx.restore();

  // ── Layer 5: Montagne in lontananza (sfondo) ─────────────
  drawDistantMountains(W, H);

  // ── Layer 6: Oceano / terreno ────────────────────────────
  drawOceanFloor(W, H);

  // ── Layer 7: Nebbia atmosferica ──────────────────────────
  const fogGrad = cx.createLinearGradient(0, H * 0.55, 0, H * 0.75);
  fogGrad.addColorStop(0, 'rgba(150, 180, 220, 0)');
  fogGrad.addColorStop(0.5, `rgba(160, 190, 230, ${0.08 + 0.04 * Math.sin(bgT * 0.3)})`);
  fogGrad.addColorStop(1, 'rgba(100, 140, 200, 0.15)');
  cx.fillStyle = fogGrad;
  cx.fillRect(0, H * 0.55, W, H * 0.2);
}

/**
 * Disegna le montagne distanti con effetto parallax a più livelli.
 */
function drawDistantMountains(W, H) {
  const horizonY = H * 0.62;
  // Layer montagne lontane (più chiare)
  cx.save();
  cx.fillStyle = '#1a2a4a';
  cx.beginPath();
  cx.moveTo(0, horizonY);
  const mPts1 = [
    [0.0, 0.52], [0.06, 0.38], [0.12, 0.45], [0.18, 0.30], [0.24, 0.42],
    [0.30, 0.28], [0.36, 0.40], [0.42, 0.25], [0.48, 0.38], [0.54, 0.22],
    [0.60, 0.35], [0.66, 0.27], [0.72, 0.40], [0.78, 0.32], [0.84, 0.45],
    [0.90, 0.35], [0.96, 0.48], [1.0, 0.52],
  ];
  mPts1.forEach(([fx, fy]) => cx.lineTo(fx * W, fy * H));
  cx.lineTo(W, horizonY);
  cx.closePath();
  cx.fill();

  // Layer montagne medie (più scure, più vicine)
  cx.fillStyle = '#0f1a30';
  cx.beginPath();
  cx.moveTo(0, horizonY);
  const mPts2 = [
    [0.0, 0.56], [0.05, 0.46], [0.10, 0.52], [0.16, 0.40], [0.22, 0.50],
    [0.28, 0.44], [0.34, 0.55], [0.40, 0.42], [0.46, 0.52], [0.52, 0.46],
    [0.58, 0.55], [0.64, 0.48], [0.70, 0.56], [0.76, 0.50], [0.82, 0.58],
    [0.88, 0.52], [0.94, 0.57], [1.0, 0.56],
  ];
  mPts2.forEach(([fx, fy]) => cx.lineTo(fx * W, fy * H));
  cx.lineTo(W, horizonY);
  cx.closePath();
  cx.fill();

  // Neve sulle cime
  cx.fillStyle = 'rgba(220, 235, 255, 0.25)';
  mPts1.filter(([, fy]) => fy < 0.35).forEach(([fx, fy]) => {
    cx.beginPath();
    cx.ellipse(fx * W, fy * H, W * 0.025, H * 0.02, 0, 0, Math.PI * 2);
    cx.fill();
  });
  cx.restore();
}

/**
 * Disegna l'oceano/terreno con onde animate.
 */
function drawOceanFloor(W, H) {
  const seaY = H * 0.88;
  // Sfondo oceano
  const seaGrad = cx.createLinearGradient(0, seaY, 0, H);
  seaGrad.addColorStop(0,   '#0a1e3a');
  seaGrad.addColorStop(0.3, '#071428');
  seaGrad.addColorStop(1,   '#030a18');
  cx.fillStyle = seaGrad;
  cx.fillRect(0, seaY, W, H - seaY);

  // Onde animate
  cx.save();
  for (let wave = 0; wave < 3; wave++) {
    const waveY  = seaY + wave * 8;
    const waveAl = 0.3 - wave * 0.08;
    cx.globalAlpha = waveAl;
    cx.strokeStyle = `rgba(80, 160, 220, 0.8)`;
    cx.lineWidth   = 1.5 - wave * 0.3;
    cx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = waveY + Math.sin((x / W * 8 + bgT * 0.8 + wave * 1.2)) * 3;
      if (x === 0) cx.moveTo(x, y);
      else         cx.lineTo(x, y);
    }
    cx.stroke();
  }
  // Riflesso luce sull'acqua
  const reflGrad = cx.createLinearGradient(W * 0.4, seaY, W * 0.6, seaY);
  reflGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
  reflGrad.addColorStop(0.5, `rgba(140, 200, 255, ${0.12 + 0.06 * Math.sin(bgT * 0.5)})`);
  reflGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
  cx.globalAlpha = 1;
  cx.fillStyle = reflGrad;
  cx.fillRect(W * 0.3, seaY, W * 0.4, 15);
  cx.restore();
}

/**
 * [MAP-02] Disegna i bordi fisici realistici della mappa.
 * Sostituisce drawBoundaries con elementi architettonici/naturali.
 */
function drawRealisticBoundaries() {
  if (!cv || !cx) return;
  const W = cv.width, H = cv.height;
  const L = W * MAP_LIMITS.L;
  const R = W * MAP_LIMITS.R;
  const T = H * MAP_LIMITS.T;
  const B = H * MAP_LIMITS.B;

  cx.save();

  // ── Bordo SINISTRO: Parete rocciosa ──────────────────────
  drawRockyWall(L, T, B, 'left', W, H);

  // ── Bordo DESTRO: Parete rocciosa ────────────────────────
  drawRockyWall(R, T, B, 'right', W, H);

  // ── Bordo SUPERIORE: Soffitto / Cielo invalicabile ───────
  drawCeilingBarrier(L, R, T, W, H);

  // ── Vignette di pericolo ai bordi ────────────────────────
  drawDangerVignette(W, H, L, R, T, B);

  cx.restore();
}

/**
 * Disegna una parete rocciosa invalicabile (sinistra o destra).
 */
function drawRockyWall(xPos, T, B, side, W, H) {
  const wallW = W * 0.12;
  const isLeft = side === 'left';
  const x0 = isLeft ? xPos - wallW : xPos;
  const x1 = isLeft ? xPos : xPos + wallW;

  // Gradiente roccia
  const rockGrad = cx.createLinearGradient(x0, 0, x1, 0);
  if (isLeft) {
    rockGrad.addColorStop(0,   'rgba(15, 10, 5, 0.95)');
    rockGrad.addColorStop(0.5, 'rgba(35, 25, 15, 0.85)');
    rockGrad.addColorStop(0.8, 'rgba(50, 38, 22, 0.6)');
    rockGrad.addColorStop(1,   'rgba(60, 45, 28, 0)');
  } else {
    rockGrad.addColorStop(0,   'rgba(60, 45, 28, 0)');
    rockGrad.addColorStop(0.2, 'rgba(50, 38, 22, 0.6)');
    rockGrad.addColorStop(0.5, 'rgba(35, 25, 15, 0.85)');
    rockGrad.addColorStop(1,   'rgba(15, 10, 5, 0.95)');
  }
  cx.fillStyle = rockGrad;
  cx.fillRect(x0, T, wallW, B - T);

  // Profilo frastagliato della roccia
  const edgeX = isLeft ? xPos : xPos;
  cx.fillStyle = isLeft ? 'rgba(40, 30, 18, 0.9)' : 'rgba(40, 30, 18, 0.9)';
  cx.beginPath();
  if (isLeft) cx.moveTo(x0, T);
  else        cx.moveTo(x1, T);
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const y   = T + (B - T) * (i / steps);
    const jag = (Math.sin(i * 3.7 + 1.2) * 0.5 + Math.sin(i * 7.1) * 0.3) * W * 0.025;
    const x   = isLeft ? xPos + jag : xPos - jag;
    cx.lineTo(x, y);
  }
  if (isLeft) { cx.lineTo(x0, B); cx.lineTo(x0, T); }
  else        { cx.lineTo(x1, B); cx.lineTo(x1, T); }
  cx.closePath();
  cx.fill();

  // Linea di confine luminosa (avviso pericolo)
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 2.5);
  cx.strokeStyle = `rgba(255, 80, 40, ${0.3 + 0.2 * pulse})`;
  cx.lineWidth   = 2;
  cx.setLineDash([12, 6]);
  cx.lineDashOffset = -bgT * 30;
  cx.beginPath();
  cx.moveTo(edgeX, T);
  cx.lineTo(edgeX, B);
  cx.stroke();
  cx.setLineDash([]);

  // Stalattiti/stalagmiti decorative
  cx.fillStyle = 'rgba(30, 22, 12, 0.8)';
  const numSpikes = 8;
  for (let i = 0; i < numSpikes; i++) {
    const sy = T + (B - T) * (i / numSpikes) + (B - T) * 0.06;
    const sH = H * (0.04 + 0.02 * Math.sin(i * 2.3));
    const sW = W * 0.015;
    const sx = isLeft ? xPos - sW * 0.5 : xPos - sW * 0.5;
    cx.beginPath();
    cx.moveTo(sx, sy);
    cx.lineTo(sx + sW, sy);
    cx.lineTo(sx + sW * 0.5, sy + (isLeft ? sH : -sH));
    cx.closePath();
    cx.fill();
  }
}

/**
 * Disegna il soffitto/barriera superiore (cielo invalicabile).
 */
function drawCeilingBarrier(L, R, T, W, H) {
  const ceilH = H * 0.08;
  const ceilGrad = cx.createLinearGradient(0, T, 0, T + ceilH);
  ceilGrad.addColorStop(0,   'rgba(5, 8, 20, 0.95)');
  ceilGrad.addColorStop(0.5, 'rgba(10, 15, 35, 0.7)');
  ceilGrad.addColorStop(1,   'rgba(15, 20, 50, 0)');
  cx.fillStyle = ceilGrad;
  cx.fillRect(L, T, R - L, ceilH);

  // Linea soffitto con effetto barriera
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 2.0);
  const ceilLineGrad = cx.createLinearGradient(L, 0, R, 0);
  ceilLineGrad.addColorStop(0,   'rgba(100, 150, 255, 0)');
  ceilLineGrad.addColorStop(0.1, `rgba(120, 180, 255, ${0.5 + 0.3 * pulse})`);
  ceilLineGrad.addColorStop(0.5, `rgba(160, 200, 255, ${0.7 + 0.3 * pulse})`);
  ceilLineGrad.addColorStop(0.9, `rgba(120, 180, 255, ${0.5 + 0.3 * pulse})`);
  ceilLineGrad.addColorStop(1,   'rgba(100, 150, 255, 0)');
  cx.strokeStyle = ceilLineGrad;
  cx.lineWidth   = 2.5;
  cx.setLineDash([15, 8]);
  cx.lineDashOffset = bgT * 25;
  cx.beginPath();
  cx.moveTo(L, T);
  cx.lineTo(R, T);
  cx.stroke();
  cx.setLineDash([]);
}

/**
 * Disegna le vignette di pericolo ai bordi della mappa.
 */
function drawDangerVignette(W, H, L, R, T, B) {
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 3.0);
  const alpha = 0.08 + 0.06 * pulse;

  // Vignette laterali
  const vL = cx.createLinearGradient(L, 0, L + W * 0.08, 0);
  vL.addColorStop(0, `rgba(220, 50, 30, ${alpha * 2})`);
  vL.addColorStop(1, 'rgba(220, 50, 30, 0)');
  cx.fillStyle = vL;
  cx.fillRect(L, T, W * 0.08, B - T);

  const vR = cx.createLinearGradient(R - W * 0.08, 0, R, 0);
  vR.addColorStop(0, 'rgba(220, 50, 30, 0)');
  vR.addColorStop(1, `rgba(220, 50, 30, ${alpha * 2})`);
  cx.fillStyle = vR;
  cx.fillRect(R - W * 0.08, T, W * 0.08, B - T);

  // Vignette superiori
  const vT = cx.createLinearGradient(0, T, 0, T + H * 0.06);
  vT.addColorStop(0, `rgba(100, 150, 255, ${alpha * 1.5})`);
  vT.addColorStop(1, 'rgba(100, 150, 255, 0)');
  cx.fillStyle = vT;
  cx.fillRect(L, T, R - L, H * 0.06);
}

/**
 * [MAP-04] Ridisegna le piattaforme con texture pietra/metallo realistica.
 * Sostituisce drawPlatforms originale.
 */
function drawRealisticPlatforms() {
  if (!cv || !cx || typeof getPlats !== 'function') return;
  const plats = getPlats();
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 1.5);

  plats.forEach((pl, idx) => {
    const { x, y, w, h, main } = pl;
    cx.save();

    // ── Ombra proiettata ──────────────────────────────────
    cx.globalAlpha = 0.25;
    const shadowGrad = cx.createLinearGradient(x, y + h, x, y + h + 30);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cx.fillStyle = shadowGrad;
    cx.fillRect(x + 4, y + h, w - 4, 30);
    cx.globalAlpha = 1;

    // ── Corpo principale con texture pietra/metallo ───────
    if (main) {
      // Piattaforma principale: pietra scura con venature
      const mainGrad = cx.createLinearGradient(x, y, x, y + h);
      mainGrad.addColorStop(0,   '#3a3028');
      mainGrad.addColorStop(0.3, '#2a2218');
      mainGrad.addColorStop(0.7, '#1e1810');
      mainGrad.addColorStop(1,   '#141008');
      cx.fillStyle = mainGrad;
      cx.beginPath();
      cx.roundRect(x, y, w, h, 4);
      cx.fill();

      // Venature nella pietra
      cx.globalAlpha = 0.12;
      cx.strokeStyle = '#8a7060';
      cx.lineWidth = 1;
      for (let vi = 0; vi < 5; vi++) {
        const vx = x + w * (0.1 + vi * 0.18);
        cx.beginPath();
        cx.moveTo(vx, y);
        cx.bezierCurveTo(
          vx + 8, y + h * 0.3,
          vx - 5, y + h * 0.6,
          vx + 3, y + h
        );
        cx.stroke();
      }
      cx.globalAlpha = 1;

      // Bordo superiore metallico lucido
      const topGrad = cx.createLinearGradient(x, y, x + w, y);
      topGrad.addColorStop(0,    'rgba(180, 160, 120, 0)');
      topGrad.addColorStop(0.08, 'rgba(200, 180, 140, 0.9)');
      topGrad.addColorStop(0.5,  'rgba(220, 200, 160, 1)');
      topGrad.addColorStop(0.92, 'rgba(200, 180, 140, 0.9)');
      topGrad.addColorStop(1,    'rgba(180, 160, 120, 0)');
      cx.strokeStyle = topGrad;
      cx.lineWidth   = 2.5;
      cx.shadowBlur  = 8;
      cx.shadowColor = 'rgba(220, 200, 160, 0.5)';
      cx.beginPath();
      cx.moveTo(x + 6, y);
      cx.lineTo(x + w - 6, y);
      cx.stroke();
      cx.shadowBlur = 0;

      // Rivetti decorativi
      cx.fillStyle = 'rgba(160, 140, 100, 0.7)';
      [0.05, 0.15, 0.85, 0.95].forEach(fx => {
        cx.beginPath();
        cx.arc(x + w * fx, y + h * 0.5, 2.5, 0, Math.PI * 2);
        cx.fill();
      });

      // Faccia laterale 3D
      const sideGrad = cx.createLinearGradient(x, y + h, x, y + h + 8);
      sideGrad.addColorStop(0, '#0e0a06');
      sideGrad.addColorStop(1, 'rgba(5, 3, 2, 0)');
      cx.fillStyle = sideGrad;
      cx.fillRect(x, y + h, w, 8);

    } else {
      // Piattaforme secondarie: metallo arrugginito/industriale
      const platGrad = cx.createLinearGradient(x, y, x, y + h);
      platGrad.addColorStop(0,   '#4a3828');
      platGrad.addColorStop(0.4, '#3a2c1e');
      platGrad.addColorStop(1,   '#2a1e12');
      cx.fillStyle = platGrad;
      cx.beginPath();
      cx.roundRect(x, y, w, h, 3);
      cx.fill();

      // Striature metalliche
      cx.globalAlpha = 0.15;
      cx.fillStyle = '#8a6a4a';
      for (let si = 0; si < 3; si++) {
        const sx = x + w * (0.2 + si * 0.3);
        cx.fillRect(sx, y, 1.5, h);
      }
      cx.globalAlpha = 1;

      // Bordo superiore con bagliore pulsante
      const edgeGrad = cx.createLinearGradient(x, y, x + w, y);
      edgeGrad.addColorStop(0,   'rgba(160, 120, 60, 0)');
      edgeGrad.addColorStop(0.1, `rgba(180, 140, 80, ${0.7 + 0.3 * pulse})`);
      edgeGrad.addColorStop(0.5, `rgba(200, 160, 100, ${0.9 + 0.1 * pulse})`);
      edgeGrad.addColorStop(0.9, `rgba(180, 140, 80, ${0.7 + 0.3 * pulse})`);
      edgeGrad.addColorStop(1,   'rgba(160, 120, 60, 0)');
      cx.strokeStyle = edgeGrad;
      cx.lineWidth   = 2;
      cx.shadowBlur  = 6;
      cx.shadowColor = `rgba(200, 160, 100, ${0.4 * pulse})`;
      cx.beginPath();
      cx.moveTo(x + 4, y);
      cx.lineTo(x + w - 4, y);
      cx.stroke();
      cx.shadowBlur = 0;

      // Faccia laterale 3D
      cx.fillStyle = 'rgba(10, 6, 3, 0.6)';
      cx.fillRect(x, y + h, w, 5);
    }

    cx.restore();
  });
}

/**
 * [MAP-06] Effetti atmosferici: raggi di luce, polvere, particelle.
 */
function drawAtmosphericEffects() {
  if (!cv || !cx) return;
  const W = cv.width, H = cv.height;

  // Raggi di luce dall'alto
  cx.save();
  cx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const rx   = W * (0.25 + i * 0.25 + 0.05 * Math.sin(bgT * 0.2 + i));
    const rAlpha = (0.03 + 0.02 * Math.sin(bgT * 0.4 + i * 1.5));
    const rayGrad = cx.createLinearGradient(rx, 0, rx + W * 0.05, H * 0.7);
    rayGrad.addColorStop(0,   `rgba(200, 220, 255, ${rAlpha * 3})`);
    rayGrad.addColorStop(0.3, `rgba(180, 200, 255, ${rAlpha})`);
    rayGrad.addColorStop(1,   'rgba(150, 180, 255, 0)');
    cx.fillStyle = rayGrad;
    cx.beginPath();
    cx.moveTo(rx - W * 0.01, 0);
    cx.lineTo(rx + W * 0.06, H * 0.7);
    cx.lineTo(rx + W * 0.04, H * 0.7);
    cx.lineTo(rx + W * 0.01, 0);
    cx.closePath();
    cx.fill();
  }
  cx.globalCompositeOperation = 'source-over';
  cx.restore();

  // Particelle di polvere fluttuanti
  cx.save();
  for (let i = 0; i < 8; i++) {
    const px = W * (0.1 + 0.1 * i + 0.04 * Math.sin(bgT * 0.25 + i * 1.3));
    const py = H * (0.2 + 0.12 * Math.sin(bgT * 0.18 + i * 0.9));
    const alpha = 0.04 + 0.02 * Math.sin(bgT * 0.35 + i);
    cx.fillStyle = `rgba(200, 190, 170, ${alpha})`;
    cx.shadowBlur  = 6;
    cx.shadowColor = 'rgba(200, 190, 170, 0.2)';
    cx.beginPath();
    cx.arc(px, py, 1.5 + Math.sin(bgT * 0.4 + i) * 0.8, 0, Math.PI * 2);
    cx.fill();
  }
  cx.shadowBlur = 0;
  cx.restore();
}

/**
 * Funzione principale di rendering della mappa.
 * Chiamata nel loop di gioco.
 */
function renderMapEnhancements() {
  drawAtmosphericEffects();
  drawDangerIndicators();
}

/**
 * Ridisegna gli indicatori di pericolo (mantenuto per compatibilità).
 */
function drawDangerIndicators() {
  if (!cv || !cx) return;
  const W = cv.width, H = cv.height;
  const dangerPulse = 0.5 + 0.5 * Math.sin(bgT * 3);

  cx.save();
  // Bordo sinistro
  const gradDL = cx.createLinearGradient(W * MAP_LIMITS.L, 0, W * MAP_LIMITS.L + 50, 0);
  gradDL.addColorStop(0, `rgba(255, 80, 40, ${0.2 * dangerPulse})`);
  gradDL.addColorStop(1, 'rgba(255, 80, 40, 0)');
  cx.fillStyle = gradDL;
  cx.fillRect(W * MAP_LIMITS.L, H * MAP_LIMITS.T, 50, H * (MAP_LIMITS.B - MAP_LIMITS.T));

  // Bordo destro
  const gradDR = cx.createLinearGradient(W * MAP_LIMITS.R - 50, 0, W * MAP_LIMITS.R, 0);
  gradDR.addColorStop(0, 'rgba(255, 80, 40, 0)');
  gradDR.addColorStop(1, `rgba(255, 80, 40, ${0.2 * dangerPulse})`);
  cx.fillStyle = gradDR;
  cx.fillRect(W * MAP_LIMITS.R - 50, H * MAP_LIMITS.T, 50, H * (MAP_LIMITS.B - MAP_LIMITS.T));
  cx.restore();
}

/* ============================================================
   PATCH DEL LOOP DI RENDERING
   Sovrascrive drawBg, drawBoundaries e drawPlatforms
   con le versioni realistiche.
============================================================ */
(function patchRenderFunctions() {
  function applyRenderPatch() {
    // Sovrascrive drawBg con la versione realistica
    if (typeof window.drawBg === 'function') {
      window.drawBg = drawRealisticBg;
      console.log('[MAP v3.0] drawBg → drawRealisticBg');
    }
    // Sovrascrive drawBoundaries con la versione realistica
    if (typeof window.drawBoundaries === 'function') {
      window.drawBoundaries = drawRealisticBoundaries;
      console.log('[MAP v3.0] drawBoundaries → drawRealisticBoundaries');
    }
    // Sovrascrive drawPlatforms con la versione realistica
    if (typeof window.drawPlatforms === 'function') {
      window.drawPlatforms = drawRealisticPlatforms;
      console.log('[MAP v3.0] drawPlatforms → drawRealisticPlatforms');
    }
    // Inizializza i layer di sfondo
    initMapBgLayers();
    console.log('[MAP v3.0] Restyling mappa applicato — telecamera fissa, bordi fisici, sfondo HD');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRenderPatch);
  } else {
    setTimeout(applyRenderPatch, 100);
  }
})();

/* ============================================================
   AGGIORNAMENTO CONFIG.JS — Bordi fisici stretti
   MAP_LIMITS aggiornati per eliminare la mappa infinita.
============================================================ */
(function updateMapLimits() {
  // Aspetta che MAP_LIMITS sia definito
  function applyLimits() {
    if (typeof MAP_LIMITS !== 'undefined') {
      // Bordi stretti: la mappa è esattamente il canvas visibile
      MAP_LIMITS.L = 0.0;   // Bordo sinistro esatto
      MAP_LIMITS.R = 1.0;   // Bordo destro esatto
      MAP_LIMITS.T = -0.1;  // Piccolo margine sopra
      MAP_LIMITS.B = 1.4;   // Kill zone sotto (caduta)
      // Aggiorna anche KZ se definito
      if (typeof KZ !== 'undefined') {
        KZ.L = MAP_LIMITS.L;
        KZ.R = MAP_LIMITS.R;
        KZ.T = MAP_LIMITS.T;
        KZ.B = MAP_LIMITS.B;
      }
      console.log('[MAP v3.0] MAP_LIMITS aggiornati — bordi fisici stretti applicati');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLimits);
  } else {
    setTimeout(applyLimits, 10);
  }
})();
