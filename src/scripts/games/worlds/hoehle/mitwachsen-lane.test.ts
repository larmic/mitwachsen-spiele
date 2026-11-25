import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { lanePlan, laneSide } from './mitwachsen-lane';

const { rx, ry } = GROTTE.shape;
const key = ([a, o]: Point) => `${a},${o}`;
const cheb = (p: Point, q: Point) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));

/** Boden einer Ellipse wie die Grotte, der Rand mit `wave` Feldern Welle nach innen (je Reihe anders) */
const ellipse =
  (wave: (u: number, v: number) => number) =>
  (u: number, v: number): boolean =>
    (u / rx) ** 2 + (v / ry) ** 2 < 1 - wave(u, v);
const SHAPES = {
  glatt: ellipse(() => 0),
  wellig: ellipse((u, v) => 0.04 + 0.04 * Math.sin(v * 1.7 + u * 0.3)),
  zackig: ellipse((u, v) => ((((u * 7 + v * 13) % 5) + 5) % 5) * 0.016), // springt von Reihe zu Reihe
};

describe('Schleife der Grubenbahn (Plan)', () => {
  it('Daten wie im Konzept: Halt bei quer 16, Feld 25 bis 36; Zaun zwei Felder vom Gang; Kristallhalle Radius 10', () => {
    const { stop, gang, fence, leg, turn } = GROTTE.grube;
    expect([stop.across, stop.out, stop.out + stop.long - 1]).toEqual([16, 25, 36]);
    expect(fence - gang).toBe(2);
    expect([gang, fence, leg, turn]).toEqual([1.5, 3.5, 6, 74]);
    expect(GROTTE.hall.r).toBe(10);
  });

  for (const [name, floorAt] of Object.entries(SHAPES))
    for (const side of [1, -1] as const)
      it(`${name}, Seite ${side}: geschlossen, nie schräg, kein Feld doppelt, der Gang endet ${GROTTE.grube.open} Felder vor dem Halt, Hinweg fern vom Gang, alles im Boden`, () => {
        const plan = lanePlan(side, floorAt);
        const { track, gang } = plan;
        const n = track.length;
        const bad: string[] = [];
        if (n < 140 || n > 170) bad.push(`${n} Felder`);
        if (new Set(track.map(key)).size !== n) bad.push('Feld doppelt');
        track.forEach((p, i) => {
          if (
            cheb(p, track[(i + 1) % n]!) !== 1 ||
            (p[0] !== track[(i + 1) % n]![0] && p[1] !== track[(i + 1) % n]![1])
          )
            bad.push(`Sprung bei ${i}`);
          if (!floorAt(side * p[0], p[1] - ry)) bad.push(`${key(p)} im Fels`);
        });
        if (gang[1] !== n - 1 - GROTTE.grube.open || gang[0] <= GROTTE.grube.stop.long)
          bad.push(`Gang ${gang.join('–')}`);
        // der offene Hinweg hält mindestens drei Felder Abstand vom Gang (dazwischen Zaun und Luft)
        const inGang = track.slice(gang[0], gang[1] + 1);
        const legs = track.slice(GROTTE.grube.stop.long, gang[0] - 6);
        const close = legs.filter((p) => inGang.some((q) => cheb(p, q) < 3));
        if (close.length) bad.push(`Hinweg nah am Gang: ${close.slice(0, 2).map(key).join(' ')}`);
        // Nachbarn und Zaun: nie auf dem Gleis, der Zaun zwei Felder vom Gang
        const onTrack = new Set(track.map(key));
        if ([...plan.sides, ...plan.fence].some((p) => onTrack.has(key(p))))
          bad.push('Zaun oder Nachbar auf dem Gleis');
        if (plan.fence.some((p) => Math.min(...inGang.map((q) => cheb(p, q))) !== 2))
          bad.push('Zaun nicht zwei Felder');
        if (plan.platform.length !== GROTTE.grube.stop.long * GROTTE.grube.stop.wide) bad.push('Bahnsteig');
        // nur die beiden Enden des Gangs (die Tore) liegen neben offenem Gleis
        const openCells = [...track.slice(0, gang[0]), ...track.slice(gang[1] + 1)];
        const touching = inGang
          .slice(1, -1)
          .filter((p) => openCells.some((q) => cheb(p, q) === 1 && (p[0] === q[0] || p[1] === q[1])));
        if (touching.length) bad.push(`Gang neben offenem Gleis: ${touching.map(key).join(' ')}`);
        expect(bad.slice(0, 5)).toEqual([]);
      });

  it('Seite: gespiegelt nur, wenn u+ nach Süden zur Kamera zeigt', () => {
    const site = (ax: number, ay: number) => ({
      at: (u: number, v: number): Point => [ax * u - ay * v, ay * u + ax * v],
    });
    expect([site(0, -1), site(1, 0), site(-1, 0), site(0, 1)].map(laneSide)).toEqual([1, 1, 1, -1]);
  });
});
