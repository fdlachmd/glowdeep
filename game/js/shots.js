// The staged scenes behind the entry's screenshots. Each one builds a real moment of the dive —
// the title's calm, a busy wave, the boon choice, the light going out — by running the world's own
// simulation from a fixed seed, so every screenshot is a true render of the game and the same
// scene can be staged again on any machine. Nothing here is read by the game itself: the loop
// calls stageShot only when the page is opened with ?shot=name.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './screens.js';

const W = FIELD.width;
const H = FIELD.height;

/** The one seed every staged scene is built from. */
export const SHOT_SEED = 20261107;

/** The best dive the staged scenes pretend the player brought to the trench. */
const SHOT_BEST = 1980;

export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'upgrade') return stageUpgrade(world);
  if (name === 'end') return stageEnd(world);
  return stageTitle(world);
}

// --- the title's calm ----------------------------------------------------------

function stageTitle(world) {
  world.reset();
  return { screen: SCREEN_TITLE, best: SHOT_BEST };
}

// --- a busy wave -----------------------------------------------------------------

function stagePlay(world) {
  world.reset();
  world.beginDive();
  const s = world.state;
  const p = world.state.player;

  // Deep into the dive: the fourth wave, a streak alive, the hoard already part-spent.
  s.wave = 4;
  s.score = 1180;
  s.kills = 23;
  s.phase = 'active';
  s.phaseTimer = 0;
  s.banner.text = '';
  s.banner.timer = 0;
  s.combo = 5;
  s.comboTimer = 1.6;
  s.spawnQueue = ['gnawer', 'wisp', 'gnawer', 'bloom', 'urchin', 'wisp', 'gnawer', 'snapper', 'gnawer', 'wisp'];
  s.spawnTimer = 0.05;
  p.boltCount = 2;
  p.wardMax = 2;
  p.ward = 2;
  p.glow = 2;

  // A few pearls already glimmering in the water, one of them a mended glow.
  dropPearlAt(s, 386, 452, false);
  dropPearlAt(s, 918, 296, false);
  dropPearlAt(s, 700, 560, true);

  // Let the wave pour in and the jellyfish swim and fire among it: two and a half seconds of
  // the real simulation, steered by a script, so the frame shows the game mid-fight.
  for (let i = 0; i < 150; i += 1) {
    s.spawnTimer = 0.01;
    world.step(STEP, diveCtrl(s, i), false);
  }
  // Whatever the fight did, the scene stays mid-wave: the water busy, the banner quiet.
  s.phase = 'active';
  s.offers = null;
  s.over = false;
  s.banner.text = '';
  s.banner.timer = 0;
  s.combo = Math.max(s.combo, 6);
  s.comboTimer = 1.8;
  s.shake = 0;
  p.glow = Math.max(1, p.glow);
  p.invuln = 0;
  return { screen: SCREEN_PLAY, best: SHOT_BEST };
}

/** The scripted diver: a slow circuit of the trench, bolts toward the nearest creature. */
function diveCtrl(s, i) {
  const p = s.player;
  const t = i * STEP;
  const wantX = W / 2 + Math.cos(t * 0.85) * 200;
  const wantY = H / 2 + Math.sin(t * 0.85) * 130;
  let near = null;
  let nearD = Infinity;
  for (const foe of s.foes) {
    if (!foe.active) continue;
    const d = (foe.x - p.x) * (foe.x - p.x) + (foe.y - p.y) * (foe.y - p.y);
    if (d < nearD) {
      nearD = d;
      near = foe;
    }
  }
  return {
    moveX: Math.max(-1, Math.min(1, (wantX - p.x) / 40)),
    moveY: Math.max(-1, Math.min(1, (wantY - p.y) / 40)),
    aimX: near === null ? p.x + 100 : near.x,
    aimY: near === null ? p.y : near.y,
    firing: true,
    dash: false,
  };
}

// --- the boon choice ----------------------------------------------------------------

function stageUpgrade(world) {
  world.reset();
  world.beginDive();
  const s = world.state;
  s.wave = 3;
  s.score = 745;
  s.kills = 31;
  s.phase = 'upgrade';
  s.offers = ['twin-volley', 'pearl-lure', 'bubble-ward'];
  s.taken = { 'rapid-glow': 1 };
  s.banner.text = 'WAVE 3 CLEAR';
  s.banner.timer = 1.4;
  s.player.x = W / 2;
  s.player.y = H / 2 + 60;
  dropPearlAt(s, 420, 520, false);
  dropPearlAt(s, 860, 480, false);
  // A breath of drift so the tentacles hang easy behind the bell.
  for (let i = 0; i < 10; i += 1) world.step(STEP, null, true);
  return { screen: SCREEN_PLAY, best: SHOT_BEST };
}

// --- the light going out ---------------------------------------------------------------

function stageEnd(world) {
  world.reset();
  world.beginDive();
  const s = world.state;
  const p = s.player;
  s.wave = 7;
  s.score = 2410;
  s.kills = 87;
  s.phase = 'done';
  s.over = true;
  s.victory = false;
  s.banner.text = '';
  s.banner.timer = 0;
  p.glow = 0;
  p.invuln = 0;
  p.x = W / 2;
  p.y = H / 2;

  // The bell's last burst, staged from the same pools the world itself fills.
  const random = createRandom(SHOT_SEED ^ 0x5eed);
  for (let i = 0; i < 34; i += 1) {
    const mote = s.motes.find((spot) => !spot.active);
    if (mote === undefined) break;
    const angle = random() * Math.PI * 2;
    const pace = 60 + random() * 200;
    mote.active = true;
    mote.x = p.x;
    mote.y = p.y;
    mote.vx = Math.cos(angle) * pace;
    mote.vy = Math.sin(angle) * pace;
    mote.maxLife = 0.9;
    mote.life = 0.9;
    mote.size = 2 + random() * 2.4;
    mote.color = random() < 0.75 ? '#6ff2ff' : '#ff5d73';
    mote.drag = 2.4;
  }
  const ring = s.rings.find((spot) => !spot.active);
  if (ring !== undefined) {
    ring.active = true;
    ring.x = p.x;
    ring.y = p.y;
    ring.radius = p.radius;
    ring.growth = 420;
    ring.maxLife = 0.9;
    ring.life = 0.9;
    ring.color = '#6ff2ff';
    ring.width = 4;
  }
  for (let i = 0; i < 3; i += 1) world.step(STEP, null, true);
  return { screen: SCREEN_OVER, best: SHOT_BEST };
}

// --- shared small helpers ------------------------------------------------------------

/** A pearl set glowing at a chosen place in the water. */
function dropPearlAt(s, x, y, heart) {
  const pearl = s.pearls.find((spot) => !spot.active);
  if (pearl === undefined) return;
  pearl.active = true;
  pearl.heart = heart;
  pearl.x = x;
  pearl.y = y;
  pearl.vx = 0;
  pearl.vy = 0;
  pearl.life = 9;
  pearl.age = 0.5;
}
