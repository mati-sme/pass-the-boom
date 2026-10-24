/** Invisible floating joystick (touch/drag anywhere on canvas). */
'use strict';

const JOY_DEAD = 12;
const JOY_MAX = 56;

let joy = null;
let keys = Object.create(null);
let target = null;

export function bindInput(el) {
  target = el;
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp);
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
}

function onDown(e) {
  if (joy) return;
  e.preventDefault();
  try { target.setPointerCapture(e.pointerId); } catch (_) {}
  joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false };
}

function onMove(e) {
  if (!joy || e.pointerId !== joy.id) return;
  joy.x = e.clientX; joy.y = e.clientY;
  if (!joy.active && Math.hypot(joy.x - joy.x0, joy.y - joy.y0) > JOY_DEAD) {
    joy.active = true;
    showJoy();
  }
  if (joy.active) showJoy();
}

function onUp(e) {
  if (!joy || (e && e.pointerId !== joy.id)) return;
  joy = null;
  const j = document.getElementById('joy');
  if (j) j.classList.add('hidden');
}

function showJoy() {
  const el = document.getElementById('joy');
  if (!el || !joy) return;
  const ar = target.getBoundingClientRect();
  el.classList.remove('hidden');
  el.style.left = (joy.x0 - ar.left) + 'px';
  el.style.top = (joy.y0 - ar.top) + 'px';
  let dx = joy.x - joy.x0, dy = joy.y - joy.y0;
  const d = Math.hypot(dx, dy);
  if (d > JOY_MAX) { dx = dx / d * JOY_MAX; dy = dy / d * JOY_MAX; }
  const knob = el.querySelector('.knob');
  if (knob) { knob.style.left = dx + 'px'; knob.style.top = dy + 'px'; }
}

export function getMove() {
  let dx = 0, dy = 0;
  if (joy && joy.active) {
    dx = joy.x - joy.x0;
    dy = joy.y - joy.y0;
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; } else { dx = dy = 0; }
  } else {
    if (keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (keys.ArrowRight || keys.KeyD) dx += 1;
    if (keys.ArrowUp || keys.KeyW) dy -= 1;
    if (keys.ArrowDown || keys.KeyS) dy += 1;
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
  }
  return { dx, dy };
}

export function resetInput() {
  joy = null;
  keys = Object.create(null);
  const j = document.getElementById('joy');
  if (j) j.classList.add('hidden');
}
