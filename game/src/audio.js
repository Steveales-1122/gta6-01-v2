// Synthesized sound. One job: every effect and the music loop, made with
// the Web Audio API alone — no audio files, no network.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.sirenOn = false;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  // Browsers only allow audio after a user gesture; call from one.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      this._startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  blip(freq = 880) {
    this._tone(freq, 0.12, 'sine', 0.25);
    this._tone(freq * 1.5, 0.1, 'sine', 0.15, 0.06);
  }

  coin() {
    this._tone(1320, 0.09, 'square', 0.12);
    this._tone(1760, 0.16, 'square', 0.12, 0.08);
  }

  crash(strength = 1) {
    if (!this.ctx || this.muted) return;
    const dur = 0.18 + 0.12 * strength;
    const t0 = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.3 * strength;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    this._tone(90, 0.2, 'sine', 0.3, 0, 45);
  }

  punch() {
    this._tone(220, 0.08, 'square', 0.2, 0, 110);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.2, i * 0.11));
  }

  wantedUp() {
    this._tone(440, 0.14, 'sawtooth', 0.14, 0, 660);
    this._tone(660, 0.14, 'sawtooth', 0.14, 0.12, 440);
  }

  // Continuous engine hum whose pitch follows the player's speed.
  _startEngine() {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 50;
    g.gain.value = 0;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    osc.connect(f);
    f.connect(g);
    g.connect(this.master);
    osc.start();
    this._engineOsc = osc;
    this._engineGain = g;
  }

  setEngine(speed01, on) {
    if (!this._engineOsc) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(on ? 0.05 + 0.05 * speed01 : 0, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(48 + 130 * speed01, t, 0.08);
  }

  // Two-tone police siren while any police car is near.
  setSiren(on) {
    if (on === this.sirenOn || !this.ctx) return;
    this.sirenOn = on;
    if (on) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 700;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 1.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      lfo.start();
      this._sirenOsc = osc;
      this._sirenLfo = lfo;
      this._sirenGain = g;
    } else if (this._sirenOsc) {
      try {
        this._sirenOsc.stop();
        this._sirenLfo.stop();
      } catch {
        // Already stopped.
      }
      this._sirenOsc = null;
      this._sirenLfo = null;
      this._sirenGain = null;
    }
  }

  // A lazy sunset bassline: Am – F – C – G, one note a beat.
  _startMusic() {
    const bass = [110, 87.31, 130.81, 98];
    const arp = [220, 261.63, 329.63, 392, 329.63, 261.63];
    this._musicTimer = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const bar = Math.floor(this._musicStep / 8) % 4;
      const beat = this._musicStep % 8;
      if (beat === 0) this._tone(bass[bar], 1.6, 'triangle', 0.12);
      if (beat % 2 === 0) {
        const n = arp[(this._musicStep * 5 + bar) % arp.length];
        this._tone(n, 0.35, 'sine', 0.05);
      }
      this._musicStep++;
    }, 300);
  }
}
