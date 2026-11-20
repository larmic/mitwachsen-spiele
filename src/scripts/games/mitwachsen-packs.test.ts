import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../data/games/mitwachsen';
import { ICE_MODELS } from '../../data/games/worlds/eis/mitwachsen-ice-models';
import { Packs, RETRY_MS, type LoadedPack } from './mitwachsen-packs';
import type { Need } from './mitwachsen-pack';
import { gatePlaces } from './mitwachsen-world';
import { EIS_PACK } from './test-worlds';

const gates = gatePlaces(1);
const bed: Need = { openGates: [], garden: [], at: [[0, 0]] }; // Tor zu, Figur am Bett: kein Bedarf
const open: Need = { ...bed, openGates: ['eis'] };
const pack = EIS_PACK as LoadedPack;

describe('Welt-Pakete laden (Packs)', () => {
  it('lädt nur bei Bedarf, einmal, und meldet die Ankunft', async () => {
    let loads = 0;
    const arrived: string[] = [];
    const packs = new Packs(
      (p) => arrived.push(p.id),
      () => (loads++, Promise.resolve(pack)),
    );
    await packs.want(bed, gates);
    expect(loads).toBe(0);
    expect(packs.loaded).toEqual([]);
    await Promise.all([packs.want(open, gates), packs.want(open, gates)]);
    expect(loads).toBe(1);
    expect(arrived).toEqual(['eis']);
    expect(packs.get('eis')).toBe(pack);
    await packs.want(open, gates); // schon da: nichts mehr
    expect(loads).toBe(1);
  });

  it('scheitert das Laden, geht es ohne weiter und versucht es frühestens nach RETRY_MS wieder', async () => {
    let loads = 0;
    const packs = new Packs(
      () => {},
      () => (++loads === 1 ? Promise.reject(new Error('Netz')) : Promise.resolve(pack)),
    );
    await packs.want(open, gates);
    expect(packs.loaded).toEqual([]);
    await packs.want(open, gates, performance.now() + 10);
    expect(loads).toBe(1);
    await packs.want(open, gates, performance.now() + RETRY_MS + 10);
    expect(loads).toBe(2);
    expect(packs.get('eis')).toBe(pack);
  });

  it('der Start wartet höchstens kurz (wait)', async () => {
    const packs = new Packs(
      () => {},
      () => new Promise<LoadedPack>(() => {}), // Netz hängt
    );
    const t = performance.now();
    await packs.wait(open, gates, 30);
    expect(performance.now() - t).toBeLessThan(1000);
    expect(packs.loaded).toEqual([]);
  });

  it('ohne eigenen Lader kommt das echte Paket der Eis-Welt (import())', async () => {
    const packs = new Packs(() => {});
    await packs.want(open, gates);
    expect(packs.get('eis')?.id).toBe('eis');
    expect(typeof packs.get('eis')?.view?.decos.igloo).toBe('function');
  });

  it('mit dem Paket kommen die Modelle der Eis-Tiere (der Kern kennt sie nicht)', async () => {
    const robbe = SPECIES.robbe.parts;
    SPECIES.robbe.parts = [];
    const packs = new Packs(
      () => expect(SPECIES.robbe.parts).toBe(ICE_MODELS.robbe), // schon eingetragen, wenn es ankommt
      () => Promise.resolve(pack),
    );
    await packs.want(open, gates);
    expect(SPECIES.robbe.parts.length).toBeGreaterThan(0);
    SPECIES.robbe.parts = robbe;
  });

  it('test-worlds.ts trägt beim Import die Modelle aller Eis-Tiere ein (Tests sehen sie nur über diesen Helfer)', () => {
    const ids = Object.keys(ICE_MODELS) as (keyof typeof ICE_MODELS)[];
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      expect(SPECIES[id].parts, id).toBe(ICE_MODELS[id]);
      expect(SPECIES[id].parts.length, id).toBeGreaterThan(0);
    }
  });
});
