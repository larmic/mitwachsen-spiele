// Nebel über der Welt – rein, ohne DOM, damit testbar. Zu sehen ist nur, was die Figur schon erkundet hat.
// Je Stück (16 × 16 Felder) ein Bitfeld: 1 = erkundet. Gespeichert als Base64 je Stück, also wenige Byte.
// Die Regeln kennen den Nebel nicht; er betrifft nur, was gezeichnet wird.
// Spezifikation: docs/specs/mitwachsen.md

import { CHUNK, chunkOf } from '../../lib/games/chunks';

export const REVEAL = 7; // so weit sieht die Figur um sich herum
export const START_REVEAL = 10; // so viel ist am Anfang um das Bett zu sehen
const BYTES = (CHUNK * CHUNK) / 8;

/** Ist Bit i gesetzt? */
const isSet = (bits: Uint8Array, i: number) => ((bits[i >> 3] ?? 0) & (1 << (i & 7))) !== 0;
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function fromBase64(text: string): Uint8Array | null {
  try {
    const raw = atob(text);
    if (raw.length !== BYTES) return null;
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export class Fog {
  private chunks = new Map<string, Uint8Array>();

  /** Aus einem Spielstand; Kaputtes wird übergangen */
  static from(data: unknown): Fog {
    const fog = new Fog();
    if (typeof data === 'object' && data !== null && !Array.isArray(data))
      for (const [key, value] of Object.entries(data)) {
        if (!/^-?\d+,-?\d+$/.test(key) || typeof value !== 'string') continue;
        const bytes = fromBase64(value);
        if (bytes) fog.chunks.set(key, bytes);
      }
    return fog;
  }

  /** Ist das Feld erkundet? */
  has(x: number, y: number): boolean {
    const [cx, cy] = chunkOf(x, y);
    const bits = this.chunks.get(`${cx},${cy}`);
    if (!bits) return false;
    const i = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    return isSet(bits, i);
  }

  /** Kreis um (x, y) erkunden; liefert die Stücke, in denen sich etwas geändert hat */
  reveal(x: number, y: number, r: number): string[] {
    const changed = new Set<string>();
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue; // runder Rand
        const px = x + dx,
          py = y + dy;
        const [cx, cy] = chunkOf(px, py);
        const key = `${cx},${cy}`;
        let bits = this.chunks.get(key);
        if (!bits) {
          bits = new Uint8Array(BYTES);
          this.chunks.set(key, bits);
        }
        const i = (py - cy * CHUNK) * CHUNK + (px - cx * CHUNK);
        if (isSet(bits, i)) continue;
        bits[i >> 3] = (bits[i >> 3] ?? 0) | (1 << (i & 7));
        changed.add(key);
      }
    return [...changed];
  }

  /**
   * Erkundetes wieder in Nebel legen, wo `drop(x, y)` es sagt (Umzug eines Spielstands, wenn sich eine Welt ändert);
   * Stücke ohne Erkundetes fallen weg
   */
  forget(drop: (x: number, y: number) => boolean): void {
    for (const [key, bits] of this.chunks) {
      const [cx, cy] = key.split(',').map(Number) as [number, number]; // Schlüssel sind geprüft ("cx,cy")
      for (let i = 0; i < CHUNK * CHUNK; i++)
        if (isSet(bits, i) && drop(cx * CHUNK + (i % CHUNK), cy * CHUNK + Math.floor(i / CHUNK)))
          bits[i >> 3] = (bits[i >> 3] ?? 0) & ~(1 << (i & 7));
      if (bits.every((b) => b === 0)) this.chunks.delete(key);
    }
  }

  /** Für den Spielstand: je Stück Base64 */
  serialize(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, bits] of this.chunks) if (bits.some((b) => b !== 0)) out[key] = toBase64(bits);
    return out;
  }

  /** Anzahl erkundeter Felder */
  get size(): number {
    let n = 0;
    for (const bits of this.chunks.values()) for (const b of bits) for (let v = b; v; v &= v - 1) n++;
    return n;
  }
}

/**
 * Nebel um die Figur bei (x, y) lichten (`REVEAL`). Blick durchs Tor: Steht sie vor einem großen Tor (höchstens 8 Felder
 * von seiner Mitte), lichtet er sich auch im Gang dahinter, bis 18 Felder hinter der Tür (4 Felder Rand um jeden
 * Blickpunkt); zeigt das Tor „noch nicht“ (`peek`), bis zur Mündung des Gangs (`deep`, je Welt gemessen, 11 bis 25
 * Felder), nie darüber hinaus in die Welt (ist der Gang kürzer als 18 Felder, nur so weit wie sonst). Liefert die
 * Stücke, in denen sich etwas geändert hat.
 */
export function lookAround(
  fog: Fog,
  gates: Iterable<{ mid: readonly [number, number]; out: readonly [number, number]; deep: number }>,
  x: number,
  y: number,
  peek?: boolean,
) {
  const changed = fog.reveal(x, y, REVEAL);
  for (const g of gates) {
    const [mx, my] = g.mid;
    if (Math.max(Math.abs(x - mx), Math.abs(y - my)) > 8) continue;
    // Blickpunkte alle 5 Felder, der letzte genau 4 Felder vor dem Ende (sein Rand reicht bis dorthin)
    const end = (peek ? Math.max(g.deep, 18) : 18) - 4;
    for (let k = 4; k < end + 5; k += 5) {
      const t = Math.min(k, end);
      changed.push(...fog.reveal(mx + g.out[0] * t, my + g.out[1] * t, 4));
    }
  }
  return changed;
}
