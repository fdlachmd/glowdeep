// The dive itself: the player's jellyfish, the trench's creatures, bolts, globs, pearls and
// particles, and the wave director that pours them in. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react with sound and announcements
// without the world knowing about screens, canvases or audio. Nothing here allocates during
// play: every pool is filled once at boot and reused, and the only randomness is the seeded
// kind handed to createWorld, so a seed replays the same dive.

import { BOSS, BOSS_EVERY, COMBO, FIELD, FOES, PALETTE, PEARL, PLAYER, POOLS, WAVES, WARD } from './config.js';
import { range, weighted } from './random.js';
import { applyUpgrade, rollOffers } from './upgrades.js';

export const EVENT_HURT = 1;
export const EVENT_KILL = 2;
export const EVENT_PEARL = 4;
export const EVENT_HEART = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_BOSS = 64;
export const EVENT_WARD = 128;
export const EVENT_DASH = 256;
export const EVENT_VOLLEY = 512;
export const EVENT_HIT = 1024;

const MARGIN = FIELD.margin;
const TAU = Math.PI * 2;
const FOE_KINDS = Object.keys(FOES);
const FOE_COLORS = {
  gnawer: PALETTE.gnawer,
  wisp: PALETTE.wisp,
  urchin: PALETTE.urchin,
  bloom: PALETTE.bloom,
  snapper: PALETTE.snapper,
  maw: PALETTE.maw,
};

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    glow: PLAYER.glow,
    maxGlow: PLAYER.glow,
    invuln: 0,
    fireTimer: 0,
    fireInterval: PLAYER.fireInterval,
    boltSpeed: PLAYER.boltSpeed,
    boltLife: PLAYER.boltLife,
    boltRadius: PLAYER.boltRadius,
    boltDamage: PLAYER.damage,
    boltCount: 1,
    boltPierce: 0,
    speed: PLAYER.speed,
    dashTimer: 0,
    dashActive: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashCooldown: PLAYER.dashCooldown,
    ward: 0,
    wardMax: 0,
    wardTimer: 0,
    lureRadius: PEARL.attract,
    thornHalo: false,
    trail: [],
    trailIndex: 0,
  };
  for (let i = 0; i < PLAYER.trailLength; i += 1) player.trail.push({ x: player.x, y: player.y });

  const foes = [];
  for (let i = 0; i < POOLS.foes; i += 1) foes.push({ active: false, id: 0, kind: 'gnawer', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 10, speed: 100, damage: 1, score: 0, flash: 0, age: 0, timer: 0, phase: 0, angle: 0 });
  const bolts = [];
  for (let i = 0; i < POOLS.bolts; i += 1) bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 5, life: 0, damage: 1, pierce: 0, hitId: -1 });
  const globs = [];
  for (let i = 0; i < POOLS.globs; i += 1) globs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, life: 0 });
  const pearls = [];
  for (let i = 0; i < POOLS.pearls; i += 1) pearls.push({ active: false, heart: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, age: 0 });
  const motes = [];
  for (let i = 0; i < POOLS.motes; i += 1) motes.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 0 });
  const floaters = [];
  for (let i = 0; i < POOLS.floaters; i += 1) floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, size: 15, color: '#ffffff' });
  const rings = [];
  for (let i = 0; i < POOLS.rings; i += 1) rings.push({ active: false, x: 0, y: 0, radius: 0, growth: 0, life: 0, maxLife: 1, color: '#ffffff', width: 2 });

  const state = {
    player,
    foes,
    bolts,
    globs,
    pearls,
    motes,
    floaters,
    rings,
    wave: 0,
    phase: 'idle', // idle: the title's calm; announce, active, upgrade: the dive; done: its end
    phaseTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    comboWindow: COMBO.window,
    kills: 0,
    elapsed: 0,
    time: 0,
    banner: { text: '', timer: 0 },
    taken: {},
    offers: null,
    over: false,
    victory: false,
    shake: 0,
    nextFoeId: 1,
    aimX: FIELD.width / 2,
    aimY: FIELD.height / 2 - 120,
  };

  let events = 0;

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.glow = PLAYER.glow;
    player.maxGlow = PLAYER.glow;
    player.invuln = 0;
    player.fireTimer = 0;
    player.fireInterval = PLAYER.fireInterval;
    player.boltSpeed = PLAYER.boltSpeed;
    player.boltLife = PLAYER.boltLife;
    player.boltRadius = PLAYER.boltRadius;
    player.boltDamage = PLAYER.damage;
    player.boltCount = 1;
    player.boltPierce = 0;
    player.speed = PLAYER.speed;
    player.dashTimer = 0;
    player.dashActive = 0;
    player.dashCooldown = PLAYER.dashCooldown;
    player.ward = 0;
    player.wardMax = 0;
    player.wardTimer = 0;
    player.lureRadius = PEARL.attract;
    player.thornHalo = false;
    for (const spot of player.trail) {
      spot.x = player.x;
      spot.y = player.y;
    }
    for (const foe of foes) foe.active = false;
    for (const bolt of bolts) bolt.active = false;
    for (const glob of globs) glob.active = false;
    for (const pearl of pearls) pearl.active = false;
    for (const mote of motes) mote.active = false;
    for (const floater of floaters) floater.active = false;
    for (const ring of rings) ring.active = false;
    state.wave = 0;
    state.phase = 'idle';
    state.phaseTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.comboWindow = COMBO.window;
    state.kills = 0;
    state.elapsed = 0;
    state.banner.text = '';
    state.banner.timer = 0;
    state.taken = {};
    state.offers = null;
    state.over = false;
    state.victory = false;
    state.shake = 0;
    state.nextFoeId = 1;
    state.aimX = FIELD.width / 2;
    state.aimY = FIELD.height / 2 - 120;
  }

  // --- pools ---------------------------------------------------------------

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function mote(x, y, vx, vy, life, size, color, drag) {
    const spot = free(motes);
    if (spot === null) return;
    spot.active = true;
    spot.x = x;
    spot.y = y;
    spot.vx = vx;
    spot.vy = vy;
    spot.maxLife = life;
    spot.life = life;
    spot.size = size;
    spot.color = color;
    spot.drag = drag ?? 2.4;
  }

  function floater(x, y, text, color, size) {
    const spot = free(floaters);
    if (spot === null) return;
    spot.active = true;
    spot.x = x;
    spot.y = y;
    spot.text = text;
    spot.life = 0.9;
    spot.color = color;
    spot.size = size ?? 15;
  }

  function ring(x, y, radius, growth, life, color, width) {
    const spot = free(rings);
    if (spot === null) return;
    spot.active = true;
    spot.x = x;
    spot.y = y;
    spot.radius = radius;
    spot.growth = growth;
    spot.maxLife = life;
    spot.life = life;
    spot.color = color;
    spot.width = width ?? 2;
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const pace = range(random, speed * 0.3, speed);
      mote(x, y, Math.cos(angle) * pace, Math.sin(angle) * pace, range(random, 0.3, 0.75), range(random, size * 0.5, size * 1.4), color);
    }
  }

  // --- waves ---------------------------------------------------------------

  function isBossWave(wave) {
    return wave % BOSS_EVERY === 0;
  }

  function spawnGap(wave) {
    const t = Math.min(1, (wave - 1) / 8);
    return WAVES.gapStart + (WAVES.gapEnd - WAVES.gapStart) * t;
  }

  function buildWave(wave) {
    const queue = [];
    if (isBossWave(wave)) {
      queue.push('maw');
      for (let i = 0; i < WAVES.bossAdds; i += 1) queue.push('gnawer');
    } else {
      const kinds = FOE_KINDS.filter((kind) => FOES[kind].fromWave <= wave);
      const count = Math.min(WAVES.maxFoes, Math.round(WAVES.first + WAVES.perWave * (wave - 1)));
      for (let i = 0; i < count; i += 1) queue.push(weighted(random, kinds.map((kind) => ({ kind, weight: FOES[kind].weight }))).kind);
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.4;
  }

  function spawnFoe(kind) {
    const foe = free(foes);
    if (foe === null) return;
    const wave = state.wave;
    foe.active = true;
    foe.id = state.nextFoeId;
    state.nextFoeId += 1;
    foe.kind = kind;
    foe.age = 0;
    foe.flash = 0;
    foe.phase = 0;
    foe.timer = 0;
    foe.vx = 0;
    foe.vy = 0;
    // Arrive from a random point on a random edge, just inside the rock.
    const edge = Math.floor(random() * 4);
    if (edge === 0) {
      foe.x = range(random, MARGIN, FIELD.width - MARGIN);
      foe.y = MARGIN;
    } else if (edge === 1) {
      foe.x = range(random, MARGIN, FIELD.width - MARGIN);
      foe.y = FIELD.height - MARGIN;
    } else if (edge === 2) {
      foe.x = MARGIN;
      foe.y = range(random, MARGIN, FIELD.height - MARGIN);
    } else {
      foe.x = FIELD.width - MARGIN;
      foe.y = range(random, MARGIN, FIELD.height - MARGIN);
    }
    if (kind === 'maw') {
      foe.radius = BOSS.radius;
      foe.maxHp = BOSS.baseHp + BOSS.hpPerBoss * (Math.floor(wave / BOSS_EVERY) - 1);
      foe.speed = BOSS.speed;
      foe.damage = BOSS.contactDamage;
      foe.score = BOSS.score;
      foe.timer = 2.2; // first radial burst
      foe.phase = 3.4; // aimed spread timer
      state.banner.text = 'THE MAW RISES';
      state.banner.timer = 2.4;
    } else {
      const stat = FOES[kind];
      foe.radius = stat.radius;
      foe.maxHp = Math.ceil(stat.hp + WAVES.hpPerWave * (wave - 1));
      foe.speed = stat.speed + WAVES.speedPerWave * (wave - 1);
      foe.damage = stat.damage;
      foe.score = stat.score;
    }
    foe.hp = foe.maxHp;
    foe.angle = Math.atan2(player.y - foe.y, player.x - foe.x);
  }

  // --- combat --------------------------------------------------------------

  function fireVolley() {
    const n = player.boltCount;
    const base = Math.atan2(state.aimY - player.y, state.aimX - player.x);
    const spread = n > 1 ? 0.13 : 0;
    for (let i = 0; i < n; i += 1) {
      const bolt = free(bolts);
      if (bolt === null) break;
      const angle = base + (i - (n - 1) / 2) * spread;
      bolt.active = true;
      bolt.x = player.x + Math.cos(angle) * (player.radius + 6);
      bolt.y = player.y + Math.sin(angle) * (player.radius + 6);
      bolt.vx = Math.cos(angle) * player.boltSpeed;
      bolt.vy = Math.sin(angle) * player.boltSpeed;
      bolt.radius = player.boltRadius;
      bolt.life = player.boltLife;
      bolt.damage = player.boltDamage;
      bolt.pierce = player.boltPierce;
      bolt.hitId = -1;
    }
    mote(player.x + Math.cos(base) * player.radius, player.y + Math.sin(base) * player.radius, Math.cos(base) * 60, Math.sin(base) * 60, 0.2, 5, '#aef6ff');
  }

  function hurtPlayer(damage, fromX, fromY) {
    if (player.invuln > 0 || player.dashActive > 0 || state.over) return false;
    if (player.ward > 0) {
      player.ward -= 1;
      player.invuln = 0.8;
      ring(player.x, player.y, player.radius + 8, 190, 0.5, '#7dd7ff', 3);
      burst(player.x, player.y, '#7dd7ff', 14, 150, 3);
      state.shake = Math.max(state.shake, 5);
      events |= EVENT_WARD;
      return true;
    }
    player.glow -= damage;
    player.invuln = PLAYER.invuln;
    state.shake = Math.max(state.shake, 8);
    const away = Math.atan2(player.y - fromY, player.x - fromX);
    player.vx += Math.cos(away) * 220;
    player.vy += Math.sin(away) * 220;
    burst(player.x, player.y, '#ff5d73', 16, 190, 3.4);
    floater(player.x, player.y - 26, `-${damage}`, '#ff5d73', 17);
    if (player.thornHalo) {
      ring(player.x, player.y, player.radius, 340, 0.45, '#ff5d73', 3);
      for (const foe of foes) {
        if (!foe.active) continue;
        const dx = foe.x - player.x;
        const dy = foe.y - player.y;
        if (dx * dx + dy * dy < 150 * 150) {
          foe.hp -= 2;
          foe.flash = 0.1;
          const angle = Math.atan2(dy, dx);
          foe.vx += Math.cos(angle) * 190;
          foe.vy += Math.sin(angle) * 190;
          if (foe.hp <= 0) killFoe(foe);
        }
      }
    }
    if (player.glow <= 0) {
      player.glow = 0;
      state.over = true;
      state.phase = 'done';
      events |= EVENT_OVER;
      burst(player.x, player.y, '#6ff2ff', 40, 260, 4);
      ring(player.x, player.y, player.radius, 420, 0.9, '#6ff2ff', 4);
    }
    events |= EVENT_HURT;
    return true;
  }

  function killFoe(foe) {
    foe.active = false;
    state.kills += 1;
    state.combo = state.comboTimer > 0 ? Math.min(COMBO.max, state.combo + 1) : 1;
    state.comboTimer = state.comboWindow;
    const gain = foe.score * state.combo;
    state.score += gain;
    floater(foe.x, foe.y - foe.radius - 6, `+${gain}`, state.combo > 1 ? '#ffd978' : '#e8f6ff', state.combo > 3 ? 18 : 15);
    const big = foe.kind === 'maw' || foe.kind === 'snapper' || foe.kind === 'urchin';
    burst(foe.x, foe.y, foeColor(foe.kind), big ? 26 : 14, big ? 240 : 170, big ? 4 : 3);
    ring(foe.x, foe.y, foe.radius * 0.6, big ? 260 : 150, 0.35, foeColor(foe.kind), 2);
    state.shake = Math.max(state.shake, foe.kind === 'maw' ? 11 : big ? 4 : 2);
    if (random() < PEARL.dropChance) dropPearl(foe.x, foe.y);
    if (foe.kind === 'maw') {
      for (let i = 0; i < 6; i += 1) dropPearl(foe.x + range(random, -40, 40), foe.y + range(random, -40, 40));
      ring(foe.x, foe.y, foe.radius, 520, 0.8, '#ff4d5e', 5);
      burst(foe.x, foe.y, '#9ffcff', 30, 300, 4);
    }
    if (foe.kind === 'urchin') {
      // A dying urchin lets go of its spines: six slow globs, easy to dodge but never free.
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * TAU + random() * 0.4;
        fireGlob(foe.x, foe.y, Math.cos(angle) * 118, Math.sin(angle) * 118, 1.1, 6);
      }
    }
    events |= EVENT_KILL;
  }

  function foeColor(kind) {
    return FOE_COLORS[kind] ?? PALETTE.gnawer;
  }

  function dropPearl(x, y) {
    const pearl = free(pearls);
    if (pearl === null) return;
    pearl.active = true;
    pearl.heart = random() < PEARL.heartChance;
    pearl.x = clamp(x + range(random, -12, 12), MARGIN, FIELD.width - MARGIN);
    pearl.y = clamp(y + range(random, -12, 12), MARGIN, FIELD.height - MARGIN);
    pearl.vx = range(random, -26, 26);
    pearl.vy = range(random, -26, 26);
    pearl.life = PEARL.lifetime;
    pearl.age = 0;
  }

  function fireGlob(x, y, vx, vy, life, radius) {
    const glob = free(globs);
    if (glob === null) return;
    glob.active = true;
    glob.x = x;
    glob.y = y;
    glob.vx = vx;
    glob.vy = vy;
    glob.life = life;
    glob.radius = radius ?? 7;
  }

  // --- foe minds -----------------------------------------------------------

  function seek(foe, targetX, targetY, pace, dt) {
    const angle = Math.atan2(targetY - foe.y, targetX - foe.x);
    foe.vx += (Math.cos(angle) * pace - foe.vx) * Math.min(1, 3.2 * dt);
    foe.vy += (Math.sin(angle) * pace - foe.vy) * Math.min(1, 3.2 * dt);
  }

  function updateFoe(foe, dt) {
    foe.age += dt;
    if (foe.flash > 0) foe.flash -= dt;
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const distance = Math.hypot(dx, dy) || 1;

    switch (foe.kind) {
      case 'gnawer':
        seek(foe, player.x, player.y, foe.speed, dt);
        foe.x += (Math.sin(foe.age * 5.1) * 26 - Math.cos(foe.age * 3.7) * 18) * dt;
        break;
      case 'wisp': {
        // A darting weave: it closes fast, slackens, and closes again.
        const pulse = 0.55 + 0.65 * Math.abs(Math.sin(foe.age * 2.6));
        const weave = Math.sin(foe.age * 4.3) * 0.7;
        const angle = Math.atan2(dy, dx) + weave;
        foe.vx += (Math.cos(angle) * foe.speed * pulse - foe.vx) * Math.min(1, 4 * dt);
        foe.vy += (Math.sin(angle) * foe.speed * pulse - foe.vy) * Math.min(1, 4 * dt);
        break;
      }
      case 'urchin':
        seek(foe, player.x, player.y, foe.speed, dt);
        foe.angle += dt * 1.4;
        break;
      case 'bloom': {
        // Keeps its distance and spits: it drifts nearer when far, backs off when crowded.
        const wanted = distance > 330 ? 1 : distance < 250 ? -0.7 : 0;
        seek(foe, player.x, player.y, foe.speed * wanted, dt);
        foe.x += Math.cos(foe.age * 0.9) * 22 * dt;
        foe.y += Math.sin(foe.age * 1.3) * 22 * dt;
        foe.timer -= dt;
        if (foe.timer <= 0) {
          foe.timer = 2.4;
          const lead = 0.35;
          const aim = Math.atan2(player.y + player.vy * lead - foe.y, player.x + player.vx * lead - foe.x);
          fireGlob(foe.x, foe.y, Math.cos(aim) * 165, Math.sin(aim) * 165, 3.2, 7);
        }
        break;
      }
      case 'snapper': {
        // Approach, flash a warning, lunge, then drift while it recovers.
        foe.timer -= dt;
        if (foe.phase === 0) {
          seek(foe, player.x, player.y, foe.speed, dt);
          if (foe.timer <= 0 && distance < 330) {
            foe.phase = 1;
            foe.timer = 0.45;
          }
        } else if (foe.phase === 1) {
          foe.vx *= 0.9;
          foe.vy *= 0.9;
          if (foe.timer <= 0) {
            foe.phase = 2;
            foe.timer = 0.38;
            const angle = Math.atan2(dy, dx);
            foe.vx = Math.cos(angle) * foe.speed * 3.4;
            foe.vy = Math.sin(angle) * foe.speed * 3.4;
          }
        } else if (foe.phase === 2) {
          if (foe.timer <= 0) {
            foe.phase = 3;
            foe.timer = 0.7;
          }
        } else if (foe.phase === 3) {
          seek(foe, player.x, player.y, foe.speed * 0.5, dt);
          if (foe.timer <= 0) {
            foe.phase = 0;
            foe.timer = 1.1;
          }
        }
        break;
      }
      case 'maw': {
        // The trench's keeper: it circles, breathes rings of globs, and calls gnawers in.
        const wanted = distance > 300 ? 1 : distance < 220 ? -0.5 : 0;
        const orbit = Math.atan2(dy, dx) + Math.PI / 2;
        foe.vx += (Math.cos(orbit) * foe.speed * 0.7 + (dx / distance) * foe.speed * wanted - foe.vx) * Math.min(1, 2 * dt);
        foe.vy += (Math.sin(orbit) * foe.speed * 0.7 + (dy / distance) * foe.speed * wanted - foe.vy) * Math.min(1, 2 * dt);
        foe.timer -= dt;
        if (foe.timer <= 0) {
          foe.timer = 2.8;
          const base = Math.atan2(dy, dx);
          for (let i = 0; i < 12; i += 1) {
            const angle = base + (i / 12) * TAU;
            fireGlob(foe.x, foe.y, Math.cos(angle) * 150, Math.sin(angle) * 150, 3.4, 8);
          }
          ring(foe.x, foe.y, foe.radius * 0.7, 200, 0.4, '#ff4d5e', 3);
        }
        if (foe.hp < foe.maxHp * 0.5) {
          foe.phase -= dt;
          if (foe.phase <= 0) {
            foe.phase = 1.6;
            const angle = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i += 1) fireGlob(foe.x, foe.y, Math.cos(angle + i * 0.22) * 185, Math.sin(angle + i * 0.22) * 185, 3, 7);
          }
        }
        break;
      }
      default:
        seek(foe, player.x, player.y, foe.speed, dt);
    }

    foe.x += foe.vx * dt;
    foe.y += foe.vy * dt;
    foe.x = clamp(foe.x, MARGIN, FIELD.width - MARGIN);
    foe.y = clamp(foe.y, MARGIN, FIELD.height - MARGIN);

    // Touching the jellyfish hurts, whatever the creature is.
    if (distance < foe.radius + player.radius) {
      if (hurtPlayer(foe.damage, foe.x, foe.y)) {
        const angle = Math.atan2(-dy, -dx);
        foe.vx += Math.cos(angle) * 160;
        foe.vy += Math.sin(angle) * 160;
      }
    }
  }

  // --- the step ------------------------------------------------------------

  function updateCosmetics(dt) {
    for (const mote_ of motes) {
      if (!mote_.active) continue;
      mote_.life -= dt;
      if (mote_.life <= 0) {
        mote_.active = false;
        continue;
      }
      mote_.vx -= mote_.vx * mote_.drag * dt;
      mote_.vy -= mote_.vy * mote_.drag * dt;
      mote_.x += mote_.vx * dt;
      mote_.y += mote_.vy * dt;
    }
    for (const floater_ of floaters) {
      if (!floater_.active) continue;
      floater_.life -= dt;
      floater_.y -= 34 * dt;
      if (floater_.life <= 0) floater_.active = false;
    }
    for (const ring_ of rings) {
      if (!ring_.active) continue;
      ring_.life -= dt;
      ring_.radius += ring_.growth * dt;
      if (ring_.life <= 0) ring_.active = false;
    }
    for (const pearl of pearls) {
      if (!pearl.active) continue;
      pearl.age += dt;
      pearl.life -= dt;
      if (pearl.life <= 0) {
        pearl.active = false;
        continue;
      }
      const dx = player.x - pearl.x;
      const dy = player.y - pearl.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < player.lureRadius) {
        const pull = 460 * (1 - distance / player.lureRadius) + 90;
        pearl.vx += (dx / distance) * pull * dt;
        pearl.vy += (dy / distance) * pull * dt;
      }
      pearl.vx -= pearl.vx * 1.6 * dt;
      pearl.vy -= pearl.vy * 1.6 * dt;
      pearl.x = clamp(pearl.x + pearl.vx * dt, MARGIN, FIELD.width - MARGIN);
      pearl.y = clamp(pearl.y + pearl.vy * dt, MARGIN, FIELD.height - MARGIN);
      if (distance < player.radius + PEARL.collect) {
        pearl.active = false;
        if (pearl.heart) {
          player.glow = Math.min(player.maxGlow, player.glow + 1);
          floater(player.x, player.y - 30, '+GLOW', '#7dffb0', 16);
          ring(player.x, player.y, player.radius, 160, 0.4, '#7dffb0', 2);
          events |= EVENT_HEART;
        } else {
          state.score += PEARL.score;
          if (state.combo > 1) state.comboTimer = Math.max(state.comboTimer, state.comboWindow * 0.5);
          floater(pearl.x, pearl.y - 10, `+${PEARL.score}`, '#ffe9a8', 13);
          events |= EVENT_PEARL;
        }
      }
    }
    state.shake = Math.max(0, state.shake - 26 * dt);
    if (state.banner.timer > 0) state.banner.timer -= dt;
  }

  function updatePlayer(dt, ctrl) {
    if (player.dashTimer > 0) player.dashTimer -= dt;
    if (player.invuln > 0) player.invuln -= dt;

    if (ctrl.dash && player.dashTimer <= 0 && player.dashActive <= 0 && state.phase === 'active') {
      let dirX = ctrl.moveX;
      let dirY = ctrl.moveY;
      if (dirX === 0 && dirY === 0) {
        const angle = Math.atan2(state.aimY - player.y, state.aimX - player.x);
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      }
      const length = Math.hypot(dirX, dirY) || 1;
      player.dashDirX = dirX / length;
      player.dashDirY = dirY / length;
      player.dashActive = PLAYER.dashTime;
      player.dashTimer = player.dashCooldown;
      events |= EVENT_DASH;
      for (let i = 0; i < 8; i += 1) mote(player.x, player.y, range(random, -70, 70), range(random, -70, 70), range(random, 0.3, 0.6), range(random, 2, 4), '#9ffcff');
    }

    if (player.dashActive > 0) {
      player.dashActive -= dt;
      player.vx = player.dashDirX * PLAYER.dashSpeed;
      player.vy = player.dashDirY * PLAYER.dashSpeed;
      if (random() < 0.7) mote(player.x, player.y, range(random, -30, 30), range(random, -30, 30), 0.4, 3, '#6ff2ff');
    } else {
      const inputX = ctrl.moveX;
      const inputY = ctrl.moveY;
      if (inputX !== 0 || inputY !== 0) {
        const length = Math.hypot(inputX, inputY) || 1;
        player.vx += (inputX / length) * PLAYER.accel * dt;
        player.vy += (inputY / length) * PLAYER.accel * dt;
        const pace = Math.hypot(player.vx, player.vy);
        if (pace > player.speed) {
          player.vx = (player.vx / pace) * player.speed;
          player.vy = (player.vy / pace) * player.speed;
        }
      } else {
        player.vx -= player.vx * PLAYER.friction * dt;
        player.vy -= player.vy * PLAYER.friction * dt;
      }
    }

    player.x = clamp(player.x + player.vx * dt, MARGIN + player.radius, FIELD.width - MARGIN - player.radius);
    player.y = clamp(player.y + player.vy * dt, MARGIN + player.radius, FIELD.height - MARGIN - player.radius);

    player.trail[player.trailIndex].x = player.x;
    player.trail[player.trailIndex].y = player.y;
    player.trailIndex = (player.trailIndex + 1) % player.trail.length;

    if (player.fireTimer > 0) player.fireTimer -= dt;
    if (ctrl.firing && player.fireTimer <= 0 && state.phase === 'active') {
      player.fireTimer = player.fireInterval;
      fireVolley();
      events |= EVENT_VOLLEY;
    }

    if (player.wardMax > 0 && player.ward < player.wardMax) {
      player.wardTimer += dt;
      if (player.wardTimer >= WARD.recharge) {
        player.wardTimer = 0;
        player.ward += 1;
        ring(player.x, player.y, player.radius + 4, 90, 0.4, '#7dd7ff', 2);
      }
    }
  }

  function updateBolts(dt) {
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.life -= dt;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.life <= 0 || bolt.x < MARGIN || bolt.x > FIELD.width - MARGIN || bolt.y < MARGIN || bolt.y > FIELD.height - MARGIN) {
        bolt.active = false;
        continue;
      }
      for (const foe of foes) {
        if (!foe.active || foe.id === bolt.hitId) continue;
        const dx = foe.x - bolt.x;
        const dy = foe.y - bolt.y;
        if (dx * dx + dy * dy < (foe.radius + bolt.radius) * (foe.radius + bolt.radius)) {
          bolt.hitId = foe.id;
          foe.hp -= bolt.damage;
          foe.flash = 0.09;
          const angle = Math.atan2(bolt.vy, bolt.vx);
          foe.vx += Math.cos(angle) * 46;
          foe.vy += Math.sin(angle) * 46;
          burst(bolt.x, bolt.y, '#aef6ff', 4, 110, 2.2);
          events |= EVENT_HIT;
          if (foe.hp <= 0) killFoe(foe);
          if (bolt.pierce > 0) bolt.pierce -= 1;
          else {
            bolt.active = false;
            break;
          }
        }
      }
    }
  }

  function updateGlobs(dt) {
    for (const glob of globs) {
      if (!glob.active) continue;
      glob.life -= dt;
      glob.x += glob.vx * dt;
      glob.y += glob.vy * dt;
      if (glob.life <= 0 || glob.x < MARGIN || glob.x > FIELD.width - MARGIN || glob.y < MARGIN || glob.y > FIELD.height - MARGIN) {
        glob.active = false;
        continue;
      }
      const dx = player.x - glob.x;
      const dy = player.y - glob.y;
      if (dx * dx + dy * dy < (player.radius + glob.radius) * (player.radius + glob.radius)) {
        glob.active = false;
        if (hurtPlayer(1, glob.x, glob.y)) burst(glob.x, glob.y, '#ff5d73', 8, 130, 2.6);
      }
    }
  }

  function step(dt, ctrl, harmless) {
    events = 0;
    state.time += dt;
    state.aimX = ctrl.aimX;
    state.aimY = ctrl.aimY;
    updateCosmetics(dt);

    if (harmless) {
      // The title's calm: the jellyfish drifts on its own, nothing hunts, nothing hurts.
      const driftX = Math.cos(state.time * 0.5) * 0.8;
      const driftY = Math.sin(state.time * 0.8) * 0.5;
      updatePlayer(dt, { moveX: driftX, moveY: driftY, aimX: player.x + driftX * 100, aimY: player.y + driftY * 100, firing: false, dash: false });
      return events;
    }

    if (state.phase === 'announce') {
      updatePlayer(dt, ctrl);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) state.phase = 'active';
      return events;
    }

    if (state.phase !== 'active') return events;

    state.elapsed += dt;
    if (state.combo > 1) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    updatePlayer(dt, ctrl);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
      spawnFoe(state.spawnQueue.shift());
      state.spawnTimer = spawnGap(state.wave);
    }

    for (const foe of foes) if (foe.active) updateFoe(foe, dt);
    updateBolts(dt);
    updateGlobs(dt);

    if (state.spawnQueue.length === 0) {
      let alive = 0;
      for (const foe of foes) if (foe.active) alive += 1;
      if (alive === 0 && !state.over) {
        state.score += 50 * state.wave;
        state.banner.text = `WAVE ${state.wave} CLEAR`;
        state.banner.timer = 1.6;
        events |= EVENT_WAVE_CLEAR;
        if (state.wave >= WAVES.final) {
          state.phase = 'done';
          state.victory = true;
        } else {
          state.phase = 'upgrade';
          state.offers = rollOffers(random, state.taken);
        }
      }
    }
    return events;
  }

  // --- the dive's frame ----------------------------------------------------

  function beginDive() {
    reset();
    state.wave = 1;
    buildWave(1);
    state.phase = 'announce';
    state.phaseTimer = 1.7;
    state.banner.text = 'WAVE 1';
    state.banner.timer = 1.7;
  }

  function chooseUpgrade(id) {
    if (state.phase !== 'upgrade' || state.offers === null) return false;
    if (!state.offers.includes(id)) return false;
    applyUpgrade(state, id);
    state.offers = null;
    state.wave += 1;
    buildWave(state.wave);
    state.phase = 'announce';
    state.phaseTimer = 1.7;
    state.banner.text = isBossWave(state.wave) ? 'THE MAW RISES' : `WAVE ${state.wave}`;
    state.banner.timer = 1.7;
    return true;
  }

  return { state, reset, beginDive, chooseUpgrade, step };
}
