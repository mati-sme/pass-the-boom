/**
 * Pass the Boom — lobby + client loop. Authority lives on PartyKit.
 */
'use strict';

import { NetRoom } from './net.js';
import { applySnapshot, predictMove } from './game.js';
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
let inputAcc = 0;

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
  const colors = ['#5b8cff', '#5dff8a', '#ff6b9d', '#ffd84a', '#b07cff', '#5de0ff', '#ff9a5b', '#e0e0e0'];
  for (const p of players) {
    const li = document.createElement('li');
    if (p.id === localId) li.classList.add('you');
    li.innerHTML =
      `<span class="dot" style="background:${colors[players.indexOf(p) % colors.length]}"></span>` +
      `<span>${escapeHtml(p.name)}${p.id === localId ? ' (you)' : ''}</span>` +
      (p.isHost ? '<span class="host-tag">Host</span>' : '');
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
  for (const ev of events || []) {
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
  room.send({ type: 'start', kidsMode });
}

function enterPlay() {
  show('play');
  resetInput();
  lastTs = 0;
  lastFuseBucket = -1;
  inputAcc = 0;
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
    if (room && match && match.phase === 'play') {
      // Local prediction for snappy feel
      predictMove(match, room.localId, move.dx, move.dy, dt);
      // Throttle input to server ~20 Hz
      inputAcc += dt;
      if (inputAcc >= 0.05) {
        inputAcc = 0;
        room.send({ type: 'input', dx: move.dx, dy: move.dy });
      }
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
  if (msg.type === 'start') {
    kidsMode = !!msg.kidsMode;
    match = applySnapshot(null, msg.snapshot);
    enterPlay();
  } else if (msg.type === 'state') {
    const prevBoom = match && match.boomId;
    const prevAlive = match && match.players.map((p) => p.alive + ':' + p.id).join(',');
    match = applySnapshot(match, msg.snapshot, room && room.localId, { softLocal: true });
    if (msg.events && msg.events.length) {
      handleEvents(msg.events);
    } else {
      // Infer from deltas if server omitted events
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
    }
    if (match.phase === 'win') endMatch();
  } else if (msg.type === 'again') {
    match = null;
    stopLoop();
    show('lobby');
    if (room) renderLobby(room.players, room.role === 'host', room.code);
  } else if (msg.type === 'error') {
    toast(escapeHtml(msg.message || 'Error'), 'boom', 2200);
  }
}

function wireRoom(r) {
  room = r;
  r.onLobby = (players, isHost, code) => {
    players.forEach((p, i) => {
      const colors = ['#5b8cff', '#5dff8a', '#ff6b9d', '#ffd84a', '#b07cff', '#5de0ff', '#ff9a5b', '#e0e0e0'];
      p.color = colors[i % colors.length];
    });
    renderLobby(players, isHost, code);
    if ($('kidsMode')) $('kidsMode').checked = !!r.kidsMode;
    SFX.join();
  };
  r.onMessage = onNetMessage;
  r.onStatus = (s) => { console.log('[net]', s); };
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
    room.send({ type: 'again' });
  }
  show('lobby');
  renderLobby(room.players, room.role === 'host', room.code);
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
  $('kidsMode').onchange = () => {
    kidsMode = $('kidsMode').checked;
    if (room && room.role === 'host') room.send({ type: 'kids', kidsMode });
  };

  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  show('home');
}

boot();
