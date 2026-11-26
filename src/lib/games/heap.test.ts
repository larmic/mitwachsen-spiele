// Kleinster Haufen über Zahlen: holt immer die kleinste heraus, auch bei gleichen und in beliebiger Reihenfolge
import { describe, expect, it } from 'vitest';
import { Heap } from './heap';

describe('Heap', () => {
  it('holt die Zahlen aufsteigend heraus, gleiche bleiben erhalten', () => {
    const h = new Heap();
    const values = [5, 3, 9, 3, 1, 12, 7, 1, 0, 8];
    for (const v of values) h.push(v);
    expect(h.size).toBe(values.length);
    const out: number[] = [];
    while (h.size) out.push(h.pop());
    expect(out).toEqual([...values].sort((a, b) => a - b));
  });

  it('bleibt richtig, wenn zwischendurch hineingelegt wird', () => {
    const h = new Heap();
    h.push(4);
    h.push(2);
    expect(h.pop()).toBe(2);
    h.push(1);
    h.push(3);
    expect([h.pop(), h.pop(), h.pop()]).toEqual([1, 3, 4]);
    expect(h.size).toBe(0);
  });
});
