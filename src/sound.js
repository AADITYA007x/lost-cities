// Generative sound, made live with the Web Audio API: no recordings are used.
// Wind, the river, rain and thunder, birds by day and crickets at night, a murmur of
// people and the tapping of workshops near you, and a quiet imagined music.
// What music sounded like in the Indus cities is not known.

const PENTA = [146.83, 164.81, 196.0, 220.0, 261.63, 293.66]; // D3 E3 G3 A3 C4 D4

export function createSound() {
  let ctx = null;
  let on = false;
  let master = null;
  let n = null; // named nodes
  let nextBird = 0;
  let nextPluck = 0;
  let nextThunder = 0;
  let nextTap = 0;

  function noiseBuffer(seconds = 2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // a looping noise source through a chain of filters into its own gain
  function noiseLayer(buffer, filters) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = Math.random();
    let node = src;
    const made = filters.map(([type, freq, q]) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      node.connect(f);
      node = f;
      return f;
    });
    const gain = ctx.createGain();
    gain.gain.value = 0;
    node.connect(gain);
    gain.connect(master);
    src.start();
    return { gain, filters: made };
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp);

    const noise = noiseBuffer(3);
    n = {
      wind: noiseLayer(noise, [['bandpass', 420, 0.5], ['lowpass', 1400]]),
      river: noiseLayer(noise, [['lowpass', 320], ['lowpass', 500]]),
      rain: noiseLayer(noise, [['highpass', 450], ['lowpass', 3200], ['lowpass', 4500]]),
      murmur: noiseLayer(noise, [['bandpass', 520, 1.6], ['lowpass', 1200]]),
    };

    // crickets: a high tone gated in quick pulses
    const cr = ctx.createOscillator();
    cr.frequency.value = 4400;
    const gate = ctx.createGain();
    gate.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 28;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    const offset = ctx.createConstantSource();
    offset.offset.value = 0.5;
    lfo.connect(lfoGain).connect(gate.gain);
    offset.connect(gate.gain);
    const crGain = ctx.createGain();
    crGain.gain.value = 0;
    cr.connect(gate).connect(crGain).connect(master);
    cr.start();
    lfo.start();
    offset.start();
    n.crickets = { gain: crGain };

    // a low drone under the music
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 320;
    for (const f of [73.42, 110.0, 146.83]) {
      const o = ctx.createOscillator();
      o.type = f === 73.42 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.value = f === 73.42 ? 0.5 : 0.3;
      o.connect(g).connect(droneFilter);
      o.start();
    }
    droneFilter.connect(droneGain).connect(master);
    n.drone = { gain: droneGain, filter: droneFilter };

    // a soft, warm reverb: a long tail of noise that fades and darkens
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const a = 0.25 + 0.7 * k; // later in the tail, darker
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * Math.pow(1 - k, 2.4);
      }
    }
    verb.buffer = ir;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.9;
    verb.connect(verbOut).connect(master);
    n.verb = verb;
    droneGain.connect(verb);

    // a little echo for plucks and birds
    const echo = ctx.createDelay(1.5);
    echo.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    echo.connect(fb).connect(echo);
    echo.connect(wet).connect(master);
    n.echo = echo;
    n.noise = noise;
  }

  const now = () => ctx.currentTime;
  // glide a value; earlier glides are replaced, not stacked
  const set = (param, value, time = 1.5) => {
    const t = now();
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else param.cancelScheduledValues(t);
    param.setTargetAtTime(value, t, time);
  };
  let lastMix = -1;

  // a plucked string (Karplus-Strong: a burst of noise ringing in a short feedback delay)
  function pluck(freq, level) {
    const t = now();
    const burst = ctx.createBufferSource();
    burst.buffer = n.noise;
    // a soft excitation: low-passed noise that fades in and out (like a fingertip, not a pick)
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = freq * 3;
    soft.Q.value = -6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.008);
    env.gain.linearRampToValueAtTime(0, t + 0.03);
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 1 / freq;
    // the classic averaging filter: it never boosts, so the loop always dies away
    const damp = ctx.createIIRFilter([0.5, 0.5], [1]);
    const loop = ctx.createGain();
    loop.gain.value = 0.992;
    // a gentle tone control after the string, then a slow fade
    const mellow = ctx.createBiquadFilter();
    mellow.type = 'lowpass';
    mellow.frequency.value = 900;
    mellow.Q.value = -6;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    burst.connect(soft).connect(env).connect(delay);
    delay.connect(damp).connect(loop).connect(delay);
    delay.connect(mellow).connect(out);
    out.connect(master);
    out.connect(n.verb);
    burst.start(t, Math.random(), 0.04);
    setTimeout(() => {
      loop.disconnect();
      out.disconnect();
    }, 6500);
  }

  // a bird: a few quick rising whistles
  function bird(level) {
    const t0 = now();
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1600;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(master);
    out.connect(n.verb);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.08);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.1);
    }
    setTimeout(() => out.disconnect(), 2000);
  }

  // distant thunder: a long, low roll of filtered noise
  function thunder(level) {
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = n.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    src.connect(lp).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + 6.2);
  }

  // a tap of a tool on stone or shell
  function tap(level) {
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = n.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 1500;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(bp).connect(g).connect(master);
    src.start(t, Math.random(), 0.1);
  }

  return {
    get on() {
      return on;
    },
    get state() {
      return ctx ? ctx.state : 'none';
    },
    // must be called from a click or tap (browsers only allow sound after one)
    enable(value) {
      on = value;
      if (on && !ctx) build();
      if (!ctx) return;
      if (on) ctx.resume();
      set(master.gain, on ? 0.9 : 0, on ? 1.2 : 0.4);
      if (!on) setTimeout(() => !on && ctx.suspend(), 1500);
    },
    // a snapshot of where we are and what is around us
    update(s) {
      if (!on || !ctx || ctx.state !== 'running') return;
      const t = now();
      // the slow layers are re-mixed four times a second; one-shot sounds are timed below
      const remix = t - lastMix > 0.25;
      if (remix) lastMix = t;
      const living = s.living; // the city is alive (not buried or excavated)
      const day = s.day;
      const night = 1 - day;
      const height = Math.max(0, s.height);
      const high = Math.min(1, height / 600);

      if (remix) {
        // wind: stronger up high, a little gusty
        const gust = 0.6 + 0.4 * Math.sin(t * 0.13) * Math.sin(t * 0.071 + 1);
        set(n.wind.gain.gain, (0.05 + 0.2 * high + 0.12 * s.rain) * gust, 2);
        set(n.wind.filters[0].frequency, 300 + 500 * high + 120 * gust, 2);
        // the river, near it
        set(n.river.gain.gain, 0.22 * Math.max(0, 1 - s.riverDist / 700) * (1 - 0.6 * high), 2);
        // rain
        set(n.rain.gain.gain, 0.05 * s.rain, 2);
        // people: a low murmur when close to the streets by day
        const near = Math.max(0, 1 - height / 120);
        set(n.murmur.gain.gain, living ? 0.05 * near * day * s.population * (1 - s.rain) : 0, 2);
        // crickets at night
        set(n.crickets.gain.gain, 0.006 * night * (1 - s.rain) * (1 - high * 0.7), 2);
        // the imagined music: a soft drone, and now and then a plucked note
        set(n.drone.gain.gain, living ? 0.022 * (0.6 + 0.4 * night) : 0.006, 4);
        set(n.drone.filter.frequency, 240 + 80 * Math.sin(t * 0.04), 4);
      }

      if (t > nextPluck) {
        nextPluck = t + 4 + Math.random() * 7;
        if (living && Math.random() < 0.8) {
          const k = Math.floor(Math.random() * PENTA.length);
          pluck(PENTA[k], 0.055);
          if (Math.random() < 0.3) setTimeout(() => on && pluck(PENTA[(k + 2) % PENTA.length], 0.04), 650);
        }
      }
      if (t > nextBird) {
        nextBird = t + 1.5 + Math.random() * 7;
        if (day > 0.3 && s.rain < 0.3) bird(0.025 * day * (1 - high * 0.6));
      }
      if (s.rain > 0.5 && t > nextThunder) {
        nextThunder = t + 12 + Math.random() * 25;
        thunder(0.18 * s.rain);
      }
      if (living && s.craftDist < 30 && day > 0.25 && s.rain < 0.35 && t > nextTap) {
        nextTap = t + 0.35 + Math.random() * 0.5;
        tap(0.05 * (1 - s.craftDist / 30));
      }
    },
    // wake the sound again if the browser paused it while the tab was hidden
    resume() {
      if (ctx && on && ctx.state !== 'running') ctx.resume();
    },
  };
}
