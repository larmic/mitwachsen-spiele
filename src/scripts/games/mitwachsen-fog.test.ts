import { describe, expect, it } from 'vitest';
import { CHUNK } from '../../lib/games/chunks';
import { Fog, REVEAL, lookAround } from './mitwachsen-fog';
import { gatePlaces } from './mitwachsen-world';

describe('Nebel', () => {
  it('ist am Anfang überall', () => {
    const fog = new Fog();
    expect(fog.has(0, 0)).toBe(false);
    expect(fog.has(-100, 37)).toBe(false);
    expect(fog.size).toBe(0);
  });

  it('lichtet sich rund um die Figur, auch über Stückgrenzen und bei negativen Koordinaten', () => {
    const fog = new Fog();
    const changed = fog.reveal(0, 0, 3);
    expect(fog.has(0, 0)).toBe(true);
    expect(fog.has(3, 0)).toBe(true);
    expect(fog.has(-3, 0)).toBe(true);
    expect(fog.has(3, 3)).toBe(false); // Ecke liegt außerhalb des Kreises
    expect(fog.has(4, 0)).toBe(false);
    expect(changed.sort()).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
  });

  it('meldet nur Stücke, in denen sich wirklich etwas geändert hat', () => {
    const fog = new Fog();
    fog.reveal(5, 5, 2);
    expect(fog.reveal(5, 5, 2)).toEqual([]);
    expect(fog.reveal(5, 6, 2)).toEqual(['0,0']);
  });

  it('übersteht das Speichern und Laden', () => {
    const fog = new Fog();
    fog.reveal(0, 0, 5);
    fog.reveal(40, -20, 4);
    const back = Fog.from(JSON.parse(JSON.stringify(fog.serialize())));
    expect(back.size).toBe(fog.size);
    for (let y = -25; y < 25; y++) for (let x = -10; x < 50; x++) expect(back.has(x, y)).toBe(fog.has(x, y));
  });

  it('ist im Spielstand klein und übergeht Kaputtes', () => {
    const fog = new Fog();
    fog.reveal(0, 0, 4);
    for (const value of Object.values(fog.serialize()))
      expect(value.length).toBeLessThanOrEqual(Math.ceil((CHUNK * CHUNK) / 6) + 4);
    const back = Fog.from({ '0,0': 'kaputt!', 'a,b': 'AAAA', '1,1': 42, ...fog.serialize() });
    expect(back.has(0, 0)).toBe(true);
    expect(Fog.from(null).size).toBe(0);
    expect(Fog.from([1, 2]).size).toBe(0);
  });

  it('legt Erkundetes wieder in Nebel, wo es soll; leere Stücke fallen aus dem Spielstand', () => {
    const fog = new Fog();
    fog.reveal(0, 0, 5);
    fog.reveal(40, -20, 4);
    fog.forget((x) => x >= 20); // alles rechts davon wieder im Nebel
    expect(fog.has(0, 0)).toBe(true);
    expect(fog.has(-5, 0)).toBe(true);
    expect(fog.has(40, -20)).toBe(false);
    expect(Object.keys(fog.serialize()).sort()).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
    fog.forget((x, y) => x === 0 && y === 0); // nur ein Feld
    expect([fog.has(0, 0), fog.has(1, 0)]).toEqual([false, true]);
  });

  it('Blick durchs Tor: vor einem großen Tor lichtet er sich auch im Gang dahinter, weiter weg nicht', () => {
    const gate = { mid: [0, -20] as const, out: [0, -1] as const, deep: 30 }; // Tor im Norden, der Gang führt nach oben
    const near = new Fog();
    expect(lookAround(near, [gate], 0, -14).length).toBeGreaterThan(0);
    expect([near.has(0, -14 - REVEAL), near.has(0, -34), near.has(0, -36)]).toEqual([true, true, true]);
    const far = new Fog();
    lookAround(far, [gate], 0, -11); // 9 Felder vor der Tormitte: nur rund um die Figur
    expect([far.has(0, -11 - REVEAL), far.has(0, -34)]).toEqual([true, false]);
    expect(lookAround(far, [gate], 0, -11)).toEqual([]); // nichts Neues
  });

  it('„noch nicht“: Der Nebel im Gang lichtet sich tiefer, genau bis zur Mündung, nicht darüber hinaus', () => {
    const gate = { mid: [0, -20] as const, out: [0, -1] as const, deep: 32 };
    const fog = new Fog();
    lookAround(fog, [gate], 0, -18);
    expect([fog.has(0, -38), fog.has(0, -45)]).toEqual([true, false]); // sonst bis 18 Felder hinter der Tür
    expect(lookAround(fog, [gate], 0, -18, true).length).toBeGreaterThan(0);
    expect([fog.has(0, -45), fog.has(0, -52), fog.has(0, -53)]).toEqual([true, true, false]);
  });

  it('„noch nicht“ an den echten Toren: bis zur Mündung jedes Gangs, nie in die Welt dahinter', () => {
    let deep = 0;
    for (const seed of [1, 2, 3])
      for (const g of gatePlaces(seed).values()) {
        const fog = new Fog();
        const [px, py] = [g.mid[0] - 2 * g.out[0], g.mid[1] - 2 * g.out[1]]; // auf der Torplatte
        lookAround(fog, [g], px, py, true);
        const row = (t: number) =>
          [-1, 0, 1].map((u) =>
            fog.has(g.mid[0] + g.out[0] * t + g.out[1] * u, g.mid[1] + g.out[1] * t + g.out[0] * u),
          );
        const id = `Seed ${seed}, ${g.id} (Gang ${g.deep} Felder)`;
        for (let t = 1; t <= g.deep; t++) expect(row(t), `${id}, Reihe ${t}`).toEqual([true, true, true]);
        // nicht in die Welt dahinter (ein kurzer Gang: nicht weiter als der Blick ohne „noch nicht“, 18 Felder)
        expect(row(Math.max(g.deep, 18) + 1), id).toEqual([false, false, false]);
        if (g.deep >= 18) deep++;
      }
    expect(deep).toBeGreaterThan(5); // genug lange Gänge, in denen „noch nicht“ tiefer blickt
  });
});
