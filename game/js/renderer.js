// The painter. One job: turn the world's state into light on the canvas — the trench's backdrop,
// the rock rim, the jellyfish and everything that hunts it, and every mote, ring and floater the
// dive leaves behind. It reads the state and draws it; it never reaches into the simulation, and
// it allocates nothing while the game runs: the drifting plankton, the rim's jagged edge and the
// vignette are laid out once at creation and reused every frame. The canvas is scaled so the
// trench's fixed 1280x720 field fills the window as largely as it can, letterboxed in the dark.

import { FIELD, FONT, PALETTE } from './config.js';

const TAU = Math.PI * 2;
const MARGIN = FIELD.margin;
const W = FIELD.width;
const H = FIELD.height;

/** A tiny deterministic generator for the backdrop's fixed scatter (never the game's own random). */
function scatter(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A colour at a fraction of its strength, for the fades. */
function faint(color, alpha) {
  return `rgba(${color}, ${alpha.toFixed(3)})`;
}

/** The rgb triples of the palette's hex colours the painter fades. */
const RGB = {
  player: '111, 242, 255',
  bolt: '174, 246, 255',
  pearl: '255, 233, 168',
  heart: '125, 255, 176',
  hurt: '255, 93, 115',
  gnawer: '180, 140, 255',
  wisp: '164, 255, 111',
  urchin: '255, 122, 92',
  bloom: '255, 138, 216',
  snapper: '255, 179, 92',
  maw: '255, 77, 94',
  lure: '159, 252, 255',
  ward: '125, 215, 255',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 };

  // The plankton that drift through the dark: fixed dots, laid out once, twinkling forever.
  const plankton = [];
  {
    const random = scatter(0x51ac3f);
    for (let i = 0; i < 110; i += 1) {
      plankton.push({
        x: random() * W,
        y: random() * H,
        size: 0.6 + random() * 1.8,
        rise: 4 + random() * 14,
        sway: 6 + random() * 22,
        phase: random() * TAU,
        alpha: 0.05 + random() * 0.16,
      });
    }
  }

  // The rim's jagged inner edge: an offset every 44 pixels along each side, cut once.
  const jags = { top: [], right: [], bottom: [], left: [] };
  {
    const random = scatter(0x2f81b6);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const span = side === 'top' || side === 'bottom' ? W : H;
      const teeth = Math.ceil(span / 44) + 1;
      for (let i = 0; i < teeth; i += 1) jags[side].push((random() - 0.5) * 11);
    }
  }

  let vignette = null;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.dpr = dpr;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    view.scale = Math.min(view.w / W, view.h / H);
    view.ox = (view.w - W * view.scale) / 2;
    view.oy = (view.h - H * view.scale) / 2;
    vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, W * 0.72);
    vignette.addColorStop(0, 'rgba(1, 8, 14, 0)');
    vignette.addColorStop(1, 'rgba(1, 8, 14, 0.62)');
  }

  window.addEventListener('resize', resize);
  resize();

  function fieldTransform(shakeX, shakeY) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.translate(view.ox + shakeX * view.scale, view.oy + shakeY * view.scale);
    ctx.scale(view.scale, view.scale);
  }

  // --- the trench itself -----------------------------------------------------

  let backdrop = null;

  function drawBackdrop(state) {
    if (backdrop === null) {
      backdrop = ctx.createLinearGradient(0, 0, 0, H);
      backdrop.addColorStop(0, PALETTE.backdropTop);
      backdrop.addColorStop(1, PALETTE.backdropBottom);
    }
    ctx.fillStyle = backdrop;
    ctx.fillRect(-14, -14, W + 28, H + 28);

    // Shafts of light from the far surface, swaying slowly.
    for (let i = 0; i < 3; i += 1) {
      const sway = Math.sin(state.time * 0.11 + i * 2.1) * 60;
      const base = 180 + i * 380;
      ctx.fillStyle = `rgba(120, 220, 255, ${0.028 + i * 0.006})`;
      ctx.beginPath();
      ctx.moveTo(base + sway, -14);
      ctx.lineTo(base + 130 + sway, -14);
      ctx.lineTo(base + 330 + sway * 1.6, H + 14);
      ctx.lineTo(base + 60 + sway * 1.6, H + 14);
      ctx.closePath();
      ctx.fill();
    }

    // Plankton: rising, swaying, twinkling.
    for (const dot of plankton) {
      const y = ((dot.y - state.time * dot.rise) % (H + 40) + H + 40) % (H + 40) - 20;
      const x = dot.x + Math.sin(state.time * 0.4 + dot.phase) * dot.sway;
      const twinkle = 0.6 + 0.4 * Math.sin(state.time * 1.7 + dot.phase * 3);
      ctx.fillStyle = faint('150, 220, 255', dot.alpha * twinkle);
      ctx.beginPath();
      ctx.arc(x, y, dot.size, 0, TAU);
      ctx.fill();
    }
  }

  function jaggedRim(side) {
    const teeth = jags[side];
    ctx.beginPath();
    if (side === 'top') {
      ctx.moveTo(-14, -14);
      ctx.lineTo(W + 14, -14);
      for (let i = teeth.length - 1; i >= 0; i -= 1) ctx.lineTo((i / (teeth.length - 1)) * W, MARGIN + teeth[i]);
    } else if (side === 'bottom') {
      ctx.moveTo(-14, H + 14);
      ctx.lineTo(W + 14, H + 14);
      for (let i = teeth.length - 1; i >= 0; i -= 1) ctx.lineTo((i / (teeth.length - 1)) * W, H - MARGIN + teeth[i]);
    } else if (side === 'left') {
      ctx.moveTo(-14, -14);
      ctx.lineTo(-14, H + 14);
      for (let i = teeth.length - 1; i >= 0; i -= 1) ctx.lineTo(MARGIN + teeth[i], (i / (teeth.length - 1)) * H);
    } else {
      ctx.moveTo(W + 14, -14);
      ctx.lineTo(W + 14, H + 14);
      for (let i = teeth.length - 1; i >= 0; i -= 1) ctx.lineTo(W - MARGIN + teeth[i], (i / (teeth.length - 1)) * H);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawRim() {
    ctx.fillStyle = '#04101b';
    jaggedRim('top');
    jaggedRim('bottom');
    jaggedRim('left');
    jaggedRim('right');
    // A faint edge of bioluminescent moss where rock meets water.
    ctx.strokeStyle = 'rgba(140, 230, 255, 0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  }

  // --- what the dive leaves behind -------------------------------------------

  function drawMotes(state) {
    for (const mote of state.motes) {
      if (!mote.active) continue;
      const fade = mote.life / mote.maxLife;
      ctx.fillStyle = faint(rgbOf(mote.color), fade * fade);
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size * (0.4 + 0.6 * fade), 0, TAU);
      ctx.fill();
    }
  }

  /** A hex colour's rgb triple, for fading; the palette's own colours are all in RGB above. */
  const rgbCache = new Map();
  function rgbOf(hex) {
    let rgb = rgbCache.get(hex);
    if (rgb === undefined) {
      const n = parseInt(hex.slice(1), 16);
      rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
      rgbCache.set(hex, rgb);
    }
    return rgb;
  }

  function drawRings(state) {
    for (const ring of state.rings) {
      if (!ring.active) continue;
      const fade = ring.life / ring.maxLife;
      ctx.strokeStyle = faint(rgbOf(ring.color), fade * 0.85);
      ctx.lineWidth = ring.width * (0.5 + fade);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, Math.max(1, ring.radius), 0, TAU);
      ctx.stroke();
    }
  }

  function drawFloaters(state) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of state.floaters) {
      if (!floater.active) continue;
      const fade = Math.min(1, floater.life / 0.9);
      ctx.globalAlpha = fade;
      ctx.font = `700 ${floater.size}px ${FONT}`;
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.globalAlpha = 1;
    }
  }

  // --- the dive's things ------------------------------------------------------

  function drawPearls(state) {
    for (const pearl of state.pearls) {
      if (!pearl.active) continue;
      const bob = Math.sin(pearl.age * 3.1) * 2;
      const blink = pearl.life < 2 ? 0.45 + 0.55 * Math.abs(Math.sin(pearl.life * 9)) : 1;
      ctx.globalAlpha = blink;
      if (pearl.heart) {
        ctx.shadowColor = PALETTE.heal;
        ctx.shadowBlur = 14;
        ctx.fillStyle = PALETTE.heal;
      } else {
        ctx.shadowColor = PALETTE.pearl;
        ctx.shadowBlur = 12;
        ctx.fillStyle = PALETTE.pearl;
      }
      ctx.beginPath();
      ctx.arc(pearl.x, pearl.y + bob, PEARL_R, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(pearl.x - 2.2, pearl.y + bob - 2.4, 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  const PEARL_R = 7;

  function drawGlobs(state) {
    for (const glob of state.globs) {
      if (!glob.active) continue;
      const wobble = glob.radius * (1 + 0.14 * Math.sin(glob.life * 17));
      ctx.fillStyle = 'rgba(214, 255, 158, 0.9)';
      ctx.beginPath();
      ctx.arc(glob.x, glob.y, wobble, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(64, 96, 24, 0.8)';
      ctx.beginPath();
      ctx.arc(glob.x, glob.y, wobble * 0.45, 0, TAU);
      ctx.fill();
    }
  }

  function drawBolts(state) {
    ctx.lineCap = 'round';
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      const pace = Math.hypot(bolt.vx, bolt.vy) || 1;
      const tailX = bolt.x - (bolt.vx / pace) * bolt.radius * 3.4;
      const tailY = bolt.y - (bolt.vy / pace) * bolt.radius * 3.4;
      ctx.strokeStyle = faint(RGB.bolt, 0.5);
      ctx.lineWidth = bolt.radius * 1.2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
      ctx.shadowColor = PALETTE.bolt;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PALETTE.bolt;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, TAU);
      ctx.fill();
    }
  }

  // --- the trench's creatures --------------------------------------------------

  function flashOverlay(x, y, radius, flash) {
    if (flash <= 0) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, (flash / 0.09) * 0.8)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function hpArc(foe) {
    if (foe.hp >= foe.maxHp || foe.maxHp < 4) return;
    const frac = Math.max(0, foe.hp / foe.maxHp);
    ctx.strokeStyle = 'rgba(2, 10, 18, 0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(foe.x, foe.y - foe.radius - 9, foe.radius * 0.62, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.5 ? PALETTE.text : PALETTE.hurt;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(foe.x, foe.y - foe.radius - 9, foe.radius * 0.62, -Math.PI * 0.85, -Math.PI * 0.85 + Math.PI * 0.7 * frac);
    ctx.stroke();
  }

  function drawFoes(state) {
    for (const foe of state.foes) {
      if (!foe.active) continue;
      const face = Math.atan2(foe.vy, foe.vx);
      if (foe.kind === 'gnawer') drawGnawer(foe, face);
      else if (foe.kind === 'wisp') drawWisp(foe, face);
      else if (foe.kind === 'urchin') drawUrchin(foe);
      else if (foe.kind === 'bloom') drawBloom(foe);
      else if (foe.kind === 'snapper') drawSnapper(foe, face);
      else if (foe.kind === 'maw') drawMaw(foe);
      else drawGnawer(foe, face);
      flashOverlay(foe.x, foe.y, foe.radius, foe.flash);
      hpArc(foe);
    }
  }

  function drawGnawer(foe, face) {
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.rotate(face);
    ctx.fillStyle = PALETTE.gnawer;
    ctx.beginPath();
    ctx.ellipse(0, 0, foe.radius, foe.radius * 0.82, 0, 0, TAU);
    ctx.fill();
    // A tail fin flicking behind.
    ctx.beginPath();
    ctx.moveTo(-foe.radius * 0.7, 0);
    ctx.lineTo(-foe.radius * 1.5, -foe.radius * 0.5 + Math.sin(foe.age * 9) * 3);
    ctx.lineTo(-foe.radius * 1.5, foe.radius * 0.5 + Math.sin(foe.age * 9) * 3);
    ctx.closePath();
    ctx.fill();
    // The gnawing mouth: a wedge of teeth on the nose.
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(foe.radius * 0.95, 0);
    ctx.lineTo(foe.radius * 0.2, -foe.radius * 0.42);
    ctx.lineTo(foe.radius * 0.2, foe.radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(foe.radius * 0.9, i * foe.radius * 0.22);
      ctx.lineTo(foe.radius * 0.45, i * foe.radius * 0.22 - 2.6);
      ctx.lineTo(foe.radius * 0.45, i * foe.radius * 0.22 + 2.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(foe.radius * 0.1, -foe.radius * 0.4, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawWisp(foe, face) {
    // A comet: a bright head and a tail of fading light opposite its pace.
    for (let i = 3; i >= 1; i -= 1) {
      const back = foe.radius * 1.7 * i;
      ctx.fillStyle = faint(RGB.wisp, 0.42 - i * 0.11);
      ctx.beginPath();
      ctx.arc(foe.x - Math.cos(face) * back, foe.y - Math.sin(face) * back, foe.radius * (0.75 - i * 0.16), 0, TAU);
      ctx.fill();
    }
    ctx.shadowColor = PALETTE.wisp;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.wisp;
    ctx.beginPath();
    ctx.arc(foe.x, foe.y, foe.radius, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(foe.x + Math.cos(face) * foe.radius * 0.35, foe.y + Math.sin(face) * foe.radius * 0.35, 2.2, 0, TAU);
    ctx.fill();
  }

  function drawUrchin(foe) {
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.rotate(foe.angle);
    ctx.fillStyle = PALETTE.urchin;
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * TAU;
      const reach = foe.radius * (1.05 + 0.12 * Math.sin(foe.age * 5 + i));
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle + 0.16) * foe.radius * 0.5, Math.sin(angle + 0.16) * foe.radius * 0.5);
      ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      ctx.lineTo(Math.cos(angle - 0.16) * foe.radius * 0.5, Math.sin(angle - 0.16) * foe.radius * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#a34430';
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBloom(foe) {
    ctx.save();
    ctx.translate(foe.x, foe.y);
    const petals = 7;
    for (let i = 0; i < petals; i += 1) {
      const angle = (i / petals) * TAU + foe.age * 0.5;
      const out = foe.radius * 0.78 * (1 + 0.16 * Math.sin(foe.age * 3 + i * 1.7));
      ctx.fillStyle = faint(RGB.bloom, 0.75);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * out, Math.sin(angle) * out, foe.radius * 0.42, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.bloom;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius * 0.62, 0, TAU);
    ctx.fill();
    // Its eye, wide and unblinking, tracks the jellyfish it spits at.
    const eye = Math.atan2(state_playerY - foe.y, state_playerX - foe.x);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(Math.cos(eye) * 3, Math.sin(eye) * 3, foe.radius * 0.26, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawSnapper(foe, face) {
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.rotate(face);
    const warning = foe.phase === 1 ? 0.5 + 0.5 * Math.sin(foe.age * 26) : 0;
    ctx.fillStyle = warning > 0.5 ? '#ffe0b0' : PALETTE.snapper;
    // Body, tail and dorsal fin.
    ctx.beginPath();
    ctx.ellipse(0, 0, foe.radius * 1.18, foe.radius * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-foe.radius * 0.9, 0);
    ctx.lineTo(-foe.radius * 1.65, -foe.radius * 0.55);
    ctx.lineTo(-foe.radius * 1.65, foe.radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-foe.radius * 0.2, -foe.radius * 0.7);
    ctx.lineTo(foe.radius * 0.25, -foe.radius * 1.25);
    ctx.lineTo(foe.radius * 0.55, -foe.radius * 0.62);
    ctx.closePath();
    ctx.fill();
    // The jaw: shut while it stalks, ajar while it warns, wide when it lunges.
    const open = foe.phase === 2 ? 0.62 : foe.phase === 1 ? 0.2 : 0.06;
    ctx.fillStyle = '#8a4a1e';
    ctx.beginPath();
    ctx.moveTo(foe.radius * 1.1, 0);
    ctx.lineTo(foe.radius * 0.35, -foe.radius * 0.15 - Math.sin(open) * foe.radius * 0.85);
    ctx.lineTo(foe.radius * 0.35, foe.radius * 0.15 + Math.sin(open) * foe.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    for (let i = 0; i < 3; i += 1) {
      const along = foe.radius * (0.5 + i * 0.24);
      const gap = Math.sin(open) * foe.radius * 0.8;
      ctx.beginPath();
      ctx.moveTo(along + 3, 0);
      ctx.lineTo(along, -gap * 0.5);
      ctx.lineTo(along - 3, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(foe.radius * 0.35, -foe.radius * 0.42, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMaw(foe) {
    const hurt = 1 - foe.hp / foe.maxHp;
    const pulse = 1 + 0.04 * Math.sin(foe.age * 3.2) + hurt * 0.05 * Math.sin(foe.age * 9);
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.scale(pulse, pulse);
    // The lure: a cold light on a stalk, the trench's cruellest fishing hook.
    const lureBob = Math.sin(foe.age * 2.2) * 8;
    ctx.strokeStyle = 'rgba(159, 252, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -foe.radius * 0.7);
    ctx.quadraticCurveTo(foe.radius * 0.5, -foe.radius * 1.25, foe.radius * 0.2, -foe.radius * 1.45 + lureBob);
    ctx.stroke();
    ctx.shadowColor = PALETTE.mawLure;
    ctx.shadowBlur = 22;
    ctx.fillStyle = PALETTE.mawLure;
    ctx.beginPath();
    ctx.arc(foe.radius * 0.2, -foe.radius * 1.45 + lureBob, 7, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // The body: a dark sphere ringed with teeth.
    const body = ctx.createRadialGradient(0, -foe.radius * 0.3, foe.radius * 0.2, 0, 0, foe.radius);
    body.addColorStop(0, '#8a2536');
    body.addColorStop(1, '#3d0d18');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.maw;
    const teeth = 14;
    for (let i = 0; i < teeth; i += 1) {
      const angle = (i / teeth) * TAU + foe.age * 0.35;
      const inner = foe.radius * 0.52;
      const outer = foe.radius * 0.94;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle + 0.09) * inner, Math.sin(angle + 0.09) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle - 0.09) * inner, Math.sin(angle - 0.09) * inner);
      ctx.closePath();
      ctx.fill();
    }
    // The mouth itself, widening as it weakens.
    const maw = foe.radius * (0.3 + hurt * 0.16);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.ellipse(0, foe.radius * 0.08, maw, maw * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // --- the jellyfish -----------------------------------------------------------

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invuln > 0 ? (Math.sin(state.time * 30) > -0.3 ? 1 : 0.3) : 1;
    ctx.globalAlpha = blink;

    // The tentacles follow the bell's past, swaying as they go.
    const tail = p.trail[(p.trailIndex + 1) % p.trail.length];
    let backX = tail.x - p.x;
    let backY = tail.y - p.y;
    let back = Math.hypot(backX, backY);
    if (back < 8) {
      backX = 0;
      backY = 1;
      back = 1;
    }
    backX /= back;
    backY /= back;
    ctx.lineCap = 'round';
    for (let strand = 0; strand < 5; strand += 1) {
      const side = (strand - 2) / 2;
      ctx.strokeStyle = faint(RGB.player, 0.55 - Math.abs(side) * 0.18);
      ctx.lineWidth = 2.4 - Math.abs(side) * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + backY * side * p.radius * 0.5, p.y - backX * side * p.radius * 0.5);
      for (let step = 1; step <= 4; step += 1) {
        const spot = p.trail[(p.trailIndex + step * 3) % p.trail.length];
        const sway = Math.sin(state.time * 7 + strand * 1.9 + step * 0.9) * 3.4 * step * 0.4;
        const along = (step / 4) * Math.min(back, 46);
        ctx.lineTo(spot.x + backY * sway - backX * along * 0.2, spot.y - backX * sway - backY * along * 0.2);
      }
      ctx.stroke();
    }

    // The bell: a glowing dome, facing where it swims.
    const pace = Math.hypot(p.vx, p.vy);
    const face = pace > 12 ? Math.atan2(p.vy, p.vx) : Math.sin(state.time * 0.8) * 0.4;
    const pulse = 1 + 0.05 * Math.sin(state.time * 5.2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(face);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 20;
    const bell = ctx.createRadialGradient(p.radius * 0.35, 0, 1, 0, 0, p.radius * 1.1 * pulse);
    bell.addColorStop(0, PALETTE.playerCore);
    bell.addColorStop(0.55, PALETTE.player);
    bell.addColorStop(1, 'rgba(111, 242, 255, 0.25)');
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * pulse, -Math.PI * 0.62, Math.PI * 0.62);
    ctx.quadraticCurveTo(-p.radius * 0.2, p.radius * 0.5 * Math.sin(state.time * 6), -p.radius * 0.55, 0);
    ctx.quadraticCurveTo(-p.radius * 0.2, -p.radius * 0.5 * Math.sin(state.time * 6), Math.cos(-Math.PI * 0.62) * p.radius * pulse, Math.sin(-Math.PI * 0.62) * p.radius * pulse);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(p.radius * 0.3, 0, p.radius * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();

    // The bubble ward: charged bubbles circling the bell.
    for (let i = 0; i < p.ward; i += 1) {
      const angle = state.time * 1.4 + (i / Math.max(1, p.wardMax)) * TAU;
      ctx.fillStyle = faint(RGB.ward, 0.85);
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(angle) * (p.radius + 11), p.y + Math.sin(angle) * (p.radius + 11), 4, 0, TAU);
      ctx.fill();
    }
    if (p.wardMax > 0 && p.ward < p.wardMax) {
      // The next bubble, filling as it recharges.
      const frac = p.wardTimer / 12;
      ctx.strokeStyle = faint(RGB.ward, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(state.time * 1.4) * (p.radius + 11), p.y + Math.sin(state.time * 1.4) * (p.radius + 11), 4, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.stroke();
    }
    if (p.thornHalo) {
      ctx.strokeStyle = faint(RGB.hurt, 0.6);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -state.time * 26;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (p.dashActive > 0) {
      for (let i = 1; i <= 3; i += 1) {
        ctx.strokeStyle = faint(RGB.player, 0.4 - i * 0.1);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dashDirX * i * 14, p.y - p.dashDirY * i * 14);
        ctx.lineTo(p.x - p.dashDirX * (i * 14 + 10), p.y - p.dashDirY * (i * 14 + 10));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawAim(state) {
    const pulse = 1 + 0.12 * Math.sin(state.time * 4.6);
    ctx.strokeStyle = faint(RGB.bolt, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.aimX, state.aimY, 9 * pulse, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const angle = i * (TAU / 4) + state.time * 0.7;
      ctx.beginPath();
      ctx.moveTo(state.aimX + Math.cos(angle) * 12 * pulse, state.aimY + Math.sin(angle) * 12 * pulse);
      ctx.lineTo(state.aimX + Math.cos(angle) * 17 * pulse, state.aimY + Math.sin(angle) * 17 * pulse);
      ctx.stroke();
    }
  }

  // --- the frame ----------------------------------------------------------------

  // The bloom's eye needs the player's position; kept beside the draw loop, never in the world.
  let state_playerX = 0;
  let state_playerY = 0;

  function draw(state) {
    state_playerX = state.player.x;
    state_playerY = state.player.y;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, view.w, view.h);

    let shakeX = 0;
    let shakeY = 0;
    if (state.shake > 0.2) {
      const wobble = state.time * 47;
      shakeX = Math.sin(wobble * 1.7) * state.shake * 0.55;
      shakeY = Math.cos(wobble * 2.3) * state.shake * 0.45;
    }

    fieldTransform(shakeX, shakeY);
    drawBackdrop(state);
    drawRim();
    drawPearls(state);
    drawGlobs(state);
    drawFoes(state);
    drawBolts(state);
    drawPlayer(state);
    drawMotes(state);
    drawRings(state);
    drawFloaters(state);
    drawAim(state);

    fieldTransform(0, 0);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  return { draw };
}
