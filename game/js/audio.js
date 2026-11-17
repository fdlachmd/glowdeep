// Sound, synthesised on the spot with WebAudio: no files, no network, just oscillators and
// noise shaped by short envelopes. Everything stays quiet and low-passed so the trench hums
// instead of beeps. The context is created on the first user gesture (browsers refuse audio
// before one), and M mutes the whole mixer.

export function createAudio() {
  let context = null;
  let master = null;
  let ambient = null;
  let muted = false;

  function unlock() {
    if (context !== null) return;
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (Ctor === undefined) return;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.42;
    master.connect(context.destination);
    startAmbient();
  }

  function startAmbient() {
    // Two detuned low sines and a slow-breathing filter: the pressure of deep water.
    ambient = context.createGain();
    ambient.gain.value = 0.05;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    ambient.connect(filter);
    filter.connect(master);
    for (const [frequency, detune] of [[54, 0], [81.5, 7]]) {
      const voice = context.createOscillator();
      voice.type = 'sine';
      voice.frequency.value = frequency;
      voice.detune.value = detune;
      voice.connect(ambient);
      voice.start();
    }
    const tide = context.createOscillator();
    tide.type = 'sine';
    tide.frequency.value = 0.07;
    const tideDepth = context.createGain();
    tideDepth.gain.value = 0.022;
    tide.connect(tideDepth);
    tideDepth.connect(ambient.gain);
    tide.start();
  }

  /** One shaped tone: a sine or triangle that swells and falls inside `length` seconds. */
  function tone(frequency, length, shape, peak, slideTo) {
    if (context === null) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + length);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + length + 0.05);
  }

  /** A burst of filtered noise, for bursts of pressure: hits, bursts, the maw. */
  function noise(length, cutoff, peak, sweepTo) {
    if (context === null) return;
    const now = context.currentTime;
    const frames = Math.floor(context.sampleRate * length);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo ?? cutoff * 0.3), now + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    isMuted() {
      return muted;
    },
    fire() {
      tone(720, 0.09, 'triangle', 0.10, 380);
    },
    hit() {
      tone(300, 0.06, 'square', 0.05, 210);
    },
    kill(big) {
      noise(big ? 0.5 : 0.22, big ? 900 : 1400, big ? 0.35 : 0.2);
      tone(big ? 130 : 240, big ? 0.4 : 0.16, 'sine', big ? 0.3 : 0.14, big ? 48 : 90);
    },
    pearl() {
      tone(1180, 0.12, 'sine', 0.10, 1560);
    },
    heart() {
      tone(660, 0.3, 'sine', 0.16, 990);
      tone(990, 0.36, 'triangle', 0.08, 1320);
    },
    hurt() {
      tone(160, 0.3, 'sawtooth', 0.24, 62);
      noise(0.28, 500, 0.22, 90);
    },
    dash() {
      noise(0.2, 2400, 0.14, 500);
    },
    ward() {
      tone(520, 0.24, 'sine', 0.18, 260);
      noise(0.16, 1800, 0.1, 400);
    },
    wave() {
      tone(392, 0.16, 'triangle', 0.12);
      setTimeout(() => tone(523, 0.16, 'triangle', 0.12), 110);
      setTimeout(() => tone(659, 0.26, 'triangle', 0.14), 220);
    },
    boss() {
      tone(72, 1.4, 'sawtooth', 0.26, 48);
      noise(1.1, 260, 0.2, 60);
    },
    upgrade() {
      tone(523, 0.14, 'sine', 0.12);
      setTimeout(() => tone(784, 0.14, 'sine', 0.12), 90);
      setTimeout(() => tone(1046, 0.3, 'sine', 0.14), 180);
    },
    over() {
      tone(220, 0.5, 'sine', 0.2, 110);
      setTimeout(() => tone(165, 0.7, 'sine', 0.2, 74), 260);
    },
    victory() {
      const line = [523, 659, 784, 1046];
      line.forEach((frequency, index) => setTimeout(() => tone(frequency, 0.34, 'triangle', 0.13), index * 130));
    },
  };
}
