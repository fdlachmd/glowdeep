// The dive's instruments, drawn over the water: the score and its best, the wave and what still
// swims in it, the combo and the seconds it has left, the jellyfish's glow, the dash and the
// bubble ward. Everything reads straight from the world's state each frame, so the HUD can never
// disagree with the water. The banner — WAVE 4, THE MAW RISES — is the world's own voice, and the
// low-glow pulse is the frame's last warning.

import { FIELD, FONT, PALETTE } from './config.js';

const W = FIELD.width;
const H = FIELD.height;

export function createHud() {
  function draw(ctx, state, best, muted) {
    const p = state.player;

    // --- score, top left -------------------------------------------------------
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('SCORE', 30, 34);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(String(state.score), 30, 64);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`BEST ${best}`, 30, 84);

    // --- wave, top centre ------------------------------------------------------
    let adrift = state.spawnQueue.length;
    for (const foe of state.foes) if (foe.active) adrift += 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 21px ${FONT}`;
    ctx.fillText(state.wave > 0 ? `WAVE ${state.wave}` : 'THE TRENCH', W / 2, 44);
    if (state.phase === 'active' && adrift > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText(`${adrift} ADRIFT`, W / 2, 62);
    }

    // --- combo, top right ------------------------------------------------------
    if (state.combo > 1) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText(`COMBO ×${state.combo}`, W - 30, 48);
      const frac = Math.max(0, Math.min(1, state.comboTimer / state.comboWindow));
      ctx.fillStyle = 'rgba(255, 217, 120, 0.25)';
      ctx.fillRect(W - 30 - 110, 58, 110, 5);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(W - 30 - 110 * frac, 58, 110 * frac, 5);
    }

    // --- glow, bottom left -----------------------------------------------------
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('GLOW', 30, H - 40);
    for (let i = 0; i < p.maxGlow; i += 1) {
      const x = 34 + i * 26;
      const y = H - 22;
      const filled = i < p.glow;
      const last = filled && p.glow === 1;
      const beat = last ? 1 + 0.18 * Math.sin(state.time * 9) : 1;
      drawHeart(ctx, x, y, 9 * beat, filled ? PALETTE.heal : 'rgba(143, 180, 198, 0.35)', last);
    }

    // --- dash and ward, bottom right -------------------------------------------
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('DASH', W - 30, H - 40);
    const ready = p.dashTimer <= 0;
    const frac = ready ? 1 : 1 - Math.max(0, p.dashTimer) / p.dashCooldown;
    ctx.fillStyle = 'rgba(143, 180, 198, 0.22)';
    ctx.fillRect(W - 30 - 120, H - 34, 120, 7);
    ctx.fillStyle = ready ? PALETTE.player : 'rgba(111, 242, 255, 0.4)';
    ctx.fillRect(W - 30 - 120 * frac, H - 34, 120 * frac, 7);
    if (ready) {
      ctx.fillStyle = PALETTE.player;
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText('READY', W - 30 - 128, H - 27);
    }
    if (p.wardMax > 0) {
      for (let i = 0; i < p.wardMax; i += 1) {
        const x = W - 38 - i * 22;
        const charged = i < p.ward;
        ctx.beginPath();
        ctx.arc(x, H - 58, 7, 0, Math.PI * 2);
        if (charged) {
          ctx.fillStyle = 'rgba(125, 215, 255, 0.9)';
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(125, 215, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 11px ${FONT}`;
      ctx.fillText('WARD', W - 30 - p.wardMax * 22 - 14, H - 54);
    }

    // --- the banner --------------------------------------------------------------
    if (state.banner.timer > 0 && state.banner.text !== '') {
      const alpha = Math.min(1, state.banner.timer * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 46px ${FONT}`;
      ctx.shadowColor = PALETTE.player;
      ctx.shadowBlur = 24;
      ctx.fillText(state.banner.text, W / 2, H * 0.3);
      ctx.restore();
    }

    // --- the frame's last warning ------------------------------------------------
    if (p.glow === 1 && state.phase === 'active') {
      const pulse = 0.25 + 0.2 * Math.sin(state.time * 7);
      ctx.strokeStyle = `rgba(255, 93, 115, ${pulse.toFixed(3)})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }

    // --- the keys, quiet along the bottom ----------------------------------------
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(143, 180, 198, 0.6)';
    ctx.font = `500 12px ${FONT}`;
    const sound = muted ? 'M SOUND OFF' : 'M SOUND ON';
    ctx.fillText(`WASD SWIM · MOUSE AIM · HOLD TO FIRE · SHIFT DASH · P PAUSE · ${sound}`, W / 2, H - 12);
  }

  /** A small heart: two arcs and a point, filled or hollow. */
  function drawHeart(ctx, x, y, size, color, beat) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(beat, beat);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.9);
    ctx.bezierCurveTo(-size * 1.1, size * 0.1, -size * 0.65, -size * 0.9, 0, -size * 0.25);
    ctx.bezierCurveTo(size * 0.65, -size * 0.9, size * 1.1, size * 0.1, 0, size * 0.9);
    if (color.startsWith('rgba')) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  return { draw };
}
