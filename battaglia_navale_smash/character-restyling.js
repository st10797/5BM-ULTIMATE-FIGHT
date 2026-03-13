/**
 * character-restyling.js — Restyling completo dei personaggi
 * 
 * Questo file contiene il restyling completo di tutti i personaggi con:
 * - Outfit unici basati sulle abilità
 * - Colori secondari e accenti
 * - Dettagli visivi personalizzati per ogni personaggio
 * 
 * AGGIORNAMENTO v2.0
 */

/**
 * Disegna un personaggio con outfit personalizzato e dettagli unici.
 * Estende il rendering base con elementi decorativi specifici del personaggio.
 * 
 * @param {number} pi - Indice del giocatore (0 o 1)
 * @param {string} characterId - ID del personaggio (es. 'Brutus', 'Tornari')
 */
function drawCharacterWithOutfit(pi, characterId) {
  const pp = p[pi];
  if (!pp || pp.isDead) return;
  
  const ch = pp.ch;
  const bcx = pp.x + pp.w / 2;
  const bcy = pp.y + pp.h / 2;
  
  // Disegna gli elementi decorativi specifici del personaggio
  switch (characterId) {
    case 'Brutus':
      drawBrutusOutfit(pp, ch, bcx, bcy);
      break;
    case 'Tornari':
      drawTornariOutfit(pp, ch, bcx, bcy);
      break;
    case 'Scottex':
      drawScottexOutfit(pp, ch, bcx, bcy);
      break;
    case 'Ercolano':
      drawErcolanoOutfit(pp, ch, bcx, bcy);
      break;
    case 'Pierigoat':
      drawPierigoatOutfit(pp, ch, bcx, bcy);
      break;
    case 'GoatNatan':
      drawGoatNatanOutfit(pp, ch, bcx, bcy);
      break;
    case 'Marcello':
      drawMarcelloOutfit(pp, ch, bcx, bcy);
      break;
    case 'Taji':
      drawTajiOutfit(pp, ch, bcx, bcy);
      break;
    case 'Gibo':
      drawGiboOutfit(pp, ch, bcx, bcy);
      break;
    case 'Bolly':
      drawBollyOutfit(pp, ch, bcx, bcy);
      break;
    case 'Cappels':
      drawCappelsOutfit(pp, ch, bcx, bcy);
      break;
    case 'Cerchioni':
      drawCerchioniOutfit(pp, ch, bcx, bcy);
      break;
    case 'JoeySchiatti':
      drawJoeySchiatti_Outfit(pp, ch, bcx, bcy);
      break;
    case 'Coppa':
      drawCoppaOutfit(pp, ch, bcx, bcy);
      break;
    case 'DB':
      drawDBOutfit(pp, ch, bcx, bcy);
      break;
    case 'Giuls':
      drawGiulsOutfit(pp, ch, bcx, bcy);
      break;
    case 'Nitrato':
      drawNitratoOutfit(pp, ch, bcx, bcy);
      break;
    case 'Ogbi':
      drawOgbiOutfit(pp, ch, bcx, bcy);
      break;
    case 'Pingus':
      drawPingusOutfit(pp, ch, bcx, bcy);
      break;
    case 'Taff':
      drawTaffOutfit(pp, ch, bcx, bcy);
      break;
    case 'Chivez':
      drawChivezOutfit(pp, ch, bcx, bcy);
      break;
  }
}

// ============================================================
// OUTFIT SPECIFICI PER OGNI PERSONAGGIO
// ============================================================

function drawBrutusOutfit(pp, ch, bcx, bcy) {
  // Brutus: Guerriero con armatura pesante
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.6;
  // Spallacci
  cx.beginPath();
  cx.arc(-pp.w * 0.25, -pp.h * 0.15, 8, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.arc(pp.w * 0.25, -pp.h * 0.15, 8, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawTornariOutfit(pp, ch, bcx, bcy) {
  // Tornari: Tuta aerodinamica con effetto vortice
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 1.5;
  cx.globalAlpha = 0.4;
  // Linee aerodinamiche
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * 6;
    cx.beginPath();
    cx.moveTo(-pp.w * 0.3, offset);
    cx.quadraticCurveTo(0, offset + 4, pp.w * 0.3, offset);
    cx.stroke();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawScottexOutfit(pp, ch, bcx, bcy) {
  // Scottex: Costume assorbente con texture
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.3;
  // Pattern a quadri
  for (let x = -pp.w * 0.2; x < pp.w * 0.2; x += 8) {
    for (let y = -pp.h * 0.15; y < pp.h * 0.15; y += 8) {
      cx.fillRect(x, y, 4, 4);
    }
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawErcolanoOutfit(pp, ch, bcx, bcy) {
  // Ercolano: Armatura infuocata con effetto lava
  cx.save();
  cx.translate(bcx, bcy);
  const lavaPulse = 0.5 + 0.5 * Math.sin(bgT * 2);
  cx.shadowBlur = 15;
  cx.shadowColor = ch.outfitAccent;
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.4 + 0.2 * lavaPulse;
  cx.beginPath();
  cx.arc(0, -pp.h * 0.2, 12, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.shadowBlur = 0;
  cx.restore();
}

function drawPierigoatOutfit(pp, ch, bcx, bcy) {
  // Pierigoat: Vesti mistiche con aura
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 2;
  cx.globalAlpha = 0.5;
  // Aura mistica
  cx.beginPath();
  cx.arc(0, 0, pp.w * 0.4, 0, Math.PI * 2);
  cx.stroke();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawGoatNatanOutfit(pp, ch, bcx, bcy) {
  // GoatNatan: Corazza marina con onde
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 1;
  cx.globalAlpha = 0.3;
  // Onde marine
  for (let i = 0; i < 4; i++) {
    const y = -pp.h * 0.15 + i * 6;
    cx.beginPath();
    cx.moveTo(-pp.w * 0.25, y);
    cx.quadraticCurveTo(0, y + 3, pp.w * 0.25, y);
    cx.stroke();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawMarcelloOutfit(pp, ch, bcx, bcy) {
  // Marcello: Tuta tecnologica con circuiti
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 1;
  cx.globalAlpha = 0.5;
  // Circuiti
  cx.beginPath();
  cx.moveTo(-pp.w * 0.15, -pp.h * 0.1);
  cx.lineTo(pp.w * 0.15, -pp.h * 0.1);
  cx.lineTo(pp.w * 0.15, pp.h * 0.1);
  cx.lineTo(-pp.w * 0.15, pp.h * 0.1);
  cx.closePath();
  cx.stroke();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawTajiOutfit(pp, ch, bcx, bcy) {
  // Taji: Abito ninja oscuro con dettagli rossi
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.6;
  // Fascia ninja
  cx.fillRect(-pp.w * 0.3, -pp.h * 0.05, pp.w * 0.6, pp.h * 0.1);
  cx.globalAlpha = 1;
  cx.restore();
}

function drawGiboOutfit(pp, ch, bcx, bcy) {
  // Gibo: Armatura da capo con dettagli dorati
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.7;
  // Corona
  cx.beginPath();
  cx.moveTo(-pp.w * 0.2, -pp.h * 0.25);
  cx.lineTo(-pp.w * 0.15, -pp.h * 0.35);
  cx.lineTo(0, -pp.h * 0.3);
  cx.lineTo(pp.w * 0.15, -pp.h * 0.35);
  cx.lineTo(pp.w * 0.2, -pp.h * 0.25);
  cx.fill();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawBollyOutfit(pp, ch, bcx, bcy) {
  // Bolly: Costume elastico con pattern
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 2;
  cx.globalAlpha = 0.4;
  // Strisce elastiche
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    cx.beginPath();
    cx.moveTo(0, 0);
    cx.lineTo(Math.cos(angle) * pp.w * 0.3, Math.sin(angle) * pp.h * 0.3);
    cx.stroke();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawCappelsOutfit(pp, ch, bcx, bcy) {
  // Cappels: Abito da mago con onde musicali
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 1.5;
  cx.globalAlpha = 0.5;
  // Onde musicali
  const wavePhase = bgT * 3;
  for (let i = 0; i < 3; i++) {
    cx.beginPath();
    for (let x = -pp.w * 0.2; x <= pp.w * 0.2; x += 2) {
      const y = Math.sin(x * 0.1 + wavePhase + i) * 3 - pp.h * 0.1 + i * 6;
      x === -pp.w * 0.2 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    }
    cx.stroke();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawCerchioniOutfit(pp, ch, bcx, bcy) {
  // Cerchioni: Tuta da pilota con strisce
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.5;
  // Strisce da pilota
  cx.fillRect(-pp.w * 0.25, -pp.h * 0.1, pp.w * 0.15, pp.h * 0.2);
  cx.fillRect(pp.w * 0.1, -pp.h * 0.1, pp.w * 0.15, pp.h * 0.2);
  cx.globalAlpha = 1;
  cx.restore();
}

function drawJoeySchiatti_Outfit(pp, ch, bcx, bcy) {
  // Joey Schiatti: Mantello spettrale
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.3;
  // Mantello fluttuante
  cx.beginPath();
  cx.moveTo(-pp.w * 0.3, -pp.h * 0.2);
  cx.quadraticCurveTo(-pp.w * 0.4, 0, -pp.w * 0.3, pp.h * 0.2);
  cx.quadraticCurveTo(0, pp.h * 0.3, pp.w * 0.3, pp.h * 0.2);
  cx.quadraticCurveTo(pp.w * 0.4, 0, pp.w * 0.3, -pp.h * 0.2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawCoppaOutfit(pp, ch, bcx, bcy) {
  // Coppa: Armatura dorata con effetto luminoso
  cx.save();
  cx.translate(bcx, bcy);
  const coppaGlow = 0.5 + 0.5 * Math.sin(bgT * 2.5);
  cx.shadowBlur = 20;
  cx.shadowColor = ch.outfitAccent;
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.5 + 0.2 * coppaGlow;
  cx.beginPath();
  cx.arc(0, 0, pp.w * 0.35, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.shadowBlur = 0;
  cx.restore();
}

function drawDBOutfit(pp, ch, bcx, bcy) {
  // DB: Tuta digitale con glitch effect
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.4;
  // Glitch effect
  for (let i = 0; i < 3; i++) {
    const offset = (Math.random() - 0.5) * 4;
    cx.fillRect(-pp.w * 0.2 + offset, -pp.h * 0.1 + i * 6, pp.w * 0.4, 4);
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawGiulsOutfit(pp, ch, bcx, bcy) {
  // Giuls: Abito da pasticcera con dettagli dolci
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.6;
  // Fiocco
  cx.beginPath();
  cx.arc(-pp.w * 0.15, -pp.h * 0.2, 6, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.arc(pp.w * 0.15, -pp.h * 0.2, 6, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawNitratoOutfit(pp, ch, bcx, bcy) {
  // Nitrato: Tuta chimica con simboli
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.5;
  // Simbolo chimico
  cx.beginPath();
  cx.moveTo(-pp.w * 0.1, -pp.h * 0.1);
  cx.lineTo(pp.w * 0.1, -pp.h * 0.1);
  cx.lineTo(pp.w * 0.1, pp.h * 0.1);
  cx.lineTo(-pp.w * 0.1, pp.h * 0.1);
  cx.closePath();
  cx.stroke();
  cx.globalAlpha = 1;
  cx.restore();
}

function drawOgbiOutfit(pp, ch, bcx, bcy) {
  // Ogbi: Armatura vorticosa
  cx.save();
  cx.translate(bcx, bcy);
  cx.strokeStyle = ch.outfitAccent;
  cx.lineWidth = 2;
  cx.globalAlpha = 0.5;
  // Vortice
  for (let i = 0; i < 3; i++) {
    cx.beginPath();
    cx.arc(0, 0, (i + 1) * 8, 0, Math.PI * 2);
    cx.stroke();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawPingusOutfit(pp, ch, bcx, bcy) {
  // Pingus: Corazza glaciale
  cx.save();
  cx.translate(bcx, bcy);
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.4;
  // Cristalli di ghiaccio
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * pp.w * 0.25;
    const y = Math.sin(angle) * pp.h * 0.25;
    cx.beginPath();
    cx.moveTo(x, y - 6);
    cx.lineTo(x + 6, y + 3);
    cx.lineTo(x - 6, y + 3);
    cx.closePath();
    cx.fill();
  }
  cx.globalAlpha = 1;
  cx.restore();
}

function drawTaffOutfit(pp, ch, bcx, bcy) {
  // Taff: Abito luminoso
  cx.save();
  cx.translate(bcx, bcy);
  const taffGlow = 0.5 + 0.5 * Math.sin(bgT * 3);
  cx.shadowBlur = 25;
  cx.shadowColor = ch.outfitAccent;
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.4 + 0.3 * taffGlow;
  cx.beginPath();
  cx.arc(0, 0, pp.w * 0.4, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.shadowBlur = 0;
  cx.restore();
}

function drawChivezOutfit(pp, ch, bcx, bcy) {
  // Chivez: Armatura infuocata
  cx.save();
  cx.translate(bcx, bcy);
  const chivezFlame = 0.5 + 0.5 * Math.sin(bgT * 2.8);
  cx.shadowBlur = 18;
  cx.shadowColor = ch.outfitAccent;
  cx.fillStyle = ch.outfitAccent;
  cx.globalAlpha = 0.5 + 0.2 * chivezFlame;
  // Fiamme
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * pp.w * 0.15;
    cx.beginPath();
    cx.arc(x, pp.h * 0.2, 6, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;
  cx.shadowBlur = 0;
  cx.restore();
}
