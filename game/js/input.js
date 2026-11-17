// Keyboard and mouse. Held keys and the held mouse button give the jellyfish its steering and
// its trigger; one-shot presses (start, pause, dash, mute, a card pick) queue as bit flags and
// are taken once by the loop, so a press between frames is never lost and never counted twice.
// The pointer's position is reported in the playfield's own 1280x720 coordinates, whatever the
// window's size, so aiming never depends on the screen.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = { left: false, right: false, up: false, down: false, fire: false };
  let actions = 0;
  const aim = { x: FIELD.width / 2, y: FIELD.height / 2 - 120 };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    aim.x = Math.min(FIELD.width, Math.max(0, ((clientX - rect.left) / rect.width) * FIELD.width));
    aim.y = Math.min(FIELD.height, Math.max(0, ((clientY - rect.top) / rect.height) * FIELD.height));
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_PICK_1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_PICK_2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_PICK_3;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
    held.fire = false;
  });

  canvas.addEventListener('pointermove', (event) => toField(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', (event) => {
    toField(event.clientX, event.clientY);
    if (event.button === 0) held.fire = true;
    if (event.button === 2) actions |= ACTION_DASH;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) held.fire = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The steering axes, each -1, 0 or 1. */
    moveX() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    moveY() {
      return (held.down ? 1 : 0) - (held.up ? 1 : 0);
    },
    /** The pointer in playfield coordinates. */
    aim() {
      return aim;
    },
    /** Whether the trigger is held down. */
    firing() {
      return held.fire;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
