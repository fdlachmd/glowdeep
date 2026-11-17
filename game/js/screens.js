// The screens over the water: the title's calm, the pause, the dive's end, and the moment between
// waves when three boons offer themselves. Each is drawn from the world's own state — nothing is
// stored here — and the boon cards publish their rectangles so a click can be told from a keypress
// without the mouse ever knowing more than the pointer's place in the trench.

import { FIELD, FONT, PALETTE } from './config.js';
import { upgradeById } from './upgrades.js';

const W = FIELD.width;
const H = FIELD.height;

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

/** The three boon cards' geometry: drawn here, hit-tested by the loop from the same numbers. */
const CARD = { w: 300, h: 330, gap: 36, y: 214 };

export function cardRect(index) {
  const total = 3 * CARD.w + 2 * CARD.gap;
  const x = (W - total) / 2 + index * (CARD.w + CARD.gap);
  return { x, y: CARD.y, w: CARD.w, h: CARD.h };
}

export function createScreens() {
  function draw(ctx, state, screen, best, muted) {
    if (screen === SCREEN_TITLE) drawTitle(ctx, best);
    else if (screen === SCREEN_PAUSED) drawPaused(ctx);
    else if (screen === SCREEN_OVER) drawOver(ctx, state, best);
    else if (state.phase === 'upgrade' && state.offers !== null) drawUpgrade(ctx, state);
  }

  // --- the title ---------------------------------------------------------------

  function drawTitle(ctx, best) {
    ctx.fillStyle = 'rgba(2, 10, 18, 0.42)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 34;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText('GLOWDEEP', W / 2, 208);
    ctx.shadowBlur = 0;

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 19px ${FONT}`;
    ctx.fillText('a dive among the trench lights', W / 2, 248);

    const lines = [
      'WASD or arrows — swim        mouse — aim',
      'hold click — fire bolts      shift — dash',
      'P — pause        M — sound',
    ];
    ctx.fillStyle = 'rgba(143, 180, 198, 0.85)';
    ctx.font = `500 16px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 330 + i * 30));

    const pulse = 0.62 + 0.38 * Math.sin(Date.now() * 0.004);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO DIVE', W / 2, 470);
    ctx.globalAlpha = 1;

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('ten waves down · the maw rises every fifth · pearls mend the light', W / 2, 516);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 17px ${FONT}`;
      ctx.fillText(`BEST DIVE ${best}`, W / 2, 560);
    }
  }

  // --- the pause -----------------------------------------------------------------

  function drawPaused(ctx) {
    ctx.fillStyle = 'rgba(2, 10, 18, 0.58)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('PAUSED', W / 2, H / 2 - 12);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText('P or Esc to return to the water', W / 2, H / 2 + 30);
  }

  // --- the dive's end --------------------------------------------------------------

  function drawOver(ctx, state, best) {
    ctx.fillStyle = 'rgba(1, 8, 14, 0.74)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    ctx.shadowBlur = 26;
    if (state.victory) {
      ctx.shadowColor = PALETTE.gold;
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 58px ${FONT}`;
      ctx.fillText('THE DIVE IS WON', W / 2, 236);
    } else {
      ctx.shadowColor = PALETTE.hurt;
      ctx.fillStyle = PALETTE.hurt;
      ctx.font = `800 58px ${FONT}`;
      ctx.fillText('THE LIGHT GOES OUT', W / 2, 236);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(String(state.score), W / 2, 316);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('SCORE', W / 2, 340);

    if (state.score > best) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('A NEW BEST DIVE', W / 2, 384);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(`BEST ${best}`, W / 2, 384);
    }

    ctx.fillStyle = 'rgba(143, 180, 198, 0.9)';
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText(`wave ${state.wave} reached · ${state.kills} foes calmed`, W / 2, 428);

    const pulse = 0.62 + 0.38 * Math.sin(Date.now() * 0.004);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 21px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO DIVE AGAIN', W / 2, 496);
    ctx.globalAlpha = 1;
  }

  // --- the boons -----------------------------------------------------------------

  function drawUpgrade(ctx, state) {
    ctx.fillStyle = 'rgba(2, 10, 18, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`WAVE ${state.wave} CLEAR`, W / 2, 108);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText('the trench opens its hoard — choose one boon', W / 2, 140);

    state.offers.forEach((id, index) => {
      const card = upgradeById(id);
      if (card === undefined) return;
      const rect = cardRect(index);
      drawCard(ctx, rect, card, state.taken[id] ?? 0, index);
    });
  }

  function drawCard(ctx, rect, card, taken, index) {
    ctx.save();
    // The panel and its accent edge.
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.shadowColor = card.accent;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = card.accent;
    ctx.lineWidth = 2;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // The glyph: the boon's own small sigil in a ring.
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + 78;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.strokeStyle = faintEdge(card.accent);
    ctx.lineWidth = 2;
    ctx.stroke();
    drawGlyph(ctx, card.glyph, cx, cy, card.accent);

    // The name and its promise.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(card.name, cx, rect.y + 158);
    wrapText(ctx, card.blurb, cx, rect.y + 192, rect.w - 36, 19);

    // What is already taken of this boon.
    for (let i = 0; i < card.max; i += 1) {
      const px = cx - ((card.max - 1) * 16) / 2 + i * 16;
      ctx.beginPath();
      ctx.arc(px, rect.y + 268, 5, 0, Math.PI * 2);
      if (i < taken) {
        ctx.fillStyle = card.accent;
        ctx.fill();
      } else {
        ctx.strokeStyle = faintEdge(card.accent);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(143, 180, 198, 0.8)';
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`PRESS ${index + 1} OR CLICK`, cx, rect.y + rect.h - 22);
    ctx.restore();
  }

  /** The sigils: one small vector drawing per boon, in the boon's own colour. */
  function drawGlyph(ctx, glyph, x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = 15;
    if (glyph === 'volley') {
      for (const off of [-7, 7]) {
        ctx.beginPath();
        ctx.moveTo(off, s);
        ctx.lineTo(off, -s);
        ctx.moveTo(off - 5, -s + 7);
        ctx.lineTo(off, -s);
        ctx.lineTo(off + 5, -s + 7);
        ctx.stroke();
      }
    } else if (glyph === 'rate') {
      for (let i = 0; i < 3; i += 1) {
        const yy = s - i * 10;
        ctx.beginPath();
        ctx.moveTo(-s + i * 3, yy);
        ctx.lineTo(0, yy - 6);
        ctx.lineTo(s - i * 3, yy);
        ctx.stroke();
      }
    } else if (glyph === 'damage') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    } else if (glyph === 'pierce') {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s, 0);
      ctx.moveTo(s - 6, -5);
      ctx.lineTo(s, 0);
      ctx.lineTo(s - 6, 5);
      ctx.stroke();
    } else if (glyph === 'speed') {
      for (let i = 0; i < 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-s + i * 6, -6 + i * 8);
        ctx.quadraticCurveTo(-2 + i * 6, -12 + i * 8, 0, -6 + i * 8);
        ctx.quadraticCurveTo(2 + i * 6, 0 + i * 8, s - i * 2, -6 + i * 8);
        ctx.stroke();
      }
    } else if (glyph === 'reach') {
      ctx.beginPath();
      ctx.moveTo(-s, 4);
      ctx.lineTo(s - 4, -4);
      ctx.moveTo(s - 10, -9);
      ctx.lineTo(s - 4, -4);
      ctx.lineTo(s - 12, 1);
      ctx.stroke();
    } else if (glyph === 'size') {
      ctx.beginPath();
      ctx.arc(-4, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
    } else if (glyph === 'lure') {
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 4, i * 5.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, -6, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (glyph === 'ward') {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-5, -5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (glyph === 'heart') {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 1.2, 0, -s * 0.7, -s, 0, -s * 0.3);
      ctx.bezierCurveTo(s * 0.7, -s, s * 1.2, 0, 0, s * 0.9);
      ctx.fill();
    } else if (glyph === 'dash') {
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-s + i * 11, -6 + i * 6);
        ctx.lineTo(-s + 8 + i * 11, -6 + i * 6);
        ctx.stroke();
      }
    } else if (glyph === 'combo') {
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', 0, 1);
    } else if (glyph === 'thorn') {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle + 0.25) * 7, Math.sin(angle + 0.25) * 7);
        ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
        ctx.lineTo(Math.cos(angle - 0.25) * 7, Math.sin(angle - 0.25) * 7);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- small helpers ---------------------------------------------------------------

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function faintEdge(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.45)`;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let at = y;
    for (const word of words) {
      const trial = line === '' ? word : `${line} ${word}`;
      if (ctx.measureText(trial).width > maxWidth && line !== '') {
        ctx.fillText(line, x, at);
        line = word;
        at += lineHeight;
      } else {
        line = trial;
      }
    }
    if (line !== '') ctx.fillText(line, x, at);
  }

  return { draw };
}
