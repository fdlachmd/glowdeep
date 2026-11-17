// A seeded random source: the same seed replays the same dive, which is what keeps the
// screenshot scenes and a shared challenge reproducible. sfc32 — small, fast, and well mixed
// after its warm-up — seeded through a 32-bit split of the seed so nearby seeds diverge early.

function mix(seed) {
  let a = seed | 0;
  a = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
  a = Math.imul(a ^ (a >>> 15), 0x735a2d97);
  return (a ^ (a >>> 15)) >>> 0;
}

export function createRandom(seed) {
  let a = mix(seed);
  let b = mix(seed + 0x9e3779b9);
  let c = mix(seed + 0x85ebca6b);
  let d = mix(seed + 0xc2b2ae35);
  // Warm the state up so the first draws are already well mixed.
  for (let i = 0; i < 12; i += 1) {
    a = (a + b + d) | 0;
    b = (b + c) | 0;
    c = (c + (a ^ (b >>> 6))) | 0;
    d = (d + (c ^ (a >>> 5) + b)) | 0;
  }
  return function next() {
    a = (a + b) | 0;
    b = (b + c) | 0;
    c = (c + d) | 0;
    d = (d + (a ^ (b >>> 8) + c)) | 0;
    const t = (a ^ (a >>> 9)) >>> 0;
    return (t ^ (t >>> 11)) / 4294967296;
  };
}

/** A float in [lo, hi). */
export function range(random, lo, hi) {
  return lo + random() * (hi - lo);
}

/** An integer in [lo, hi], both ends in. */
export function int(random, lo, hi) {
  return lo + Math.floor(random() * (hi - lo + 1));
}

/** One of the array's members, or undefined when it is empty. */
export function pick(random, items) {
  return items.length === 0 ? undefined : items[Math.floor(random() * items.length)];
}

/** A kind drawn by weight: { weight } fields, higher drawn more often. */
export function weighted(random, entries) {
  let total = 0;
  for (const entry of entries) total += entry.weight;
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}
