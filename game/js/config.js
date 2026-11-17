// Every tuning number, colour and creature stat in one place. The trench is a fixed 1280x720
// logical arena; the renderer scales it to the window, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 720, margin: 26 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The longest frame the loop chases before dropping the rest (a hidden tab must not replay). */
export const MAX_FRAME = 0.25;

export const PLAYER = {
  radius: 15,
  speed: 252, // px/s base swim speed
  accel: 1600, // how fast velocity reaches the swim speed
  friction: 6.5, // per-second velocity damping when no direction is held
  fireInterval: 0.26, // seconds between volleys at no upgrades
  boltSpeed: 660,
  boltLife: 0.9,
  boltRadius: 5,
  damage: 1,
  glow: 3, // hit points: the jellyfish's light
  invuln: 1.2, // seconds of mercy after a hurt
  dashSpeed: 760,
  dashTime: 0.18,
  dashCooldown: 2.2,
  trailLength: 15, // past positions remembered, the tentacles follow them
};

/** Kills inside the window raise the multiplier; it decays when the water goes quiet. */
export const COMBO = { window: 2.6, max: 20 };

export const PEARL = {
  radius: 7,
  score: 5,
  lifetime: 10,
  attract: 110, // base pull radius; the pearl-lure upgrade widens it
  collect: 30,
  dropChance: 0.34,
  heartChance: 0.055, // of drops, the chance the pearl mends one glow instead of scoring
};

/** The bubble ward: charges gained by an upgrade, all refilled every so often. */
export const WARD = { recharge: 12 };

/** A boss rises every this many waves. */
export const BOSS_EVERY = 5;

// Creatures of the trench: hit points, speed, radius, contact damage, score and the wave each kind joins from.
export const FOES = {
  gnawer: { radius: 13, hp: 2, speed: 102, damage: 1, score: 10, fromWave: 1, weight: 10 },
  wisp: { radius: 10, hp: 1, speed: 190, damage: 1, score: 15, fromWave: 2, weight: 7 },
  urchin: { radius: 19, hp: 6, speed: 44, damage: 1, score: 25, fromWave: 3, weight: 5 },
  bloom: { radius: 17, hp: 3, speed: 64, damage: 1, score: 20, fromWave: 4, weight: 6 },
  snapper: { radius: 25, hp: 11, speed: 76, damage: 2, score: 40, fromWave: 6, weight: 4 },
};

export const BOSS = { radius: 62, baseHp: 70, hpPerBoss: 32, speed: 48, score: 500, contactDamage: 2 };

/** How the spawn director builds a wave: how many foes, how fast they pour in, how they grow. */
export const WAVES = {
  first: 7,
  perWave: 2.4,
  maxFoes: 44,
  gapStart: 0.85,
  gapEnd: 0.34,
  hpPerWave: 0.18, // foe hit points grow each wave
  speedPerWave: 3.4,
  bossAdds: 8, // gnawers that trickle in around a boss
  final: 10, // the last wave: clearing it wins the dive
};

/** Pool sizes: everything is preallocated once at boot, so play allocates nothing. */
export const POOLS = { foes: 120, bolts: 150, globs: 120, pearls: 80, motes: 360, floaters: 60, rings: 30 };

export const PALETTE = {
  backdropTop: '#052838',
  backdropBottom: '#010a12',
  ink: '#020a12',
  text: '#e8f6ff',
  muted: '#8fb4c6',
  gold: '#ffd978',
  player: '#6ff2ff',
  playerCore: '#ffffff',
  bolt: '#aef6ff',
  hurt: '#ff5d73',
  heal: '#7dffb0',
  gnawer: '#b48cff',
  wisp: '#a4ff6f',
  urchin: '#ff7a5c',
  bloom: '#ff8ad8',
  snapper: '#ffb35c',
  maw: '#ff4d5e',
  mawLure: '#9ffcff',
  pearl: '#ffe9a8',
  panel: 'rgba(4, 24, 36, 0.86)',
  panelEdge: 'rgba(140, 230, 255, 0.5)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best dive is kept between visits (this browser only). */
export const BEST_KEY = 'glowdeep.best';
