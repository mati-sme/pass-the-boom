/** Canvas renderer for the arena. */
'use strict';

import { MAP_W, MAP_H, PLAYER_R, OBSTACLES } from './game.js';

let cv, ctx, dpr = 1;

export function bindCanvas(el) {
  cv = el;
  ctx = el.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!cv) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || cv.parentElement.clientWidth;
  const h = cv.clientHeight || cv.parentElement.clientHeight;
  cv.width = Math.max(1, Math.floor(w * dpr));
  cv.height = Math.max(1, Math.floor(h * dpr));
}

function worldToScreen(cam) {
  // Fit MAP into canvas letterboxed
  const sw = cv.width / dpr, sh = cv.height / dpr;
  const scale = Math.min(sw / MAP_W, sh / MAP_H);
  const ox = (sw - MAP_W * scale) / 2;
  const oy = (sh - MAP_H * scale) / 2;
  return { scale, ox, oy, sw, sh };
}

export function draw(match, localId, now) {
  if (!ctx || !cv) return;
  const { scale, ox, oy, sw, sh } = worldToScreen();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sw, sh);

  // backdrop
  ctx.fillStyle = '#152838';
  ctx.fillRect(0, 0, sw, sh);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // floor
  ctx.fillStyle = '#1e3a4a';
  roundRect(ctx, 0, 0, MAP_W, MAP_H, 24);
  ctx.fill();

  // soft grid
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 2;
  for (let x = 40; x < MAP_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
  }
  for (let y = 40; y < MAP_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
  }

  // border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  roundRect(ctx, 3, 3, MAP_W - 6, MAP_H - 6, 22);
  ctx.stroke();

  // obstacles
  for (const o of OBSTACLES) {
    ctx.fillStyle = '#0d1c26';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    roundRect(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill(); ctx.stroke();
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 8);
  }

  if (!match) { ctx.restore(); return; }

  // draw out players faintly first
  const sorted = match.players.slice().sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? 1 : -1));
  for (const p of sorted) {
    drawPlayer(ctx, p, match.boomId === p.id, p.id === localId, now);
  }

  ctx.restore();
}

function drawPlayer(ctx, p, hasBoom, isLocal, now) {
  const r = PLAYER_R;
  ctx.save();
  ctx.translate(p.x, p.y);

  if (!p.alive) {
    ctx.globalAlpha = 0.35;
    // soft "poof" ghost
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💨', 0, 0);
    ctx.restore();
    return;
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.85, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();

  // body
  ctx.fillStyle = p.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // face
  ctx.fillStyle = '#1a0a14';
  ctx.beginPath(); ctx.arc(-8, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a0a14';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 6, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

  // local ring
  if (isLocal) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // boom indicator
  if (hasBoom) {
    const pulse = 1 + Math.sin(now * 0.012) * 0.08;
    ctx.save();
    ctx.translate(0, -r - 22);
    ctx.scale(pulse, pulse);
    // bomb body
    ctx.fillStyle = '#ff6b2c';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // fuse
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(8, -28, 4, -34); ctx.stroke();
    // spark
    ctx.fillStyle = '#ff3a3a';
    ctx.beginPath(); ctx.arc(4, -34, 4 + Math.sin(now * 0.03) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // danger aura
    ctx.strokeStyle = 'rgba(255,80,40,.45)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r + 14 + Math.sin(now * 0.02) * 3, 0, Math.PI * 2); ctx.stroke();
  }

  // nameplate
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  const label = p.name || '?';
  ctx.font = 'bold 14px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  roundRect(ctx, -tw / 2 - 8, r + 6, tw + 16, 22, 8);
  ctx.fill();
  ctx.fillStyle = '#fff4e8';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, r + 17);

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
