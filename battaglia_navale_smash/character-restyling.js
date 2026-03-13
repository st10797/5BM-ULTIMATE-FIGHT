/**
 * character-restyling.js — Battaglia Navale Smash v3.0
 * RESTYLING COMPLETO PERSONAGGI — Stile satirico ad alta qualita grafica
 * Ogni personaggio ha outfit unico che riflette le sue abilita specifiche.
 * Proporzioni esagerate, dettagli vettoriali, zero simboli infantili.
 */

/* ============================================================
   DISPATCHER PRINCIPALE
============================================================ */
function drawCharacterWithOutfit(pi, characterId) {
  const pp = p[pi];
  if (!pp || pp.isDead) return;
  const outfitFns = {
    Brutus: drawBrutusOutfit, Tornari: drawTornariOutfit,
    Scottex: drawScottexOutfit, Ercolano: drawErcolanoOutfit,
    Pierigoat: drawPierigoatOutfit, GoatNatan: drawGoatNatanOutfit,
    Marcello: drawMarcelloOutfit, Taji: drawTajiOutfit,
    Gibo: drawGiboOutfit, Bolly: drawBollyOutfit,
    Cappels: drawCappelsOutfit, Cerchioni: drawCerchioniOutfit,
    JoeySchiatti: drawJoeySchiattiOutfit, Coppa: drawCoppaOutfit,
    DB: drawDBOutfit, Giuls: drawGiulsOutfit,
    Nitrato: drawNitratoOutfit, Ogbi: drawOgbiOutfit,
    Pingus: drawPingusOutfit, Taff: drawTaffOutfit, Chivez: drawChivezOutfit,
  };
  const fn = outfitFns[characterId];
  if (fn) fn(pp, pp.ch, pp.x + pp.w / 2, pp.y + pp.h / 2);
}

function outfitPulse(s) { return 0.5 + 0.5 * Math.sin(bgT * s); }

function drawBelt(cx2, cy2, w, h, bc, bk) {
  cx.fillStyle = bc; cx.fillRect(cx2 - w*0.28, cy2+h*0.08, w*0.56, h*0.06);
  cx.fillStyle = bk; cx.fillRect(cx2 - w*0.05, cy2+h*0.07, w*0.10, h*0.08);
}
function drawCape(cx2, cy2, w, h, col, al) {
  cx.save(); cx.globalAlpha = al||0.7; cx.fillStyle = col;
  cx.beginPath();
  cx.moveTo(cx2-w*0.25, cy2-h*0.25);
  cx.quadraticCurveTo(cx2-w*0.45, cy2+h*0.15, cx2-w*0.35, cy2+h*0.45);
  cx.lineTo(cx2+w*0.35, cy2+h*0.45);
  cx.quadraticCurveTo(cx2+w*0.45, cy2+h*0.15, cx2+w*0.25, cy2-h*0.25);
  cx.closePath(); cx.fill(); cx.restore();
}

/* BRUTUS — Armatura pesante deformata, spallacci enormi, cicatrici */
function drawBrutusOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save();
  const g=cx.createLinearGradient(bcx-w*0.3,bcy-h*0.3,bcx+w*0.3,bcy+h*0.1);
  g.addColorStop(0,'#5a3a1a'); g.addColorStop(0.4,'#3a2210'); g.addColorStop(1,'#1e1008');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.28,bcy-h*0.28,w*0.56,h*0.38,4); cx.fill();
  cx.strokeStyle='#8a6030'; cx.lineWidth=1.5; cx.globalAlpha=0.7;
  cx.beginPath(); cx.moveTo(bcx-w*0.28,bcy-h*0.05); cx.lineTo(bcx+w*0.28,bcy-h*0.05); cx.stroke();
  cx.beginPath(); cx.moveTo(bcx,bcy-h*0.28); cx.lineTo(bcx,bcy+h*0.10); cx.stroke();
  cx.globalAlpha=1;
  const sg=cx.createRadialGradient(bcx-w*0.38,bcy-h*0.22,0,bcx-w*0.38,bcy-h*0.22,w*0.22);
  sg.addColorStop(0,'#7a5020'); sg.addColorStop(1,'#2a1808'); cx.fillStyle=sg;
  cx.beginPath(); cx.ellipse(bcx-w*0.38,bcy-h*0.22,w*0.22,h*0.16,-0.4,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy-h*0.22,w*0.22,h*0.16,0.4,0,Math.PI*2); cx.fill();
  cx.strokeStyle='#c09040'; cx.lineWidth=2; cx.shadowBlur=4; cx.shadowColor='#c09040';
  cx.beginPath(); cx.ellipse(bcx-w*0.38,bcy-h*0.22,w*0.22,h*0.16,-0.4,0,Math.PI*2); cx.stroke();
  cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy-h*0.22,w*0.22,h*0.16,0.4,0,Math.PI*2); cx.stroke();
  cx.shadowBlur=0; drawBelt(bcx,bcy,w,h,'#4a3010','#c09040');
  cx.fillStyle='#c09040';
  [[-0.22,-0.22],[0.22,-0.22],[-0.22,0.05],[0.22,0.05]].forEach(function(r){
    cx.beginPath(); cx.arc(bcx+w*r[0],bcy+h*r[1],2.5,0,Math.PI*2); cx.fill();
  });
  cx.strokeStyle='#8a4020'; cx.lineWidth=1.5; cx.globalAlpha=0.6;
  cx.beginPath(); cx.moveTo(bcx-w*0.08,bcy-h*0.18); cx.lineTo(bcx+w*0.04,bcy-h*0.05); cx.stroke();
  cx.globalAlpha=1; cx.restore();
}

/* TORNARI — Tuta aerodinamica con ali laterali esagerate */
function drawTornariOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(3);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.3,bcx+w*0.25,bcy+h*0.3);
  g.addColorStop(0,'#1e3a6e'); g.addColorStop(0.5,'#0d2040'); g.addColorStop(1,'#061428');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,6); cx.fill();
  cx.strokeStyle='#00d4ff'; cx.lineWidth=3; cx.shadowBlur=12; cx.shadowColor='#00d4ff';
  cx.globalAlpha=0.7+0.3*p;
  for(let i=0;i<3;i++){const o=(i-1)*h*0.12; cx.beginPath(); cx.moveTo(bcx-w*0.26,bcy+o); cx.quadraticCurveTo(bcx,bcy+o-h*0.04,bcx+w*0.26,bcy+o); cx.stroke();}
  cx.shadowBlur=0; cx.globalAlpha=0.6; cx.fillStyle='#00a0cc';
  cx.beginPath(); cx.moveTo(bcx-w*0.25,bcy-h*0.1); cx.quadraticCurveTo(bcx-w*0.7,bcy-h*0.35,bcx-w*0.65,bcy+h*0.15); cx.quadraticCurveTo(bcx-w*0.45,bcy+h*0.05,bcx-w*0.25,bcy+h*0.05); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.25,bcy-h*0.1); cx.quadraticCurveTo(bcx+w*0.7,bcy-h*0.35,bcx+w*0.65,bcy+h*0.15); cx.quadraticCurveTo(bcx+w*0.45,bcy+h*0.05,bcx+w*0.25,bcy+h*0.05); cx.closePath(); cx.fill();
  cx.globalAlpha=1; cx.fillStyle='#ffffff'; cx.font='bold '+Math.floor(w*0.28)+'px monospace';
  cx.textAlign='center'; cx.textBaseline='middle'; cx.globalAlpha=0.8;
  cx.fillText('01',bcx,bcy-h*0.08); cx.globalAlpha=1; cx.restore();
}

/* SCOTTEX — Mummia di carta igienica con rotolo sul fianco */
function drawScottexOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save();
  cx.fillStyle='#f0f0f0'; cx.globalAlpha=0.85;
  cx.beginPath(); cx.roundRect(bcx-w*0.26,bcy-h*0.28,w*0.52,h*0.56,3); cx.fill();
  cx.strokeStyle='#d0d0d0'; cx.lineWidth=1; cx.globalAlpha=0.6;
  for(let i=0;i<8;i++){const y=bcy-h*0.28+h*0.56*(i/8); cx.beginPath(); cx.moveTo(bcx-w*0.26,y); cx.lineTo(bcx+w*0.26,y); cx.stroke();}
  for(let i=0;i<5;i++){const x=bcx-w*0.26+w*0.52*(i/5); cx.beginPath(); cx.moveTo(x,bcy-h*0.28); cx.lineTo(x,bcy+h*0.28); cx.stroke();}
  cx.globalAlpha=1;
  cx.fillStyle='#e8e8e8'; cx.strokeStyle='#b0b0b0'; cx.lineWidth=1.5;
  cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy,w*0.12,h*0.18,0,0,Math.PI*2); cx.fill(); cx.stroke();
  cx.fillStyle='#d0d0d0'; cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy,w*0.05,h*0.08,0,0,Math.PI*2); cx.fill();
  cx.restore();
}

/* ERCOLANO — Armatura di lava solidificata, corna vulcaniche */
function drawErcolanoOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const lp=outfitPulse(2.5);
  const g=cx.createLinearGradient(bcx-w*0.3,bcy-h*0.3,bcx+w*0.3,bcy+h*0.3);
  g.addColorStop(0,'#3a1a08'); g.addColorStop(0.4,'#2a1005'); g.addColorStop(1,'#1a0803');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.3,bcy-h*0.3,w*0.6,h*0.6,3); cx.fill();
  cx.strokeStyle='rgba(255,'+Math.floor(100+80*lp)+',0,'+(0.7+0.3*lp)+')';
  cx.lineWidth=2; cx.shadowBlur=15; cx.shadowColor='#ff6600';
  [[[-0.2,-0.2],[0.0,-0.05],[0.15,0.1]],[[0.1,-0.25],[-0.05,0.0],[0.2,0.15]],[[-0.15,0.05],[0.0,0.2]]].forEach(function(cr){
    cx.beginPath(); cr.forEach(function(pt,i){if(i===0)cx.moveTo(bcx+w*pt[0],bcy+h*pt[1]);else cx.lineTo(bcx+w*pt[0],bcy+h*pt[1]);}); cx.stroke();
  });
  cx.shadowBlur=0; cx.fillStyle='#4a2010'; cx.shadowBlur=20; cx.shadowColor='#ff4400'; cx.globalAlpha=0.9;
  cx.beginPath(); cx.ellipse(bcx-w*0.42,bcy-h*0.25,w*0.25,h*0.18,-0.5,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.ellipse(bcx+w*0.42,bcy-h*0.25,w*0.25,h*0.18,0.5,0,Math.PI*2); cx.fill();
  cx.shadowBlur=0; cx.globalAlpha=1; cx.fillStyle='#2a1008';
  cx.beginPath(); cx.moveTo(bcx-w*0.12,bcy-h*0.35); cx.lineTo(bcx-w*0.18,bcy-h*0.55); cx.lineTo(bcx-w*0.05,bcy-h*0.35); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.12,bcy-h*0.35); cx.lineTo(bcx+w*0.18,bcy-h*0.55); cx.lineTo(bcx+w*0.05,bcy-h*0.35); cx.closePath(); cx.fill();
  cx.restore();
}

/* PIERIGOAT — Vesti logore con circuiti, cappello a punta enorme */
function drawPierigoatOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2);
  const g=cx.createLinearGradient(bcx,bcy-h*0.3,bcx,bcy+h*0.35);
  g.addColorStop(0,'#3a006b'); g.addColorStop(0.5,'#250050'); g.addColorStop(1,'#150030');
  cx.fillStyle=g; cx.beginPath(); cx.moveTo(bcx-w*0.22,bcy-h*0.28); cx.lineTo(bcx+w*0.22,bcy-h*0.28); cx.lineTo(bcx+w*0.32,bcy+h*0.35); cx.lineTo(bcx-w*0.32,bcy+h*0.35); cx.closePath(); cx.fill();
  cx.strokeStyle='rgba(200,100,255,'+(0.4+0.3*p)+')'; cx.lineWidth=1; cx.shadowBlur=6; cx.shadowColor='#c077ff';
  [[[-0.18,-0.1],[-0.18,0.1],[-0.08,0.1]],[[0.15,-0.05],[0.15,0.15],[0.05,0.15]]].forEach(function(path){
    cx.beginPath(); path.forEach(function(pt,i){if(i===0)cx.moveTo(bcx+w*pt[0],bcy+h*pt[1]);else cx.lineTo(bcx+w*pt[0],bcy+h*pt[1]);}); cx.stroke();
    const last=path[path.length-1]; cx.fillStyle='#c077ff'; cx.beginPath(); cx.arc(bcx+w*last[0],bcy+h*last[1],2,0,Math.PI*2); cx.fill();
  });
  cx.shadowBlur=0; cx.fillStyle='#2a0050'; cx.strokeStyle='#c077ff'; cx.lineWidth=1.5;
  cx.beginPath(); cx.moveTo(bcx-w*0.22,bcy-h*0.28); cx.lineTo(bcx,bcy-h*0.75); cx.lineTo(bcx+w*0.22,bcy-h*0.28); cx.closePath(); cx.fill(); cx.stroke();
  cx.fillStyle='rgba(255,200,100,'+(0.6+0.4*p)+')'; cx.shadowBlur=8; cx.shadowColor='#ffd700';
  [[0,-0.55],[-0.08,-0.42],[0.08,-0.42]].forEach(function(pt){cx.beginPath(); cx.arc(bcx+w*pt[0],bcy+h*pt[1],2.5,0,Math.PI*2); cx.fill();});
  cx.shadowBlur=0; cx.restore();
}

/* GOATNATAN — Corazza di scaglie marine, pinne come spallacci */
function drawGoatNatanOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(1.5);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.25,bcx+w*0.25,bcy+h*0.25);
  g.addColorStop(0,'#1a4a5a'); g.addColorStop(0.5,'#0d2a38'); g.addColorStop(1,'#061820');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.26,bcy-h*0.28,w*0.52,h*0.56,5); cx.fill();
  cx.fillStyle='rgba(0,180,220,'+(0.25+0.1*p)+')';
  for(let r=0;r<5;r++)for(let c=0;c<4;c++){const sx=bcx-w*0.22+c*w*0.12+(r%2)*w*0.06,sy=bcy-h*0.22+r*h*0.10; cx.beginPath(); cx.ellipse(sx,sy,w*0.055,h*0.055,0.3,0,Math.PI*2); cx.fill();}
  cx.strokeStyle='rgba(0,200,255,'+(0.5+0.3*p)+')'; cx.lineWidth=2; cx.shadowBlur=10; cx.shadowColor='#00c8ff';
  cx.beginPath(); cx.roundRect(bcx-w*0.26,bcy-h*0.28,w*0.52,h*0.56,5); cx.stroke(); cx.shadowBlur=0;
  cx.fillStyle='#0d3a4a';
  cx.beginPath(); cx.moveTo(bcx-w*0.26,bcy-h*0.2); cx.lineTo(bcx-w*0.5,bcy-h*0.38); cx.lineTo(bcx-w*0.38,bcy); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.26,bcy-h*0.2); cx.lineTo(bcx+w*0.5,bcy-h*0.38); cx.lineTo(bcx+w*0.38,bcy); cx.closePath(); cx.fill();
  cx.restore();
}

/* MARCELLO — Tuta hacker con schermi, antenne ridicolmente grandi */
function drawMarcelloOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(4);
  cx.fillStyle='#0a1a0a'; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,4); cx.fill();
  [[-0.14,-0.18,0.12,0.08],[0.05,-0.18,0.12,0.08],[-0.14,0.0,0.12,0.08],[0.05,0.0,0.12,0.08]].forEach(function(s,i){
    cx.fillStyle='#001a00'; cx.fillRect(bcx+w*s[0],bcy+h*s[1],w*s[2],h*s[3]);
    cx.fillStyle='rgba(0,'+(150+Math.floor(80*Math.sin(bgT*3+i)))+',0,0.8)';
    cx.font=Math.floor(w*0.06)+'px monospace'; cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText(i%2===0?'01':'10',bcx+w*(s[0]+s[2]*0.5),bcy+h*(s[1]+s[3]*0.5));
  });
  cx.strokeStyle='#00ff6a'; cx.lineWidth=2; cx.shadowBlur=8; cx.shadowColor='#00ff6a';
  cx.beginPath(); cx.moveTo(bcx-w*0.1,bcy-h*0.28); cx.lineTo(bcx-w*0.2,bcy-h*0.65); cx.stroke();
  cx.beginPath(); cx.moveTo(bcx+w*0.1,bcy-h*0.28); cx.lineTo(bcx+w*0.25,bcy-h*0.58); cx.stroke();
  cx.fillStyle='rgba(0,255,106,'+(0.5+0.5*p)+')';
  cx.beginPath(); cx.arc(bcx-w*0.2,bcy-h*0.65,4,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(bcx+w*0.25,bcy-h*0.58,3,0,Math.PI*2); cx.fill();
  cx.shadowBlur=0; cx.restore();
}

/* TAJI — Tuta ninja con sciarpa dinamica e kunai decorativi */
function drawTajiOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(5);
  cx.fillStyle='#0a0a0a'; cx.beginPath(); cx.roundRect(bcx-w*0.22,bcy-h*0.28,w*0.44,h*0.56,3); cx.fill();
  cx.strokeStyle='rgba(255,20,147,'+(0.5+0.4*p)+')'; cx.lineWidth=1.5; cx.shadowBlur=10; cx.shadowColor='#ff1493';
  [[-0.2,-0.2,0.2,-0.2],[-0.2,0.1,0.2,0.1]].forEach(function(l){cx.beginPath(); cx.moveTo(bcx+w*l[0],bcy+h*l[1]); cx.lineTo(bcx+w*l[2],bcy+h*l[3]); cx.stroke();});
  cx.shadowBlur=0; cx.fillStyle='#1a1a1a'; cx.globalAlpha=0.8;
  const sw=Math.sin(bgT*3)*0.1;
  cx.beginPath(); cx.moveTo(bcx-w*0.2,bcy-h*0.25); cx.quadraticCurveTo(bcx-w*0.4,bcy-h*0.1+h*sw,bcx-w*0.55,bcy+h*0.1); cx.lineTo(bcx-w*0.48,bcy+h*0.12); cx.quadraticCurveTo(bcx-w*0.32,bcy-h*0.08+h*sw,bcx-w*0.14,bcy-h*0.22); cx.closePath(); cx.fill();
  cx.globalAlpha=1; cx.fillStyle='#888'; cx.strokeStyle='#aaa'; cx.lineWidth=1;
  [[-0.3,0.05],[0.3,0.05]].forEach(function(pos){
    cx.save(); cx.translate(bcx+w*pos[0],bcy+h*pos[1]); cx.rotate(Math.PI/4);
    cx.beginPath(); cx.moveTo(0,-h*0.08); cx.lineTo(w*0.04,h*0.04); cx.lineTo(0,h*0.06); cx.lineTo(-w*0.04,h*0.04); cx.closePath(); cx.fill(); cx.stroke(); cx.restore();
  });
  cx.restore();
}

/* GIBO — Armatura da generale troppo grande, pennacchio enorme */
function drawGiboOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(1.5);
  const g=cx.createLinearGradient(bcx-w*0.28,bcy-h*0.28,bcx+w*0.28,bcy+h*0.28);
  g.addColorStop(0,'#6a5a30'); g.addColorStop(0.5,'#4a3a18'); g.addColorStop(1,'#2a2008');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.28,bcy-h*0.28,w*0.56,h*0.56,4); cx.fill();
  ['#ffd700','#c0c0c0','#cd7f32','#ffd700','#c0c0c0'].forEach(function(col,i){
    const mx=bcx-w*0.18+(i%3)*w*0.18, my=bcy-h*0.15+Math.floor(i/3)*h*0.12;
    cx.fillStyle=col; cx.shadowBlur=4; cx.shadowColor=col; cx.beginPath(); cx.arc(mx,my,4,0,Math.PI*2); cx.fill(); cx.shadowBlur=0;
  });
  cx.fillStyle='#5a4a20'; cx.beginPath(); cx.ellipse(bcx,bcy-h*0.32,w*0.22,h*0.12,0,0,Math.PI*2); cx.fill();
  cx.fillStyle='rgba(220,50,50,'+(0.7+0.3*p)+')';
  cx.beginPath(); cx.moveTo(bcx-w*0.08,bcy-h*0.35); cx.quadraticCurveTo(bcx-w*0.15,bcy-h*0.75,bcx,bcy-h*0.65); cx.quadraticCurveTo(bcx+w*0.15,bcy-h*0.75,bcx+w*0.08,bcy-h*0.35); cx.closePath(); cx.fill();
  cx.fillStyle='#c09040';
  cx.beginPath(); cx.ellipse(bcx-w*0.38,bcy-h*0.2,w*0.18,h*0.13,-0.3,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy-h*0.2,w*0.18,h*0.13,0.3,0,Math.PI*2); cx.fill();
  cx.restore();
}

/* BOLLY — Costume gonfiabile con patch di rattoppi */
function drawBollyOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h, gs=pp.gigantScale||1; cx.save(); const p=outfitPulse(2);
  const bounce=Math.sin(bgT*4)*0.05;
  const g=cx.createRadialGradient(bcx-w*0.1,bcy-h*0.1,0,bcx,bcy,w*0.5*gs);
  g.addColorStop(0,'#ff80b0'); g.addColorStop(0.5,'#ff1493'); g.addColorStop(1,'#8b0050');
  cx.fillStyle=g; cx.globalAlpha=0.7;
  cx.beginPath(); cx.ellipse(bcx,bcy+h*bounce,w*(0.38+0.05*p)*gs,h*(0.48+0.03*p)*gs,0,0,Math.PI*2); cx.fill(); cx.globalAlpha=1;
  [[-0.15,-0.1,'#ff69b4'],[0.1,0.05,'#ffb6c1'],[-0.05,0.15,'#ff1493']].forEach(function(pt){
    cx.fillStyle=pt[2]; cx.globalAlpha=0.6; cx.beginPath(); cx.roundRect(bcx+w*pt[0],bcy+h*pt[1],w*0.12,h*0.08,2); cx.fill();
    cx.strokeStyle='#8b0050'; cx.lineWidth=0.8; cx.setLineDash([2,2]); cx.strokeRect(bcx+w*pt[0],bcy+h*pt[1],w*0.12,h*0.08); cx.setLineDash([]); cx.globalAlpha=1;
  });
  cx.fillStyle='#8b0050'; cx.beginPath(); cx.ellipse(bcx,bcy+h*0.35*gs,w*0.06,h*0.04,0,0,Math.PI*2); cx.fill(); cx.restore();
}

/* CAPPELS — Frac con code esagerate, cilindro altissimo, papillon dorato */
function drawCappelsOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2.5);
  cx.fillStyle='#0d0d3a';
  cx.beginPath(); cx.moveTo(bcx-w*0.24,bcy-h*0.28); cx.lineTo(bcx+w*0.24,bcy-h*0.28); cx.lineTo(bcx+w*0.24,bcy+h*0.15); cx.lineTo(bcx+w*0.08,bcy+h*0.35); cx.lineTo(bcx-w*0.08,bcy+h*0.35); cx.lineTo(bcx-w*0.24,bcy+h*0.15); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx-w*0.08,bcy+h*0.35); cx.lineTo(bcx-w*0.22,bcy+h*0.65); cx.lineTo(bcx-w*0.05,bcy+h*0.65); cx.lineTo(bcx+w*0.05,bcy+h*0.35); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.08,bcy+h*0.35); cx.lineTo(bcx+w*0.22,bcy+h*0.65); cx.lineTo(bcx+w*0.05,bcy+h*0.65); cx.lineTo(bcx-w*0.05,bcy+h*0.35); cx.closePath(); cx.fill();
  cx.fillStyle='#f0f0f0'; cx.beginPath(); cx.roundRect(bcx-w*0.1,bcy-h*0.25,w*0.2,h*0.35,2); cx.fill();
  cx.fillStyle='rgba(255,215,0,'+(0.8+0.2*p)+')'; cx.shadowBlur=6; cx.shadowColor='#ffd700';
  cx.beginPath(); cx.moveTo(bcx-w*0.1,bcy-h*0.22); cx.lineTo(bcx,bcy-h*0.18); cx.lineTo(bcx-w*0.1,bcy-h*0.14); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.1,bcy-h*0.22); cx.lineTo(bcx,bcy-h*0.18); cx.lineTo(bcx+w*0.1,bcy-h*0.14); cx.closePath(); cx.fill(); cx.shadowBlur=0;
  cx.fillStyle='#0d0d3a'; cx.beginPath(); cx.roundRect(bcx-w*0.18,bcy-h*0.75,w*0.36,h*0.47,2); cx.fill();
  cx.fillStyle='#1a1a5a'; cx.beginPath(); cx.ellipse(bcx,bcy-h*0.28,w*0.22,h*0.05,0,0,Math.PI*2); cx.fill();
  cx.fillStyle='rgba(255,215,0,'+(0.5+0.5*p)+')'; cx.shadowBlur=10; cx.shadowColor='#ffd700';
  for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2+bgT*2; cx.beginPath(); cx.arc(bcx+Math.cos(a)*w*0.28,bcy-h*0.5+Math.sin(a)*h*0.08,2.5,0,Math.PI*2); cx.fill();}
  cx.shadowBlur=0; cx.restore();
}

/* CERCHIONI — Tuta da pilota con sponsor ridicoli, pneumatici come spallacci */
function drawCerchioniOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(3.5);
  cx.fillStyle='#1a2a2a'; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,4); cx.fill();
  [[-0.2,-0.2,'#ff6347','VROOM'],[0.06,-0.2,'#ffd700','FAST'],[-0.2,0.0,'#00ff88','GAS'],[0.06,0.0,'#ff1493','DRIFT']].forEach(function(s){
    cx.fillStyle=s[2]; cx.globalAlpha=0.85; cx.beginPath(); cx.roundRect(bcx+w*s[0],bcy+h*s[1],w*0.24,h*0.12,2); cx.fill();
    cx.fillStyle='#000'; cx.font='bold '+Math.floor(w*0.07)+'px sans-serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.globalAlpha=1;
    cx.fillText(s[3],bcx+w*(s[0]+0.12),bcy+h*(s[1]+0.06));
  });
  cx.fillStyle='#1a1a1a'; cx.strokeStyle='#555'; cx.lineWidth=2;
  cx.beginPath(); cx.arc(bcx-w*0.38,bcy-h*0.18,w*0.16,0,Math.PI*2); cx.fill(); cx.stroke();
  cx.beginPath(); cx.arc(bcx+w*0.38,bcy-h*0.18,w*0.16,0,Math.PI*2); cx.fill(); cx.stroke();
  cx.strokeStyle='rgba(255,99,71,'+(0.6+0.4*p)+')'; cx.lineWidth=1.5;
  cx.beginPath(); cx.arc(bcx-w*0.38,bcy-h*0.18,w*0.08,0,Math.PI*2); cx.stroke();
  cx.beginPath(); cx.arc(bcx+w*0.38,bcy-h*0.18,w*0.08,0,Math.PI*2); cx.stroke();
  cx.restore();
}

/* JOEY SCHIATTI — Mantello spettrale, ossa incrociate, corona di spine */
function drawJoeySchiattiOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(1.8);
  drawCape(bcx,bcy,w,h,'#0a0a0a',0.85);
  cx.fillStyle='#e8e8e8'; cx.globalAlpha=0.7;
  [[0.1,-0.1,0.2,0.05],[-0.1,0.0,0.2,-0.1]].forEach(function(bone){
    cx.save(); cx.translate(bcx+w*(bone[0]+bone[2])/2,bcy+h*(bone[1]+bone[3])/2);
    cx.rotate(Math.atan2(h*(bone[3]-bone[1]),w*(bone[2]-bone[0])));
    cx.fillRect(-w*0.12,-h*0.02,w*0.24,h*0.04);
    cx.beginPath(); cx.arc(-w*0.12,0,h*0.03,0,Math.PI*2); cx.fill();
    cx.beginPath(); cx.arc(w*0.12,0,h*0.03,0,Math.PI*2); cx.fill(); cx.restore();
  });
  cx.globalAlpha=1; cx.strokeStyle='#888'; cx.lineWidth=1.5; cx.globalAlpha=0.8;
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2; cx.beginPath(); cx.moveTo(bcx+Math.cos(a)*w*0.22,bcy-h*0.32+Math.sin(a)*w*0.22*0.3); cx.lineTo(bcx+Math.cos(a)*w*0.30,bcy-h*0.32+Math.sin(a)*w*0.30*0.3); cx.stroke();}
  cx.globalAlpha=1; cx.fillStyle='rgba(200,200,255,'+(0.04+0.03*p)+')'; cx.shadowBlur=25; cx.shadowColor='rgba(200,200,255,0.3)';
  cx.beginPath(); cx.ellipse(bcx,bcy,w*0.5,h*0.65,0,0,Math.PI*2); cx.fill(); cx.shadowBlur=0; cx.restore();
}

/* COPPA — Armatura dorata con mantello di velluto rosso */
function drawCoppaOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2);
  drawCape(bcx,bcy,w,h,'#8b0000',0.75);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.25,bcx+w*0.25,bcy+h*0.15);
  g.addColorStop(0,'#ffd700'); g.addColorStop(0.3,'#c09000'); g.addColorStop(0.7,'#a07000'); g.addColorStop(1,'#805000');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.26,w*0.48,h*0.38,5); cx.fill();
  cx.strokeStyle='rgba(255,240,100,'+(0.5+0.3*p)+')'; cx.lineWidth=1; cx.shadowBlur=5; cx.shadowColor='#ffd700';
  cx.beginPath(); cx.moveTo(bcx-w*0.18,bcy-h*0.22); cx.lineTo(bcx,bcy-h*0.08); cx.lineTo(bcx+w*0.18,bcy-h*0.22); cx.stroke(); cx.shadowBlur=0;
  const sg=cx.createRadialGradient(bcx-w*0.38,bcy-h*0.2,0,bcx-w*0.38,bcy-h*0.2,w*0.2);
  sg.addColorStop(0,'#ffd700'); sg.addColorStop(1,'#806000'); cx.fillStyle=sg;
  cx.beginPath(); cx.ellipse(bcx-w*0.38,bcy-h*0.2,w*0.2,h*0.14,-0.3,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.ellipse(bcx+w*0.38,bcy-h*0.2,w*0.2,h*0.14,0.3,0,Math.PI*2); cx.fill();
  drawBelt(bcx,bcy,w,h,'#806000','#ffd700');
  cx.globalAlpha=0.08+0.05*p; cx.fillStyle='#ffd700'; cx.shadowBlur=30; cx.shadowColor='#ffd700';
  cx.beginPath(); cx.ellipse(bcx,bcy,w*0.55,h*0.65,0,0,Math.PI*2); cx.fill(); cx.shadowBlur=0; cx.globalAlpha=1; cx.restore();
}

/* DB — Tuta digitale con glitch, schermo rotto, codice binario */
function drawDBOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(6);
  cx.fillStyle='#001a00'; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,3); cx.fill();
  if(Math.random()<0.05){cx.save(); cx.globalAlpha=0.6; cx.fillStyle='#00ff00'; cx.fillRect(bcx-w*0.24+Math.random()*w*0.3,bcy-h*0.1,w*0.2,h*0.05); cx.fillStyle='#ff0000'; cx.fillRect(bcx-w*0.1+Math.random()*w*0.2,bcy+h*0.05,w*0.15,h*0.03); cx.restore();}
  cx.fillStyle='rgba(0,255,106,'+(0.3+0.2*p)+')'; cx.font=Math.floor(w*0.07)+'px monospace'; cx.textAlign='left'; cx.textBaseline='top';
  for(let row=0;row<5;row++){const offset=(bgT*20+row*15)%(h*0.56); cx.fillText('01'.repeat(4),bcx-w*0.22,bcy-h*0.28+offset);}
  cx.fillStyle='#002200'; cx.strokeStyle='#00ff6a'; cx.lineWidth=1.5;
  cx.beginPath(); cx.roundRect(bcx-w*0.16,bcy-h*0.2,w*0.32,h*0.22,2); cx.fill(); cx.stroke();
  cx.strokeStyle='#00ff6a'; cx.lineWidth=1; cx.globalAlpha=0.5;
  cx.beginPath(); cx.moveTo(bcx-w*0.05,bcy-h*0.2); cx.lineTo(bcx+w*0.08,bcy-h*0.05); cx.lineTo(bcx+w*0.02,bcy+h*0.02); cx.stroke(); cx.globalAlpha=1;
  cx.fillStyle='rgba(255,0,0,'+(0.7+0.3*p)+')'; cx.font='bold '+Math.floor(w*0.1)+'px monospace'; cx.textAlign='center'; cx.textBaseline='middle';
  cx.fillText('ERR',bcx,bcy-h*0.09); cx.restore();
}

/* GIULS — Grembiule da chef con macchie, cappello altissimo */
function drawGiulsOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2);
  cx.fillStyle='#ff69b4';
  cx.beginPath(); cx.moveTo(bcx-w*0.22,bcy-h*0.15); cx.lineTo(bcx+w*0.22,bcy-h*0.15); cx.lineTo(bcx+w*0.28,bcy+h*0.35); cx.lineTo(bcx-w*0.28,bcy+h*0.35); cx.closePath(); cx.fill();
  [[-0.1,-0.05,'#fff0e0'],[0.08,0.1,'#8b4513'],[-0.05,0.2,'#fff0e0']].forEach(function(s){
    cx.fillStyle=s[2]; cx.globalAlpha=0.8; cx.beginPath(); cx.ellipse(bcx+w*s[0],bcy+h*s[1],w*0.07,h*0.05,0.4,0,Math.PI*2); cx.fill(); cx.globalAlpha=1;
  });
  cx.fillStyle='#e05090';
  cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy+h*0.1,w*0.14,h*0.16,2); cx.fill();
  cx.beginPath(); cx.roundRect(bcx+w*0.1,bcy+h*0.1,w*0.14,h*0.16,2); cx.fill();
  cx.fillStyle='#ffffff'; cx.strokeStyle='#e0e0e0'; cx.lineWidth=1;
  cx.beginPath(); cx.roundRect(bcx-w*0.18,bcy-h*0.72,w*0.36,h*0.44,4); cx.fill(); cx.stroke();
  cx.fillStyle='#ff69b4'; cx.fillRect(bcx-w*0.18,bcy-h*0.3,w*0.36,h*0.04);
  cx.fillStyle='rgba(255,105,180,'+(0.4+0.3*p)+')'; cx.shadowBlur=6; cx.shadowColor='#ff69b4';
  cx.beginPath(); cx.arc(bcx,bcy-h*0.55,4,0,Math.PI*2); cx.fill(); cx.shadowBlur=0; cx.restore();
}

/* NITRATO — Tuta hazmat, maschera antigas enorme, strisce di avvertimento */
function drawNitratoOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2.5);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.28,bcx+w*0.25,bcy+h*0.28);
  g.addColorStop(0,'#1a3a10'); g.addColorStop(0.5,'#0f2208'); g.addColorStop(1,'#081405');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.26,bcy-h*0.28,w*0.52,h*0.56,6); cx.fill();
  cx.save(); cx.globalAlpha=0.6;
  for(let i=0;i<6;i++){cx.fillStyle=i%2===0?'#ffcc00':'#1a1a1a'; cx.fillRect(bcx-w*0.26+i*w*0.08,bcy+h*0.2,w*0.08,h*0.08);}
  cx.restore();
  cx.fillStyle='#0f2208'; cx.strokeStyle='#76ff03'; cx.lineWidth=2; cx.shadowBlur=8; cx.shadowColor='#76ff03';
  cx.beginPath(); cx.ellipse(bcx,bcy-h*0.32,w*0.22,h*0.16,0,0,Math.PI*2); cx.fill(); cx.stroke(); cx.shadowBlur=0;
  cx.fillStyle='#0a1a05';
  cx.beginPath(); cx.ellipse(bcx-w*0.1,bcy-h*0.28,w*0.06,h*0.06,0,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.ellipse(bcx+w*0.1,bcy-h*0.28,w*0.06,h*0.06,0,0,Math.PI*2); cx.fill();
  cx.fillStyle='rgba(118,255,3,'+(0.15+0.1*p)+')'; cx.beginPath(); cx.ellipse(bcx,bcy-h*0.35,w*0.15,h*0.07,0,0,Math.PI*2); cx.fill();
  cx.globalAlpha=0.06+0.04*p; cx.fillStyle='#76ff03'; cx.shadowBlur=20; cx.shadowColor='#76ff03';
  cx.beginPath(); cx.ellipse(bcx,bcy,w*0.55,h*0.65,0,0,Math.PI*2); cx.fill(); cx.shadowBlur=0; cx.globalAlpha=1; cx.restore();
}

/* OGBI — Armatura con spirali animate, anelli vorticosi */
function drawOgbiOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(3), spin=bgT*2;
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.28,bcx+w*0.25,bcy+h*0.28);
  g.addColorStop(0,'#006064'); g.addColorStop(0.5,'#003a3e'); g.addColorStop(1,'#001e20');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,5); cx.fill();
  cx.strokeStyle='rgba(0,206,209,'+(0.5+0.3*p)+')'; cx.lineWidth=2; cx.shadowBlur=10; cx.shadowColor='#00ced1';
  for(let s=0;s<2;s++){
    cx.beginPath();
    for(let a=0;a<Math.PI*4;a+=0.1){const r=(a/(Math.PI*4))*w*0.2; const x=bcx+(s===0?-w*0.1:w*0.1)+Math.cos(a+spin)*r; const y=bcy+Math.sin(a+spin)*r*0.6; if(a===0)cx.moveTo(x,y);else cx.lineTo(x,y);}
    cx.stroke();
  }
  cx.shadowBlur=0; cx.strokeStyle='rgba(64,224,208,'+(0.3+0.2*p)+')'; cx.lineWidth=1.5;
  for(let r=1;r<=3;r++){cx.beginPath(); cx.ellipse(bcx,bcy,w*0.12*r,h*0.08*r,spin*0.5,0,Math.PI*2); cx.stroke();}
  cx.restore();
}

/* PINGUS — Corazza di ghiaccio, mantello bianco/nero, pattini esagerati */
function drawPingusOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(1.5);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.28,bcx+w*0.25,bcy+h*0.28);
  g.addColorStop(0,'#c8e8ff'); g.addColorStop(0.4,'#88c8f0'); g.addColorStop(1,'#4888c0');
  cx.fillStyle=g; cx.globalAlpha=0.7; cx.beginPath(); cx.roundRect(bcx-w*0.24,bcy-h*0.28,w*0.48,h*0.56,4); cx.fill(); cx.globalAlpha=1;
  cx.strokeStyle='rgba(200,240,255,'+(0.6+0.4*p)+')'; cx.lineWidth=1.5; cx.shadowBlur=8; cx.shadowColor='#c8e8ff';
  [[-0.15,-0.15],[0.12,-0.1],[-0.08,0.1],[0.18,0.12]].forEach(function(pt){
    const cx2=bcx+w*pt[0], cy2=bcy+h*pt[1];
    for(let a=0;a<6;a++){const angle=(a/6)*Math.PI*2; cx.beginPath(); cx.moveTo(cx2,cy2); cx.lineTo(cx2+Math.cos(angle)*w*0.06,cy2+Math.sin(angle)*h*0.06); cx.stroke();}
  });
  cx.shadowBlur=0; cx.fillStyle='#000'; cx.globalAlpha=0.8;
  cx.beginPath(); cx.moveTo(bcx-w*0.24,bcy-h*0.28); cx.lineTo(bcx-w*0.1,bcy-h*0.28); cx.lineTo(bcx-w*0.1,bcy+h*0.28); cx.lineTo(bcx-w*0.24,bcy+h*0.28); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(bcx+w*0.24,bcy-h*0.28); cx.lineTo(bcx+w*0.1,bcy-h*0.28); cx.lineTo(bcx+w*0.1,bcy+h*0.28); cx.lineTo(bcx+w*0.24,bcy+h*0.28); cx.closePath(); cx.fill();
  cx.globalAlpha=1; cx.fillStyle='#c8e8ff'; cx.strokeStyle='#4888c0'; cx.lineWidth=1.5;
  cx.beginPath(); cx.roundRect(bcx-w*0.22,bcy+h*0.28,w*0.18,h*0.06,2); cx.fill(); cx.stroke();
  cx.beginPath(); cx.roundRect(bcx+w*0.04,bcy+h*0.28,w*0.18,h*0.06,2); cx.fill(); cx.stroke(); cx.restore();
}

/* TAFF — Abito di luce pura, aureola, raggi di luce */
function drawTaffOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(2.5);
  const g=cx.createRadialGradient(bcx,bcy-h*0.1,0,bcx,bcy,w*0.5);
  g.addColorStop(0,'rgba(255,240,100,'+(0.5+0.3*p)+')'); g.addColorStop(0.5,'rgba(255,200,50,'+(0.3+0.2*p)+')'); g.addColorStop(1,'rgba(255,160,0,0)');
  cx.fillStyle=g; cx.beginPath(); cx.ellipse(bcx,bcy,w*0.45,h*0.55,0,0,Math.PI*2); cx.fill();
  cx.fillStyle='rgba(255,215,0,'+(0.4+0.2*p)+')';
  cx.beginPath(); cx.moveTo(bcx-w*0.2,bcy-h*0.25); cx.quadraticCurveTo(bcx-w*0.35,bcy+h*0.1,bcx-w*0.3,bcy+h*0.4); cx.lineTo(bcx+w*0.3,bcy+h*0.4); cx.quadraticCurveTo(bcx+w*0.35,bcy+h*0.1,bcx+w*0.2,bcy-h*0.25); cx.closePath(); cx.fill();
  cx.strokeStyle='rgba(255,240,100,'+(0.7+0.3*p)+')'; cx.lineWidth=3; cx.shadowBlur=20; cx.shadowColor='#ffd700';
  cx.beginPath(); cx.ellipse(bcx,bcy-h*0.42,w*0.22,h*0.06,0,0,Math.PI*2); cx.stroke(); cx.shadowBlur=0;
  cx.strokeStyle='rgba(255,240,100,'+(0.3+0.2*p)+')'; cx.lineWidth=1;
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2+bgT*0.5; cx.beginPath(); cx.moveTo(bcx+Math.cos(a)*w*0.3,bcy+Math.sin(a)*h*0.35); cx.lineTo(bcx+Math.cos(a)*w*0.55,bcy+Math.sin(a)*h*0.6); cx.stroke();}
  cx.restore();
}

/* CHIVEZ — Armatura infuocata con peperoncini decorativi, fiamme dalle spalle */
function drawChivezOutfit(pp, ch, bcx, bcy) {
  const w=pp.w, h=pp.h; cx.save(); const p=outfitPulse(4), fp=outfitPulse(6);
  const g=cx.createLinearGradient(bcx-w*0.25,bcy-h*0.28,bcx+w*0.25,bcy+h*0.28);
  g.addColorStop(0,'#8b0000'); g.addColorStop(0.4,'#5a0000'); g.addColorStop(1,'#2a0000');
  cx.fillStyle=g; cx.beginPath(); cx.roundRect(bcx-w*0.25,bcy-h*0.28,w*0.5,h*0.56,4); cx.fill();
  cx.strokeStyle='rgba(255,'+Math.floor(100+100*fp)+',0,0.8)'; cx.lineWidth=2; cx.shadowBlur=12; cx.shadowColor='#ff4400';
  [[[-0.18,-0.2],[0.0,-0.05],[0.12,0.1]],[[0.15,-0.22],[-0.05,0.0]]].forEach(function(cr){
    cx.beginPath(); cr.forEach(function(pt,i){if(i===0)cx.moveTo(bcx+w*pt[0],bcy+h*pt[1]);else cx.lineTo(bcx+w*pt[0],bcy+h*pt[1]);}); cx.stroke();
  });
  cx.shadowBlur=0;
  for(let side=-1;side<=1;side+=2){
    cx.fillStyle='rgba(255,'+Math.floor(80+80*fp)+',0,'+(0.6+0.3*p)+')'; cx.shadowBlur=15; cx.shadowColor='#ff4400';
    cx.beginPath(); cx.moveTo(bcx+side*w*0.25,bcy-h*0.25); cx.quadraticCurveTo(bcx+side*w*0.38,bcy-h*0.45,bcx+side*w*0.3,bcy-h*0.55); cx.quadraticCurveTo(bcx+side*w*0.22,bcy-h*0.4,bcx+side*w*0.18,bcy-h*0.25); cx.closePath(); cx.fill(); cx.shadowBlur=0;
  }
  cx.fillStyle='#ff0000'; cx.strokeStyle='#8b0000'; cx.lineWidth=1;
  [[-0.15,-0.08],[0.12,-0.05]].forEach(function(pos){
    cx.save(); cx.translate(bcx+w*pos[0],bcy+h*pos[1]); cx.rotate(0.3);
    cx.beginPath(); cx.ellipse(0,0,w*0.04,h*0.08,0,0,Math.PI*2); cx.fill(); cx.stroke();
    cx.strokeStyle='#228b22'; cx.lineWidth=1.5; cx.beginPath(); cx.moveTo(0,-h*0.08); cx.lineTo(0,-h*0.12); cx.stroke(); cx.restore();
  });
  cx.globalAlpha=0.06+0.05*fp; cx.fillStyle='#ff4400'; cx.shadowBlur=25; cx.shadowColor='#ff4400';
  cx.beginPath(); cx.ellipse(bcx,bcy,w*0.55,h*0.65,0,0,Math.PI*2); cx.fill(); cx.shadowBlur=0; cx.globalAlpha=1; cx.restore();
}

console.log('[CHARACTER-RESTYLING v3.0] 21 outfit unici caricati');
