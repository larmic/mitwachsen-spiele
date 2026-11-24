// Endlose Welten in Stücken: Ein Stück (CHUNK × CHUNK Felder) wird erst berechnet, wenn jemand ein Feld darin
// braucht, und dann zwischengespeichert. Die Welt selbst ist nie vollständig im Speicher.

export const CHUNK = 16;

/** Stück, in dem ein Feld liegt (auch für negative Koordinaten) */
export const chunkOf = (x: number, y: number): [number, number] => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];

/** Feld aus einem Schlüssel „x,y“ (so stehen Felder in Maps und im Spielstand) */
export function fromKey(key: string): [number, number] {
  // ohne split: läuft beim Bau jeder Welt für jedes Feld, oft mehrmals
  const i = key.indexOf(',');
  if (i < 0) return [Number(key), NaN];
  const j = key.indexOf(',', i + 1);
  return [Number(key.slice(0, i)), Number(j < 0 ? key.slice(i + 1) : key.slice(i + 1, j))];
}

/** Gleiche Felder? (gleiches Objekt oder gleicher Inhalt) */
const same = <T>(a: T | undefined, b: T | undefined) => a === b || JSON.stringify(a) === JSON.stringify(b);
/** Stücke ("cx,cy"), in denen sich zwei Karten von Feldern ("x,y" → Feld) unterscheiden */
export function changedChunks<T>(before: ReadonlyMap<string, T>, after: ReadonlyMap<string, T>): Set<string> {
  const out = new Set<string>();
  for (const k of new Set([...before.keys(), ...after.keys()]))
    if (!same(before.get(k), after.get(k))) out.add(chunkOf(...fromKey(k)).join(','));
  return out;
}

/** Zwischenspeicher für Stücke. `make` berechnet ein Stück als Liste von CHUNK × CHUNK Feldern (zeilenweise). */
/**
 * Stücke samt ihren vier Nachbarn: Eine Ansicht, die Seitenflächen am Rand eines Stücks mit Blick auf das Nachbarfeld
 * weglässt, muss die Nachbarn eines geänderten Stücks mit neu bauen, sonst bleibt an der Grenze ein Loch
 */
export function withNeighbours(keys: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const k of keys) {
    const [cx, cy] = fromKey(k);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      out.add(`${cx + dx},${cy + dy}`);
  }
  return [...out];
}

export class ChunkCache<T> {
  private readonly chunks = new Map<string, T[]>();

  constructor(
    private readonly make: (cx: number, cy: number) => T[],
    private readonly limit = 256,
  ) {}

  get(x: number, y: number): T {
    const [cx, cy] = chunkOf(x, y);
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.make(cx, cy);
      // Älteste Stücke vergessen, damit lange Wanderungen den Speicher nicht füllen (sie entstehen ja wieder gleich)
      if (this.chunks.size >= this.limit) this.chunks.delete(this.chunks.keys().next().value!);
      this.chunks.set(key, chunk);
    }
    return chunk[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)]!; // Stücke sind immer CHUNK × CHUNK groß
  }

  /** Schon berechnete Stücke eines anderen Zwischenspeichers übernehmen, außer denen in `skip` (Schlüssel „cx,cy“) */
  adopt(from: ChunkCache<T>, skip: ReadonlySet<string>) {
    for (const [key, chunk] of from.chunks) if (!skip.has(key) && !this.chunks.has(key)) this.chunks.set(key, chunk);
  }
}
