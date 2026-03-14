/**
 * multiplayer-fixes.js — Correzioni per sincronizzazione multiplayer
 * 
 * Questo file contiene le correzioni e miglioramenti per:
 * - Sincronizzazione dello stato del gioco tra client e server
 * - Gestione robusta degli errori di rete
 * - Prevenzione di desincronizzazione durante il gameplay
 * - Recovery automatico da disconnessioni
 * 
 * AGGIORNAMENTO v2.0
 */

/**
 * Invia lo stato del giocatore locale al server per la sincronizzazione.
 * Viene chiamata ogni frame durante il gameplay per mantenere i giocatori sincronizzati.
 */
function sendPlayerMove() {
  if (!socket || !socket.connected || !isMultiplayer || !started) return;
  
  const pp = p[localPlayerIndex];
  if (!pp) return;
  
  try {
    socket.emit('playerMove', {
      x: Math.round(pp.x),
      y: Math.round(pp.y),
      vx: Math.round(pp.vx * 10) / 10,
      vy: Math.round(pp.vy * 10) / 10,
      facing: pp.facing,
      onGround: pp.onGround,
      crouching: pp.crouching,
      atkT: Math.round(pp.atkT * 100) / 100,
      atkAnim: pp.atkAnim,
      damage: pp.damage,
      stocks: pp.stocks,
      isDead: pp.isDead,
      pCharge: Math.round(pp.pCharge * 100) / 100,
      combo: pp.combo,
      tick: currentTick,
    });
  } catch (e) {
    console.error('[MP] Errore invio playerMove:', e);
  }
}

/**
 * Notifica il server che il giocatore locale ha usato un potere speciale.
 * Garantisce la sincronizzazione dell'abilità tra i due client.
 * @param {number} pi - Indice del giocatore che ha usato il potere
 */
function onPowerUsed(pi) {
  if (!socket || !socket.connected || !isMultiplayer) return;
  
  const pp = p[pi];
  if (!pp || !pp.ch) return;
  
  try {
    socket.emit('powerUsed', {
      playerIndex: pi,
      characterId: pp.cid,
      powerType: pp.ch.powType,
      x: Math.round(pp.x + pp.w / 2),
      y: Math.round(pp.y + pp.h / 2),
      tick: currentTick,
    });
  } catch (e) {
    console.error('[MP] Errore invio powerUsed:', e);
  }
}

/**
 * Notifica il server di un cambio di stato critico del giocatore.
 * Usato per sincronizzare danni, KO e altri eventi importanti.
 * @param {number} pi - Indice del giocatore
 */
function onPlayerStateChanged(pi) {
  if (!socket || !socket.connected || !isMultiplayer) return;
  
  const pp = p[pi];
  if (!pp) return;
  
  try {
    socket.emit('playerStateChanged', {
      playerIndex: pi,
      damage: pp.damage,
      stocks: pp.stocks,
      isDead: pp.isDead,
      pCharge: Math.round(pp.pCharge * 100) / 100,
      tick: currentTick,
    });
  } catch (e) {
    console.error('[MP] Errore invio playerStateChanged:', e);
  }
}

/**
 * Gestisce la ricezione di aggiornamenti di stato dal giocatore remoto.
 * Applica correzioni di posizione e stato per mantenere la sincronizzazione.
 * @param {Object} data - Dati di stato ricevuti dal server
 */
function onRemotePlayerUpdate(data) {
  if (!isMultiplayer || !started) return;
  
  try {
    const pp = p[remotePlayerIndex];
    if (!pp) return;
    
    // Interpolazione della posizione per movimento fluido
    const dx = data.x - pp.x;
    const dy = data.y - pp.y;
    const dist = Math.hypot(dx, dy);
    
    // Se il giocatore remoto è troppo lontano, teleporta istantaneamente
    if (dist > 200) {
      pp.x = data.x;
      pp.y = data.y;
    } else {
      // Altrimenti interpola gradualmente
      pp.x += dx * 0.3;
      pp.y += dy * 0.3;
    }
    
    // Aggiorna velocità e stato
    pp.vx = data.vx;
    pp.vy = data.vy;
    pp.facing = data.facing;
    pp.onGround = data.onGround;
    pp.crouching = data.crouching;
    pp.atkT = data.atkT;
    pp.atkAnim = data.atkAnim;
    pp.damage = data.damage;
    pp.stocks = data.stocks;
    pp.isDead = data.isDead;
    pp.pCharge = data.pCharge;
    pp.combo = data.combo;
    
    // Aggiorna HUD
    updPct(remotePlayerIndex);
    buildLives(remotePlayerIndex);
    updPBar(remotePlayerIndex);
  } catch (e) {
    console.error('[MP] Errore aggiornamento giocatore remoto:', e);
  }
}

/**
 * Gestisce la ricezione di un potere speciale usato dal giocatore remoto.
 * Sincronizza l'effetto visivo e il danno tra i due client.
 * @param {Object} data - Dati del potere ricevuti dal server
 */
function onRemotePowerUsed(data) {
  if (!isMultiplayer || !started) return;
  
  try {
    const pp = p[data.playerIndex];
    if (!pp || !pp.ch) return;
    
    // Verifica che il potere sia dello stesso tipo
    if (pp.ch.powType === data.powerType) {
      // Effetto visivo del potere remoto
      addPfx({ 
        type: 'shockwave', 
        x: data.x, 
        y: data.y, 
        r: 0, 
        maxR: 120, 
        life: 0.5, 
        col: pp.col 
      });
      
      // Feedback audio/visivo
      flashScreen(pp.col, 0.3);
      shake = 0.4;
    }
  } catch (e) {
    console.error('[MP] Errore sincronizzazione potere remoto:', e);
  }
}

/**
 * Verifica la qualità della connessione in base al ping.
 * Aggiorna lo stato della connessione e mostra avvisi se necessario.
 */
function updateConnectionQuality() {
  if (!socket || !socket.connected) {
    connectionQuality = 'disconnected';
    return;
  }
  
  if (currentPing < 50) {
    connectionQuality = 'excellent';
  } else if (currentPing < 100) {
    connectionQuality = 'good';
  } else if (currentPing < 200) {
    connectionQuality = 'fair';
    if (isMultiplayer && started) {
      mpSetStatus('⚠️ Latenza elevata (' + currentPing + 'ms)', 'warn');
    }
  } else {
    connectionQuality = 'poor';
    if (isMultiplayer && started) {
      mpSetStatus('❌ Connessione instabile (' + currentPing + 'ms)', 'error');
    }
  }
}

/**
 * Gestisce il recovery automatico da una disconnessione durante il gioco.
 * Tenta di riconnettersi e riprendere la partita in corso.
 */
function handleDisconnectionRecovery() {
  if (!isMultiplayer || !currentRoomCode) return;
  
  console.log('[MP] Tentativo di recovery dalla disconnessione...');
  mpSetStatus('🔄 Tentativo di riconnessione...', 'info');
  
  // Attendi un momento prima di tentare la riconnessione
  setTimeout(() => {
    if (!socket || !socket.connected) {
      initSocket();
      
      // Una volta connesso, tenta di riprendere la stanza
      setTimeout(() => {
        if (socket && socket.connected) {
          socket.emit('room:resume', {
            code: currentRoomCode,
            token: sessionToken,
            playerId: localPlayerId,
          });
        }
      }, 1000);
    }
  }, 500);
}

/**
 * Sincronizza il timer di gioco tra i due client.
 * Garantisce che entrambi i giocatori vedano lo stesso countdown.
 * @param {number} serverTimer - Tempo rimanente dal server (in secondi)
 */
function syncGameTimer(serverTimer) {
  if (!isMultiplayer || !started) return;
  
  try {
    // Calcola la differenza tra il timer locale e quello del server
    const localTimer = gTimer;
    const diff = Math.abs(localTimer - serverTimer);
    
    // Se la differenza è significativa, sincronizza
    if (diff > 2) {
      gTimer = serverTimer;
      updTimer();
      console.log('[MP] Timer sincronizzato:', gTimer);
    }
  } catch (e) {
    console.error('[MP] Errore sincronizzazione timer:', e);
  }
}

/**
 * Valida l'integrità dei dati ricevuti dal server.
 * Previene crash causati da dati malformati o incompleti.
 * @param {Object} data - Dati da validare
 * @returns {boolean} true se i dati sono validi, false altrimenti
 */
function validateServerData(data) {
  if (!data || typeof data !== 'object') return false;
  
  // Validazione basica
  if (typeof data.x !== 'number' || typeof data.y !== 'number') return false;
  if (typeof data.damage !== 'number' || data.damage < 0) return false;
  if (typeof data.stocks !== 'number' || data.stocks < 0 || data.stocks > 3) return false;
  
  return true;
}

/**
 * Integrazione con il loop principale di gioco.
 * Questa funzione dovrebbe essere chiamata nel main loop di engine.js
 * per mantenere la sincronizzazione multiplayer durante il gameplay.
 */
function updateMultiplayerSync() {
  if (!isMultiplayer || !started) return;
  
  currentTick++;
  
  // Invia aggiornamenti di posizione ogni 2 frame (~33ms)
  if (currentTick % 2 === 0) {
    sendPlayerMove();
  }
  
  // Verifica la qualità della connessione ogni 30 frame (~500ms)
  if (currentTick % 30 === 0) {
    updateConnectionQuality();
  }
  
  // Sincronizza il timer ogni 60 frame (~1s)
  if (currentTick % 60 === 0) {
    // Richiedi sincronizzazione timer dal server
    if (socket && socket.connected) {
      socket.emit('ping', (response) => {
        if (response && response.serverTimer !== undefined) {
          syncGameTimer(response.serverTimer);
        }
      });
    }
  }
}
