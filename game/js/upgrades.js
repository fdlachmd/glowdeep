// The boons: after each cleared wave the player picks one of three. Each card names one clear
// job, knows how many times it may stack, and applies itself to the world's player. The offer
// is rolled from the world's own seeded random, so a replayed seed offers the same cards.

export const UPGRADES = [
  {
    id: 'twin-volley',
    name: 'Twin Volley',
    blurb: 'One more bolt leaves every volley.',
    accent: '#6ff2ff',
    glyph: 'volley',
    max: 3,
    apply(world) {
      world.player.boltCount += 1;
    },
  },
  {
    id: 'rapid-glow',
    name: 'Rapid Glow',
    blurb: 'Your bell pulses 15% faster.',
    accent: '#a4ff6f',
    glyph: 'rate',
    max: 4,
    apply(world) {
      world.player.fireInterval *= 0.85;
    },
  },
  {
    id: 'shard-bite',
    name: 'Shard Bite',
    blurb: 'Every bolt bites one deeper.',
    accent: '#ffd978',
    glyph: 'damage',
    max: 3,
    apply(world) {
      world.player.boltDamage += 1;
    },
  },
  {
    id: 'piercing-light',
    name: 'Piercing Light',
    blurb: 'Bolts pass through one more foe.',
    accent: '#b48cff',
    glyph: 'pierce',
    max: 2,
    apply(world) {
      world.player.boltPierce += 1;
    },
  },
  {
    id: 'swift-fins',
    name: 'Swift Fins',
    blurb: 'Swim 12% faster through the dark.',
    accent: '#8fd6ff',
    glyph: 'speed',
    max: 3,
    apply(world) {
      world.player.speed *= 1.12;
    },
  },
  {
    id: 'long-reach',
    name: 'Long Reach',
    blurb: 'Bolts fly faster and live longer.',
    accent: '#9ffcff',
    glyph: 'reach',
    max: 3,
    apply(world) {
      world.player.boltSpeed *= 1.18;
      world.player.boltLife += 0.12;
    },
  },
  {
    id: 'heavy-bolts',
    name: 'Heavy Bolts',
    blurb: 'Fatter bolts, wider to touch.',
    accent: '#ffb35c',
    glyph: 'size',
    max: 2,
    apply(world) {
      world.player.boltRadius += 2.5;
    },
  },
  {
    id: 'pearl-lure',
    name: 'Pearl Lure',
    blurb: 'Pearls feel your pull from further off.',
    accent: '#ffe9a8',
    glyph: 'lure',
    max: 3,
    apply(world) {
      world.player.lureRadius += 80;
    },
  },
  {
    id: 'bubble-ward',
    name: 'Bubble Ward',
    blurb: 'A bubble that eats one hit, refilled over time.',
    accent: '#7dd7ff',
    glyph: 'ward',
    max: 3,
    apply(world) {
      world.player.wardMax += 1;
      world.player.ward += 1;
      world.player.wardTimer = 0;
    },
  },
  {
    id: 'mending-current',
    name: 'Mending Current',
    blurb: 'One more glow, mended at once.',
    accent: '#7dffb0',
    glyph: 'heart',
    max: 2,
    apply(world) {
      world.player.maxGlow += 1;
      world.player.glow = Math.min(world.player.maxGlow, world.player.glow + 1);
    },
  },
  {
    id: 'dash-surge',
    name: 'Dash Surge',
    blurb: 'Your dash returns 22% sooner.',
    accent: '#ff8ad8',
    glyph: 'dash',
    max: 3,
    apply(world) {
      world.player.dashCooldown *= 0.78;
    },
  },
  {
    id: 'combo-kept',
    name: 'Combo Kept',
    blurb: 'Your streak lingers 0.7s longer.',
    accent: '#ff7a5c',
    glyph: 'combo',
    max: 3,
    apply(world) {
      world.comboWindow += 0.7;
    },
  },
  {
    id: 'thorn-halo',
    name: 'Thorn Halo',
    blurb: 'When hurt, blast a ring that stings.',
    accent: '#ff5d73',
    glyph: 'thorn',
    max: 1,
    apply(world) {
      world.player.thornHalo = true;
    },
  },
];

const BY_ID = new Map(UPGRADES.map((card) => [card.id, card]));

/** Three distinct cards the player may still take; fewer when the pool has run dry. */
export function rollOffers(random, taken) {
  const pool = UPGRADES.filter((card) => (taken[card.id] ?? 0) < card.max);
  const offers = [];
  while (offers.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    offers.push(pool[index].id);
    pool.splice(index, 1);
  }
  return offers;
}

export function upgradeById(id) {
  return BY_ID.get(id);
}

/** Apply a chosen card to the world and count it. */
export function applyUpgrade(world, id) {
  const card = BY_ID.get(id);
  if (card === undefined) return;
  card.apply(world);
  world.taken[id] = (world.taken[id] ?? 0) + 1;
}
