// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the painter, the instruments and the screens
// draw what is there. The dive moves between four screens — title, play, paused, over — and the
// world's event flags become sound and spoken announcements here, the only place the simulation
// meets the browser's ears.
//
// ?seed=N fixes the dive. ?shot=start|play|upgrade|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, MAX_FRAME, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BOSS,
  EVENT_DASH,
  EVENT_HEART,
  EVENT_HIT,
  EVENT_HURT,
  EVENT_KILL,
  EVENT_OVER,
  EVENT_PEARL,
  EVENT_VOLLEY,
  EVENT_WARD,
  EVENT_WAVE_CLEAR,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PICK_1,
  ACTION_PICK_2,
  ACTION_PICK_3,
  createInput,
} from './input.js';
import { createRenderer } from './renderer.js';
import { createHud } from './hud.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, cardRect, createScreens } from './screens.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { upgradeById } from './upgrades.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

/** The ctrl the title's calm is stepped with: the world reads its aim before it drifts on its own. */
const IDLE_CTRL = { moveX: 0, moveY: 0, aimX: 640, aimY: 240, firing: false, dash: false };

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const hud = createHud();
const screens = createScreens();
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best dive then lasts this visit only.
  }
}

// --- the dive itself -----------------------------------------------------------

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let frameEvents = 0;
  let pendingDash = false;
  let diveEnded = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each turn.
  function announce(message) {
    status.textContent = message;
  }

  function startDive() {
    audio.unlock();
    world.beginDive();
    accumulator = 0;
    diveEnded = false;
    screen = SCREEN_PLAY;
    announce('Diving. Wave 1. Swim with WASD, aim with the mouse, hold to fire.');
  }

  function endDive() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      world.state.victory
        ? `The dive is won. Score ${world.state.score}. Best ${best}.`
        : `The light goes out. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function pickCard(index) {
    const offers = world.state.offers;
    if (offers === null || index >= offers.length) return;
    const card = upgradeById(offers[index]);
    if (world.chooseUpgrade(offers[index])) {
      audio.upgrade();
      announce(`${card === undefined ? 'A boon' : card.name} taken. The next wave pours in.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startDive();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) return;
    if (actions & ACTION_DASH) pendingDash = true;
    // The boon cards take 1, 2 and 3, or a click anywhere on a card's face.
    if (world.state.phase === 'upgrade' && world.state.offers !== null) {
      if (actions & ACTION_PICK_1) pickCard(0);
      else if (actions & ACTION_PICK_2) pickCard(1);
      else if (actions & ACTION_PICK_3) pickCard(2);
      else if (actions & ACTION_CONFIRM) {
        const aim = input.aim();
        for (let i = 0; i < 3; i += 1) {
          const rect = cardRect(i);
          if (aim.x >= rect.x && aim.x <= rect.x + rect.w && aim.y >= rect.y && aim.y <= rect.y + rect.h) {
            pickCard(i);
            break;
          }
        }
      }
    }
  }

  function playStep() {
    const aim = input.aim();
    const ctrl = {
      moveX: input.moveX(),
      moveY: input.moveY(),
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing(),
      dash: pendingDash,
    };
    pendingDash = false;
    frameEvents |= world.step(STEP, ctrl, false);
  }

  // The world reports what happened as flags; the ears react once a frame, not once a step.
  function playSounds(events) {
    if (events & EVENT_OVER) audio.over();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_WAVE_CLEAR) audio.wave();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_WARD) audio.ward();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_HEART) audio.heart();
    if (events & EVENT_PEARL) audio.pearl();
    if (events & EVENT_KILL) audio.kill(false);
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_VOLLEY) audio.fire();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    frameEvents = 0;

    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, IDLE_CTRL, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        playStep();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    playSounds(frameEvents);
    if (frameEvents & EVENT_OVER) endDive();
    else if (!diveEnded && world.state.phase === 'done' && world.state.victory) {
      diveEnded = true;
      audio.victory();
      endDive();
    }
    if (frameEvents & EVENT_WAVE_CLEAR) announce(`Wave ${world.state.wave} clear. Choose a boon.`);
    if (frameEvents & EVENT_BOSS) announce('The Maw rises. It circles, it breathes globs, it calls the gnawers in.');

    renderer.draw(world.state);
    hud.draw(ctx, world.state, best, audio.isMuted());
    screens.draw(ctx, world.state, screen, best, audio.isMuted());
  }

  // Leaving the tab pauses a running dive rather than letting the trench hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A small window on the dive, for whoever is watching the page from outside it.
  window.__glowdeep = {
    get screen() {
      return screen;
    },
    state: world.state,
  };

  announce('Glowdeep. Press Space or click to dive.');
  requestAnimationFrame(frame);
}

// --- the staged scenes -----------------------------------------------------------

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state);
    hud.draw(ctx, world.state, scene.best, false);
    screens.draw(ctx, world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// A fault in the water is spoken, never silent: the page's status line carries it.
window.addEventListener('error', (event) => {
  if (status !== null) status.textContent = `Error: ${event.message}`;
});

if (shot) runShot(shot);
else runGame();
