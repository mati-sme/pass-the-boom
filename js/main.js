/**
 * Pass the Boom — app bootstrap, lobby, host sim loop, client mirror.
 */
'use strict';

import { NetRoom } from './net.js';
import { createMatch, applyInput, step, serialize, applySnapshot } from './game.js';
import { bindInput, getMove, resetInput } from './input.js';
import { bindCanvas, draw } from './render.js';
import { unlockAudio, SFX } from './audio.js';

const $ = (id) => document.getElementById(id);

const screens = {
  home: $('screen-home'),
  join: $('screen-join'),
  lobby: $('screen-lobby'),
  play: $('screen-play'),
  win: $('screen-win'),
};

let room = null;
let match = null;
let raf = 0;
let lastTs = 0;
let toastTimer = 0;
let lastFuseBucket = -1;
let kidsMode = false;

function show(name) {
  for (const [k, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', k !== name);
  }
}

function overlay(on, txt) {
  $('overlay').classList.toggle('hidden', !on);
  if (txt) $('overlayTxt').textContent = txt;
}

function loadName() {
  try { return localStorage.getItem('ptb.name') || ''; } catch (_) { return ''; }
}
function saveName(n) {
  try { localStorage.setItem('ptb.name', n); } catch (_) {}
}

function playerName() {
  const n = ($('nameInput').value || '').trim() || 'Player';
  saveName(n);
  return n.slice(0, 12);
}

function toast(html, cls, ms) {
  const el = $('toast');
  el.className = cls || '';
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms || 1800);
}

function renderLobby(players, isHost, code) {
  $('lobbyCode').textContent = code || '····';
  const ul = $('playerList');
  ul.innerHTML = '';
  const localId = room && room.localId;
  for (const p of players) {
    const li = document.createElement('li');
    if (p.id === localId) li.classList.add('you');
    li.innerHTML =
      `<span class="dot" style="background:${p.color || '#888'}"></span>` +
      `<span>${escapeHtml(p.name)}${p.id === localId ? ' (you)' : ''}</span>` +
      (p.isHost ? '<span class="host-tag">Host</span>' : '');
    // assign display color from index if missing
    if (!p.color) {
      const colors = ['#5b8cff', '#5dff8a', '#ff6b9d', '#ffd84a', '#b07cff', '#5de0ff', '#ff9a5b', '#e0e0e0'];
      li.querySelector('.dot').style.background = colors[players.indexOf(p) % colors.length];
    }
    ul.appendChild(li);
  }
  $('kidsWrap').classList.toggle('hidden', !isHost);
  $('btnStart').classList.toggle('hidden', !isHost);
  $('btnStart').disabled = players.length < 2;
  $('lobbyStatus').textContent = isHost
    ? (players.length < 2 ? 'Need at least 2 players to start' : 'Ready — hit Start!')
    : 'Waiting for host to start…';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function updateHud() {
  if (!match) return;
  const pct = match.fuseMax > 0 ? Math.max(0, match.fuse / match.fuseMax) : 0;
  $('fuseFill').style.width = (pct * 100) + '%';
  $('fuseFill').classList.toggle('low', pct < 0.28 && match.phase === 'play');
  $('fuseTxt').textContent = match.phase === 'play'
    ? (match.fuse > 0 ? match.fuse.toFixed(1) + 's' : 'BOOM!')
    : '—';
  const me = room && room.localId;
  const iHave = match.boomId === me && match.phase === 'play';
  $('boomBadge').classList.toggle('hidden', !iHave);
  const alive = match.players.filter((p) => p.alive).length;
  $('aliveTxt').textContent = String(alive);

  // tick SFX urgency
  if (match.phase === 'play' && match.boomId) {
    const urgency = 1 - pct;
    const bucket = Math.floor(match.fuse * (urgency > 0.65 ? 4 : 2));
    if (bucket !== lastFuseBucket) {
      lastFuseBucket = bucket;
      SFX.tick(urgency);
    }
  }
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'pass') {
      SFX.pass();
      const me = room && room.localId;
      if (ev.id === me) toast('💣 You got the Boom!<small>Tag someone fast!</small>', 'boom', 2000);
      else toast(`Boom → ${escapeHtml(ev.name)}`, '', 1400);
    } else if (ev.type === 'boom') {
      SFX.boom();
      toast(`💨 ${escapeHtml(ev.name)} exploded!<small>Soft out — nice try</small>`, 'boom', 2200);
    } else if (ev.type === 'win') {
      SFX.win();
      endMatch();
    }
  }
}

function endMatch() {
  stopLoop();
  const w = match && match.players.find((p) => p.id === match.winnerId);
  $('winTitle').textContent = 'Winner!';
  $('winName').textContent = w ? w.name : 'Nobody?';
  show('win');
}

function startMatchFromLobby() {
  if (!room || room.role !== 'host') return;
  kidsMode = $('kidsMode').checked;
  const roster = room.players.map((p) => ({ id: p.id, name: p.name }));
  match = createMatch(roster, kidsMode);
  room.broadcast({ type: 'start', kidsMode, snapshot: serialize(match) });
  enterPlay();
}

function enterPlay() {
  show('play');
  resetInput();
  lastTs = 0;
  lastFuseBucket = -1;
  // force canvas resize after becoming visible
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    startLoop();
    toast(kidsMode ? 'Kids Mode — longer fuse!' : 'Go! Pass the Boom!', '', 1600);
  });
}

function startLoop() {
  stopLoop();
  const tick = (ts) => {
    raf = requestAnimationFrame(tick);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;

    const move = getMove();
    if (room && room.role === 'host' && match && match.phase === 'play') {
      applyInput(match, room.localId, move.dx, move.dy);
      const wasPlay = match.phase === 'play';
      const events = step(match, dt);
      handleEvents(events);
      // broadcast ~20 Hz (and immediately on phase change)
      if (!tick._acc) tick._acc = 0;
      tick._acc += dt;
      const phaseChanged = wasPlay && match.phase !== 'play';
      if (tick._acc >= 0.05 || phaseChanged) {
        tick._acc = 0;
        room.broadcast({ type: 'state', snapshot: serialize(match) });
      }
    } else if (room && room.role === 'client') {
      room.sendToHost({ type: 'input', id: room.localId, dx: move.dx, dy: move.dy });
    }

    draw(match, room && room.localId, ts);
    updateHud();
  };
  raf = requestAnimationFrame(tick);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastTs = 0;
}

function onNetMessage(msg) {
  if (msg.type === 'input' && room.role === 'host' && match) {
    applyInput(match, msg.id, msg.dx || 0, msg.dy || 0);
  } else if (msg.type === 'start' && room.role === 'client') {
    kidsMode = !!msg.kidsMode;
    match = applySnapshot(null, msg.snapshot);
    enterPlay();
  } else if (msg.type === 'state' && room.role === 'client') {
    const prevBoom = match && match.boomId;
    const prevAlive = match && match.players.map((p) => p.alive + ':' + p.id).join(',');
    match = applySnapshot(match, msg.snapshot);
    // infer local events from deltas
    if (prevBoom && match.boomId && prevBoom !== match.boomId) {
      const holder = match.players.find((p) => p.id === match.boomId);
      handleEvents([{ type: 'pass', id: match.boomId, name: holder ? holder.name : '?' }]);
    }
    if (prevAlive) {
      for (const p of match.players) {
        if (!p.alive && prevAlive.includes('true:' + p.id)) {
          handleEvents([{ type: 'boom', id: p.id, name: p.name }]);
        }
      }
    }
    if (match.phase === 'win') endMatch();
  } else if (msg.type === 'again' && room.role === 'client') {
    // host restarted lobby
    match = null;
    stopLoop();
    show('lobby');
  }
}

function wireRoom(r) {
  room = r;
  r.onLobby = (players, isHost, code) => {
    // paint colors onto lobby list via index
    players.forEach((p, i) => {
      const colors = ['#5b8cff', '#5dff8a', '#ff6b9d', '#ffd84a', '#b07cff', '#5de0ff', '#ff9a5b', '#e0e0e0'];
      p.color = colors[i % colors.length];
    });
    renderLobby(players, isHost, code);
    SFX.join();
  };
  r.onMessage = onNetMessage;
  r.onStatus = (s) => { /* optional */ console.log('[net]', s); };
  r.onFatal = (err) => {
    overlay(false);
    alert(err);
    leaveToHome();
  };
}

async function createRoom() {
  unlockAudio(); SFX.click();
  overlay(true, 'Creating room…');
  try {
    const r = new NetRoom();
    wireRoom(r);
    await r.create(playerName());
    overlay(false);
    show('lobby');
  } catch (e) {
    overlay(false);
    alert(e.message || String(e));
    if (room) { room.destroy(); room = null; }
  }
}

async function joinRoom() {
  unlockAudio(); SFX.click();
  const code = ($('codeInput').value || '').trim();
  $('joinErr').hidden = true;
  overlay(true, 'Joining…');
  try {
    const r = new NetRoom();
    wireRoom(r);
    await r.join(code, playerName());
    overlay(false);
    show('lobby');
  } catch (e) {
    overlay(false);
    $('joinErr').hidden = false;
    $('joinErr').textContent = e.message || String(e);
    if (room) { room.destroy(); room = null; }
  }
}

function leaveToHome() {
  stopLoop();
  match = null;
  if (room) { room.destroy(); room = null; }
  resetInput();
  show('home');
}

function playAgain() {
  unlockAudio(); SFX.click();
  if (!room) { leaveToHome(); return; }
  match = null;
  stopLoop();
  if (room.role === 'host') {
    room.broadcast({ type: 'again' });
    show('lobby');
    renderLobby(room.players, true, room.code);
  } else {
    show('lobby');
  }
}

function boot() {
  $('nameInput').value = loadName();
  bindCanvas($('cv'));
  bindInput($('cv'));

  $('btnCreate').onclick = createRoom;
  $('btnJoinShow').onclick = () => { SFX.click(); show('join'); $('codeInput').focus(); };
  $('btnJoinBack').onclick = () => { show('home'); };
  $('btnJoin').onclick = joinRoom;
  $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
  $('btnStart').onclick = () => { unlockAudio(); SFX.click(); startMatchFromLobby(); };
  $('btnLeave').onclick = () => { SFX.click(); leaveToHome(); };
  $('btnAgain').onclick = playAgain;
  $('btnHome').onclick = () => { SFX.click(); leaveToHome(); };
  $('kidsMode').onchange = () => { kidsMode = $('kidsMode').checked; };

  // unlock audio on first gesture
  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  show('home');
}

boot();
