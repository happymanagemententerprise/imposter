const socket = io();
const $ = id => document.getElementById(id);
const statusBox = $('status');
let me = { roomCode: sessionStorage.getItem('roomCode'), playerId: sessionStorage.getItem('playerId'), name: sessionStorage.getItem('playerName') || '' };
let state = null, role = null, roleOpensAt = 0, selectedVote = null, voted = false, clueSubmitted = false, timerTick = null;
$('name').value = me.name;
const invitedRoom = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
if (invitedRoom && /^[A-Z2-9]{4}$/.test(invitedRoom)) {
  $('room-input').value = invitedRoom;
  $('create-btn').classList.add('hidden');
  document.querySelector('.divider').classList.add('hidden');
  $('join-btn').textContent = 'Join this room';
  $('join-btn').classList.add('join-invite');
  $('name').focus();
}

function showStatus(message, kind = 'info') { statusBox.textContent = message; statusBox.className = `status show ${kind}`; }
function clearStatus() { statusBox.className = 'status'; statusBox.textContent = ''; }
function showView(id) { for (const name of ['join-view','lobby-view','game-view','ended-view']) $(name).classList.toggle('hidden', name !== id); }
function payload(extra = {}) { return { roomCode: me.roomCode, playerId: me.playerId, ...extra }; }
function join(name, roomCode = '') {
  clearStatus(); name = name.trim().replace(/\s+/g,' '); if (!name || name.length > 20) return showStatus('Choose a name between 1 and 20 characters.','error');
  me.name = name; me.playerId ||= crypto.randomUUID(); sessionStorage.setItem('playerName', name); sessionStorage.setItem('playerId',me.playerId); socket.emit('join-lobby', { name, roomCode, playerId: me.playerId });
}
$('create-btn').onclick = () => join($('name').value);
$('join-btn').onclick = () => join($('name').value, $('room-input').value.toUpperCase());
$('room-input').addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4));
$('start-btn').onclick = () => socket.emit('start-game', payload());
$('copy-btn').onclick = async () => { try { await navigator.clipboard.writeText(me.roomCode); $('copy-btn').textContent = 'Copied!'; setTimeout(() => $('copy-btn').textContent = 'Copy code',1400); } catch { showStatus(`Room code: ${me.roomCode}`,'info'); } };
$('mode-picker').querySelectorAll('[data-mode]').forEach(button => button.onclick = () => socket.emit('set-game-mode',payload({mode:button.dataset.mode})));

socket.on('connect', () => { if (me.roomCode && me.playerId && me.name) socket.emit('join-lobby', { ...me }); });
socket.on('disconnect', () => showStatus('Connection lost. Reconnecting…','info'));
socket.on('connect_error', () => showStatus('Could not connect to the game server. Retrying…','error'));
socket.on('game-error', ({ message }) => showStatus(message,'error'));
socket.on('lobby-joined', ({ roomCode, playerId }) => { me.roomCode = roomCode; me.playerId = playerId; sessionStorage.setItem('roomCode',roomCode); sessionStorage.setItem('playerId',playerId); $('room-code').textContent = roomCode; showView('lobby-view'); clearStatus(); });
socket.on('state-update', next => { state = next; $('phase-pill').classList.remove('hidden'); $('phase-text').textContent = ({clue:'Clue round',display:'Discuss',vote:'Voting',ended:'Final reveal'})[next.phase] || next.phase; if (next.phase === 'lobby') renderLobby(); else if (next.phase === 'ended') renderEnded(next); else renderGame(next); });
socket.on('role-assigned', info => { role = info; roleOpensAt = info.opensAt; clueSubmitted = Boolean(info.clueSubmitted); selectedVote = null; voted = false; renderRole(); });
socket.on('clue-accepted', () => { clueSubmitted = true; showStatus('Clue locked in. Keep it secret!','success'); renderRole(); });
socket.on('vote-accepted', () => { voted = true; showStatus('Vote recorded.','success'); renderGame(state); });
socket.on('vote-result', result => { const description = result.tie ? 'The vote was tied. Nobody was eliminated.' : result.eliminated ? `${result.eliminated} was voted out.` : 'No one was eliminated.'; showStatus(`${description}${result.caught ? ' The impostor was caught!' : ''}`,'info'); });
socket.on('room-closed', ({ message }) => { sessionStorage.clear(); me = {}; state = null; role = null; showView('join-view'); showStatus(message,'info'); });

function renderLobby() {
  showView('lobby-view'); const players = state.players;
  $('player-count').textContent = `${state.connectedCount} / 3 minimum`;
  $('players').innerHTML = players.map((p,index) => `<div class="player ${p.connected?'':'disconnected'}"><span class="player-avatar avatar-${index%5}">${escapeHtml(p.name.slice(0,1).toUpperCase())}</span><span class="player-detail"><span class="player-name">${escapeHtml(p.name)}${p.id === state.hostId ? ' <span class="host-tag">HOST</span>':''}${p.id===me.playerId?' <span class="you-tag">YOU</span>':''}</span><span class="player-meta">${p.connected?'Ready to play':'Reconnecting…'}</span></span><i class="connection-dot ${p.connected?'online':''}"></i></div>`).join('');
  const host = state.hostId === me.playerId;
  $('mode-picker').classList.toggle('hidden',!host); $('mode-summary').classList.toggle('hidden',host);
  $('mode-summary').innerHTML = `<span class="mode-summary-icon">${state.gameMode==='continuous'?'∞':'↻'}</span><span><strong>${state.gameMode==='continuous'?'Continuous Mode':'Round Mode'}</strong><small>${state.gameMode==='continuous'?'The impostor stays the same each round.':'A new impostor is selected each round.'}</small></span>`;
  $('mode-picker').querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===state.gameMode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('start-btn').classList.toggle('hidden',!host); $('start-btn').disabled = state.connectedCount < 3;
  $('start-hint').textContent = host ? (state.connectedCount < 3 ? `Waiting for ${3-state.connectedCount} more ${3-state.connectedCount===1?'player':'players'}…` : 'Everyone’s here. Deal the first word.') : 'The host is setting up the room…';
  $('tv-link').href=`/tv?room=${encodeURIComponent(state.roomCode)}`;
}
function renderRole() {
  if (!role) return;
  const openIn = Math.ceil((roleOpensAt - Date.now()) / 1000);
  const waiting = openIn > 0;
  $('role-card').innerHTML = role.role === 'impostor'
    ? `<div class="role-icon">🕵️</div><div class="eyebrow">Your secret role</div><div class="secret" style="color:var(--gold)">You’re the<br>Impostor</div><p class="muted">You don’t know the secret word. Blend in with a convincing clue.</p>${waiting?`<div class="timer">Clues open in <strong>${openIn}</strong></div>`:''}`
    : `<div class="role-icon">🤫</div><div class="eyebrow">Your secret word</div><div class="secret">${escapeHtml(role.word || '…')}</div><p class="muted">Keep this word secret. Give one related clue when the round opens.</p>${waiting?`<div class="timer">Clues open in <strong>${openIn}</strong></div>`:''}`;
  const panel = $('game-panel'); panel.classList.toggle('hidden', waiting || clueSubmitted || state?.phase !== 'clue' || !role); panel.innerHTML = waiting || clueSubmitted ? '' : `<div><div class="eyebrow">Round ${state.round} · clue</div><h2 class="section-title">One word. Don’t make it obvious.</h2><div class="timer">Time left <strong id="clue-countdown">—</strong></div></div><form id="clue-form" class="stack"><input id="clue-input" maxlength="24" placeholder="Your clue…" autocomplete="off" required><button class="full">Lock in clue</button></form>`;
  if (!waiting && !clueSubmitted && state?.phase === 'clue') {
    $('clue-form').onsubmit = e => { e.preventDefault(); socket.emit('submit-word',payload({ word: $('clue-input').value })); };
    startCountdown('clue-countdown', state.clueDeadline);
  }
  if (waiting) startCountdown(null, roleOpensAt);
  else if (timerTick) { clearInterval(timerTick); timerTick = null; }
}
function renderGame(next) {
  if (next.phase === 'clue') { showView('game-view'); if (role) renderRole(); else $('role-card').innerHTML = '<p class="muted">Round starting. Check your secret role…</p>'; return; }
  if (next.phase === 'vote') {
    showView('game-view'); role = null; $('role-card').innerHTML = `<div class="eyebrow">Round ${next.round}</div><h2 class="title" style="font-size:32px">Who’s the impostor?</h2><p class="muted">Choose one living player. Your vote is final.</p>`;
    const targets = next.players.filter(p => p.alive && p.id !== me.playerId);
    $('game-panel').classList.remove('hidden'); $('game-panel').innerHTML = `<div class="choice-list">${targets.map(p=>`<button class="vote-option ${selectedVote===p.id?'selected':''}" data-id="${escapeAttr(p.id)}" ${voted?'disabled':''}><span>${escapeHtml(p.name)}</span><span>${selectedVote===p.id?'✓':''}</span></button>`).join('')}</div><button id="cast-vote" class="full" ${!selectedVote||voted?'disabled':''}>${voted?'Vote submitted':'Confirm vote'}</button>`;
    $('game-panel').querySelectorAll('.vote-option').forEach(b=>b.onclick=()=>{selectedVote=b.dataset.id;renderGame(state);});
    if (!voted) $('cast-vote').onclick=()=>socket.emit('submit-vote',payload({targetPlayerId:selectedVote}));
  } else if (next.phase === 'display') {
    showView('game-view'); role = null; $('role-card').innerHTML = `<div class="eyebrow">Round ${next.round} · clues revealed</div><h2 class="title" style="font-size:32px">What do you think?</h2><p class="muted">Talk it out together, then vote on the TV.</p>`;
    const host = state.hostId===me.playerId;
    const action = host ? (next.voteResolved ? '<button id="next-round" class="full">Start next clue round</button>' : '<button id="open-vote" class="full">Open voting</button>') : '';
    const voteInfo = next.voteResolved ? `<p class="muted small">${Object.entries(next.voteCounts).map(([id,count])=>`${escapeHtml(next.players.find(p=>p.id===id)?.name||'Player')}: ${count}`).join(' · ')||'No votes were cast'}</p>` : '';
    $('game-panel').classList.remove('hidden'); $('game-panel').innerHTML = `<div>${next.clues.map(c=>`<div class="clue-item"><span class="player-name">${escapeHtml(c.playerName)}</span><span class="clue-word">${escapeHtml(c.word)}</span></div>`).join('')}</div>${voteInfo}${action}`;
    if (host && !next.voteResolved) $('open-vote').onclick=()=>socket.emit('begin-vote',payload());
    if (host && next.voteResolved) $('next-round').onclick=()=>socket.emit('next-round',payload());
  }
}
function renderEnded(next) {
  showView('ended-view'); $('ended-view').innerHTML = `<div class="card winner"><div class="winner-icon">${next.winner==='players'?'✦':'◉'}</div><div class="eyebrow">${next.gameMode==='continuous'?'Continuous Mode':'Round Mode'} · ${next.round} ${next.round===1?'round':'rounds'}</div><h2>${next.winner==='players'?'The group got them.':'The impostor wins.'}</h2><p class="muted">The impostor was <strong>${escapeHtml(next.impostorName || 'unknown')}</strong>.</p><div class="final-word"><span class="small muted">THE SECRET WORD</span><strong>${escapeHtml(next.secretWord||'—')}</strong></div><p class="muted small">Room ${escapeHtml(next.roomCode)}</p></div>`;
}
function startCountdown(id, deadline) {
  if (timerTick) clearInterval(timerTick);
  const update=()=>{const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(id&&$(id))$(id).textContent=`${remaining}s`;if(!id&&remaining===0){clearInterval(timerTick);timerTick=null;renderRole();}else if(id==='clue-countdown'&&remaining===0){clearInterval(timerTick);timerTick=null;}};
  update(); timerTick=setInterval(update,250);
}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(value=''){return escapeHtml(value);}
