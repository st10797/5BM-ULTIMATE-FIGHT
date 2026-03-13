/**
 * map-improvements.js — Miglioramenti alla mappa
 * 
 * Questo file contiene le migliorie alla mappa del gioco:
 * - Limiti realistici (non infiniti)
 * - Stile realistico con effetti visivi migliorati
 * - Bordi definiti con barriera energetica
 * - Piattaforme ridisegnate
 * 
 * AGGIORNAMENTO v2.0
 */

/**
 * Disegna gli elementi decorativi della mappa per un aspetto più realistico.
 * Include elementi ambientali, luci e effetti atmosferici.
 */
function drawMapDecorations() {
  const W = cv.width, H = cv.height;
  
  // Effetto nebbia al suolo realistico
  const fogGradient = cx.createLinearGradient(0, H * 0.7, 0, H);
  fogGradient.addColorStop(0, 'rgba(40, 20, 100, 0)');
  fogGradient.addColorStop(0.3, 'rgba(50, 30, 120, 0.15)');
  fogGradient.addColorStop(0.7, 'rgba(40, 20, 100, 0.35)');
  fogGradient.addColorStop(1, 'rgba(30, 10, 80, 0.5)');
  cx.fillStyle = fogGradient;
  cx.fillRect(0, H * 0.7, W, H * 0.3);
  
  // Effetto luce ambientale pulsante
  const ambientGlow = cx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, W * 0.8);
  const glowIntensity = 0.08 + 0.04 * Math.sin(bgT * 0.5);
  ambientGlow.addColorStop(0, `rgba(100, 80, 200, ${glowIntensity})`);
  ambientGlow.addColorStop(1, 'rgba(50, 30, 150, 0)');
  cx.fillStyle = ambientGlow;
  cx.fillRect(0, 0, W, H);
}

/**
 * Disegna le piattaforme con stile realistico e dettagli.
 * Ogni piattaforma ha effetti luminosi e texture.
 */
function drawPlatformsEnhanced() {
  const plats = getPlats();
  const W = cv.width, H = cv.height;
  const pulse = 0.5 + 0.5 * Math.sin(bgT * 2);
  
  plats.forEach((pl, idx) => {
    const px = pl.x, py = pl.y, pw = pl.w, ph = pl.h;
    
    // Ombra sotto la piattaforma
    cx.save();
    cx.globalAlpha = 0.15;
    const shadowGrad = cx.createLinearGradient(px, py + ph, px, py + ph + 20);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cx.fillStyle = shadowGrad;
    cx.fillRect(px, py + ph, pw, 20);
    cx.restore();
    
    // Corpo principale della piattaforma con gradiente
    const platformGrad = cx.createLinearGradient(px, py, px, py + ph);
    if (pl.main) {
      // Piattaforma principale: colore blu/viola
      platformGrad.addColorStop(0, 'rgba(100, 150, 255, 0.9)');
      platformGrad.addColorStop(0.5, 'rgba(80, 120, 220, 0.85)');
      platformGrad.addColorStop(1, 'rgba(60, 100, 200, 0.8)');
    } else {
      // Piattaforme secondarie: colore viola/rosa
      platformGrad.addColorStop(0, 'rgba(150, 100, 200, 0.8)');
      platformGrad.addColorStop(0.5, 'rgba(130, 80, 180, 0.75)');
      platformGrad.addColorStop(1, 'rgba(110, 60, 160, 0.7)');
    }
    cx.fillStyle = platformGrad;
    cx.beginPath();
    cx.roundRect(px, py, pw, ph, pl.main ? 8 : 6);
    cx.fill();
    
    // Bordo superiore luminoso
    cx.save();
    const edgeGrad = cx.createLinearGradient(px, py, px + pw, py);
    const edgeColor = pl.main ? '180, 200, 255' : '200, 150, 255';
    edgeGrad.addColorStop(0, `rgba(${edgeColor}, 0)`);
    edgeGrad.addColorStop(0.1, `rgba(${edgeColor}, 0.8)`);
    edgeGrad.addColorStop(0.5, `rgba(${edgeColor}, 1)`);
    edgeGrad.addColorStop(0.9, `rgba(${edgeColor}, 0.8)`);
    edgeGrad.addColorStop(1, `rgba(${edgeColor}, 0)`);
    cx.strokeStyle = edgeGrad;
    cx.lineWidth = pl.main ? 3 : 2;
    cx.shadowBlur = 15;
    cx.shadowColor = `rgba(${edgeColor}, 0.6)`;
    cx.beginPath();
    cx.moveTo(px + 8, py);
    cx.lineTo(px + pw - 8, py);
    cx.stroke();
    cx.restore();
    
    // Effetto luminoso pulsante
    cx.save();
    cx.globalAlpha = pulse * 0.2;
    cx.fillStyle = pl.main ? 'rgba(150, 180, 255, 0.5)' : 'rgba(180, 150, 255, 0.4)';
    cx.beginPath();
    cx.roundRect(px + 2, py + 2, pw - 4, ph - 4, pl.main ? 6 : 4);
    cx.fill();
    cx.restore();
    
    // Dettagli sulla piattaforma principale
    if (pl.main) {
      cx.save();
      cx.globalAlpha = 0.3;
      cx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
      cx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const x = px + (pw / 5) * i;
        cx.beginPath();
        cx.moveTo(x, py + ph * 0.3);
        cx.lineTo(x, py + ph * 0.7);
        cx.stroke();
      }
      cx.restore();
    }
  });
}

/**
 * Disegna indicatori di pericolo ai bordi della mappa.
 * Avvisa i giocatori quando si avvicinano ai limiti.
 */
function drawDangerIndicators() {
  const W = cv.width, H = cv.height;
  const L = W * MAP_LIMITS.L, R = W * MAP_LIMITS.R, T = H * MAP_LIMITS.T, B = H * MAP_LIMITS.B;
  
  // Indicatori di pericolo ai bordi
  cx.save();
  const dangerPulse = 0.5 + 0.5 * Math.sin(bgT * 3);
  
  // Bordo sinistro
  const gradDL = cx.createLinearGradient(L, T, L + 60, T);
  gradDL.addColorStop(0, `rgba(255, 100, 100, ${0.3 * dangerPulse})`);
  gradDL.addColorStop(1, 'rgba(255, 100, 100, 0)');
  cx.fillStyle = gradDL;
  cx.fillRect(L, T, 60, B - T);
  
  // Bordo destro
  const gradDR = cx.createLinearGradient(R - 60, T, R, T);
  gradDR.addColorStop(0, 'rgba(255, 100, 100, 0)');
  gradDR.addColorStop(1, `rgba(255, 100, 100, ${0.3 * dangerPulse})`);
  cx.fillStyle = gradDR;
  cx.fillRect(R - 60, T, 60, B - T);
  
  // Bordo superiore
  const gradDT = cx.createLinearGradient(L, T, L, T + 40);
  gradDT.addColorStop(0, `rgba(255, 100, 100, ${0.2 * dangerPulse})`);
  gradDT.addColorStop(1, 'rgba(255, 100, 100, 0)');
  cx.fillStyle = gradDT;
  cx.fillRect(L, T, R - L, 40);
  
  cx.restore();
}

/**
 * Disegna effetti particellari per l'ambiente della mappa.
 * Include particelle di polvere, scintille e effetti atmosferici.
 */
function drawEnvironmentalEffects() {
  const W = cv.width, H = cv.height;
  
  // Particelle di polvere fluttuanti
  cx.save();
  for (let i = 0; i < 6; i++) {
    const px = W * (0.15 + 0.15 * i + 0.05 * Math.sin(bgT * 0.2 + i * 1.5));
    const py = H * (0.3 + 0.15 * Math.sin(bgT * 0.15 + i * 0.9));
    const size = 2 + 1.5 * Math.sin(bgT * 0.3 + i);
    const alpha = 0.04 + 0.02 * Math.sin(bgT * 0.4 + i);
    
    cx.fillStyle = `rgba(200, 180, 255, ${alpha})`;
    cx.shadowBlur = 8;
    cx.shadowColor = 'rgba(200, 180, 255, 0.3)';
    cx.beginPath();
    cx.arc(px, py, size, 0, Math.PI * 2);
    cx.fill();
  }
  cx.shadowBlur = 0;
  cx.restore();
}

/**
 * Integrazione con il loop principale di rendering.
 * Questa funzione dovrebbe essere chiamata nel loop di gioco
 * dopo drawBg() e prima di disegnare i giocatori.
 */
function renderMapEnhancements() {
  drawMapDecorations();
  drawEnvironmentalEffects();
  drawDangerIndicators();
}
