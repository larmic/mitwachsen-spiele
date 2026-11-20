// Töne der Kinderspiele, per WebAudio erzeugt: keine Audiodateien, keine externen Ressourcen.
// Kurz, warm und leise. Höchstens MAX_VOICES Töne gleichzeitig, damit Dauerdrücken nicht laut wird.
// Der Browser erlaubt Ton erst nach einer Geste: `unlock()` aus einem Tasten- oder Klick-Handler aufrufen.

import { pick } from '../../lib/games/rng';
import type { Tone } from '../../data/games/mitwachsen';
import type { Melody } from '../../data/games/mitwachsen-stories';

const MAX_VOICES = 6;
const ICICLES = [1567.98, 1760, 2093, 2349.32, 2637.02]; // Windspiel aus Eiszapfen: G6 A6 C7 D7 E7 (Pentatonik)

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private voices = 0;
  private wind: GainNode | null = null; // Rauschen des Pustewinds, läuft, solange es weht
  muted = false;

  /** Im Handler einer Nutzergeste aufrufen: legt den AudioContext an bzw. weckt ihn */
  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const comp = this.ctx.createDynamicsCompressor();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.6;
        this.out.connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // ohne Ton weiterspielen
    }
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
    this.wind = null;
  }

  private note(freq: number, len: number, wave: OscillatorType, gain: number, slide = 1, delay = 0, dest?: AudioNode) {
    const ctx = this.ctx;
    // Das Limit gilt nur für sofort erklingende Töne (Dauerdrücken); Melodien sind schon eingeplant und dürfen zu Ende spielen.
    // Ein gerade fortgesetzter Context (resume läuft asynchron) spielt eingeplante Töne nach.
    if (this.muted || !ctx || !this.out || ctx.state === 'closed' || (delay === 0 && this.voices >= MAX_VOICES)) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(env).connect(dest ?? this.out);
    this.voices++;
    osc.onended = () => this.voices--;
    osc.start(t);
    osc.stop(t + len + 0.03);
  }

  /** Ton eines Tiers, auf Wunsch etwas später (`delay` in Sekunden) */
  play(tone: Tone, delay = 0) {
    tone.notes.forEach((f, i) =>
      this.note(f, tone.len, tone.wave, tone.gain ?? 0.15, tone.slide, delay + i * (tone.len + tone.gap)),
    );
  }

  step(climb = 0) {
    this.note(climb > 0 ? 260 : climb < 0 ? 160 : 190 + Math.random() * 25, 0.05, 'sine', 0.06);
  }
  bump() {
    this.note(300, 0.22, 'sine', 0.1, 0.5);
  }
  call() {
    this.note(659.25, 0.14, 'sine', 0.12, 1.06);
    this.note(783.99, 0.2, 'sine', 0.12, 1.06, 0.16);
  }
  friend() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.16, 'triangle', 0.1, 1, 0.25 + i * 0.08));
  }
  home(delay = 0) {
    [783.99, 1046.5].forEach((f, i) => this.note(f, 0.18, 'sine', 0.1, 1, delay + i * 0.1));
  }
  gate() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.22, 'triangle', 0.1, 1, 0.3 + i * 0.11));
  }
  /** Durch ein Portal: schnell aufsteigende, glitzernde Töne */
  portal() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.note(f, 0.12, 'sine', 0.08, 1.02, i * 0.05));
  }
  /** Von der Mitte gestiegen: Das Gold springt zurück, die Plattform ist wieder bereit (ein kurzes, helles Pling) */
  pling() {
    this.note(783.99, 0.16, 'sine', 0.08, 1.01);
  }
  /** Beeren pflücken: zweimal ein kleines, helles Ploppen */
  pick() {
    this.note(880, 0.07, 'sine', 0.09, 1.3);
    this.note(1174.66, 0.09, 'sine', 0.08, 1.2, 0.09);
  }
  /** Fische fangen: Platsch-Plopp, ein tiefer, kurzer Ton, dann ein hoher */
  catch() {
    this.note(196, 0.1, 'sine', 0.1, 0.6);
    this.note(1046.5, 0.08, 'sine', 0.08, 1.3, 0.12);
  }
  /** Futter im Trog: fröhliche, hüpfende Töne */
  feed() {
    [523.25, 659.25, 587.33, 783.99, 659.25, 1046.5].forEach((f, i) =>
      this.note(f, 0.14, 'triangle', 0.09, 1, i * 0.09),
    );
  }
  /** Eimer schöpfen: zweimal ein tiefes Gluckern */
  fill() {
    this.note(330, 0.12, 'sine', 0.09, 0.6);
    this.note(392, 0.14, 'sine', 0.08, 0.55, 0.13);
  }
  /** Wasser in den Trog: ein plätschernder Lauf nach unten, dann fröhlich hinauf */
  pour() {
    [1046.5, 880, 783.99, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.1, 'sine', 0.07, 0.9, i * 0.07));
  }
  /** Gähnen: ein langer, sinkender Ton, leise darunter ein zweiter */
  yawn() {
    this.note(330, 0.9, 'sine', 0.07, 0.55);
    this.note(247, 0.7, 'triangle', 0.04, 0.7, 0.35);
  }
  wake() {
    [523.25, 659.25, 783.99].forEach((f, i) => this.note(f, 0.18, 'sine', 0.1, 1, i * 0.12));
  }
  /** Melodie eines Klangsteins über eine eigene Leitung; liefert eine Funktion, die sie sanft ausblendet */
  melody(m: Melody): () => void {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.out) return () => undefined;
    const bus = ctx.createGain();
    bus.connect(this.out);
    let at = 0;
    for (const [freq, len, gain] of m.notes) {
      this.note(freq, len, m.wave, gain ?? 0.1, 1, at + 0.05, bus);
      at += len + m.gap;
    }
    return () => {
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
      setTimeout(() => bus.disconnect(), 400);
    };
  }
  /** Schritt auf Schnee und Eis: ein kurzes, weiches Knirschen (gefiltertes Rauschen), dazu leise der Schritt */
  crunch(climb = 0) {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.out || ctx.state === 'closed' || this.voices >= MAX_VOICES) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, 0.09);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 600;
    band.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(band).connect(env).connect(this.out);
    this.voices++;
    src.onended = () => this.voices--;
    src.start(t);
    this.note(climb > 0 ? 260 : climb < 0 ? 160 : 190, 0.04, 'sine', 0.03);
  }
  /**
   * Rauschen des Pustewinds („fuuu“): weiches, tief gefiltertes Rauschen, das Wind und Böe folgt (`level` 0 … 1, 0 =
   * still). Leiser als die Spieltöne (höchstens 0,04), es heult und pfeift nie.
   */
  windLoop(level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.out || ctx.state === 'closed') return;
    if (!this.wind && (level <= 0 || this.muted)) return;
    if (!this.wind) {
      const src = ctx.createBufferSource();
      src.buffer = noise(ctx, 2);
      src.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 500;
      this.wind = ctx.createGain();
      this.wind.gain.value = 0;
      src.connect(low).connect(this.wind).connect(this.out);
      src.start();
    }
    const gain = this.muted ? 0 : Math.max(0, Math.min(1, level)) * 0.04;
    this.wind.gain.setTargetAtTime(gain, ctx.currentTime, 0.4);
  }
  /** Windspiel aus Eiszapfen am Iglu an der Spitze einer Böe: zwei bis drei helle, fröhliche Töne */
  chime(soft = false) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) this.note(pick(ICICLES, Math.random()), 0.3, 'sine', soft ? 0.025 : 0.05, 1, i * 0.16);
  }
  /** Die Figur lacht in der Böe leise: zwei kurze, helle „hi“ */
  giggle(soft = false) {
    [659.25, 587.33].forEach((f, i) => this.note(f, 0.07, 'triangle', soft ? 0.02 : 0.04, 0.85, i * 0.11));
  }
  /** Weltwechsel an der Gangmitte: ein Glockenton, hoch beim Betreten der Eis-Welt, tief beim Zurückkehren */
  bell(high: boolean) {
    const f = high ? 1318.51 : 392; // E6 bzw. G4
    this.note(f, 1.1, 'sine', 0.09);
    this.note(f * 2, 0.6, 'sine', 0.03); // heller Oberton
  }
  /** Eingeplante Töne spielen (das Eistor geht auf: `gateScore` in mitwachsen-guest-look.ts) */
  score(notes: readonly Scored[]) {
    for (const [freq, len, wave, gain, slide, delay] of notes) this.note(freq, len, wave, gain, slide, delay);
  }
  lullaby() {
    [783.99, 659.25, 587.33, 523.25, 392].forEach((f, i) => this.note(f, 0.42, 'sine', 0.08, 1, i * 0.38));
  }
}

/** Ein eingeplanter Ton: Hz, Länge (s), Welle, Lautstärke, Gleiten, Beginn (s) */
export type Scored = [freq: number, len: number, wave: OscillatorType, gain: number, slide: number, delay: number];

/** Weißes Rauschen der Länge `seconds` (für Knirschen und Wind) */
function noise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
