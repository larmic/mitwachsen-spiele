import { describe, expect, it, vi } from 'vitest';
import type { Cell } from './mitwachsen-cell';
import { Views3D, type Frame, type View3D } from './mitwachsen-view-3d';
import { Group } from 'three';
import { EIS_PACK, worldOf } from './test-worlds';
import type { Scene } from './mitwachsen-render';
import { initialState } from './mitwachsen-state';

const WOOD: Frame = ['#8a5a30', null, 'planks'];
const snow: Cell = { h: 2, ground: 'snow', deco: 'bed', region: 'eis', solid: false, biome: 'eis' };
const grass: Cell = { h: 1, ground: 'grass', deco: 'bed', region: 'lichtung', solid: false };
const STATE = initialState(worldOf(1));
const SC = { now: 0, reduced: false } as Scene;

describe('Haken der 3D-Ansicht für Welt-Pakete (Views3D)', () => {
  it('solange der 3D-Teil fehlt: schlicht (Boden wie auf der Lichtung, Bett aus Holz, kein Schmuck am Tor)', () => {
    const v = new Views3D();
    expect(v.ground(snow, ['eis'])).toBeNull();
    expect(v.bedFrame(snow, WOOD)).toBe(WOOD);
    expect(v.look('eis')).toBeUndefined();
    expect(v.decos.decos).toEqual({});
    expect(v.glow(1, false, 500)).toEqual([1, 1, 1]); // Quader 'glow' leuchten wie gebaut
    const scene = new Group();
    v.layers(scene, worldOf(1), STATE, SC);
    expect(scene.children).toEqual([]); // nichts, was je Bild nachgeführt wird (keine Fußspuren)
  });

  it('lädt den 3D-Teil eines Pakets einmal; danach baut er Boden, Bett, Dinge und Tor seiner Welt', async () => {
    const v = new Views3D();
    let ready = 0;
    let loads = 0;
    const pack = { id: 'eis' as const, view3d: () => (loads++, EIS_PACK.view3d!()) };
    await Promise.all([v.use(pack, () => ready++), v.use(pack, () => ready++)]);
    await v.use(pack, () => ready++);
    expect([loads, ready]).toEqual([1, 1]);
    expect(v.ground(snow, [])?.tiles).toEqual(['snowTop', 'ice', 'ice']);
    expect(v.bedFrame(snow, WOOD)).not.toBe(WOOD); // aus Schnee
    expect(v.bedFrame(grass, WOOD)).toBe(WOOD);
    expect(v.ground(grass, ['eis'])).toBeNull();
    expect(v.look('eis')).toBeDefined();
    expect(v.look('sand')).toBeUndefined();
    expect(Object.keys(v.decos.decos).sort()).toEqual([
      'crystal',
      'fishcrate',
      'floe',
      'icebowl',
      'icicle',
      'igloo',
      'snowheap',
      'watertrough',
    ]);
    // Leuchten: ohne Polarlicht wie gebaut, mit ihm heller (aus dem Paket)
    expect(v.glow(0, false, 0)).toEqual([1, 1, 1]);
    expect(v.glow(1, true, 0)[1]).toBeGreaterThan(1);
    // je Bild nachgeführt: die Fußspuren im Schnee, einmal in die Szene gehängt (nach neuem Kontext in die neue)
    const { layer } = await EIS_PACK.view3d!();
    const [one, two] = [new Group(), new Group()];
    v.layers(one, worldOf(1), STATE, SC);
    v.layers(one, worldOf(1), STATE, SC);
    expect(one.children).toEqual([layer!.object]);
    v.layers(two, worldOf(1), STATE, SC);
    expect([one.children, two.children]).toEqual([[], [layer!.object]]);
  });

  it('scheitert das Laden, bleibt es schlicht ohne Fehler und wird beim nächsten Aufruf wieder versucht', async () => {
    const v = new Views3D();
    let ready = 0;
    let fail = true;
    const view3d = (): Promise<View3D> => (fail ? Promise.reject(new Error('offline')) : EIS_PACK.view3d!());
    await v.use({ id: 'eis', view3d }, () => ready++);
    expect([ready, v.look('eis')]).toEqual([0, undefined]);
    fail = false;
    await v.use({ id: 'eis', view3d }, () => ready++);
    expect(ready).toBe(1);
    expect(v.look('eis')).toBeDefined();
  });

  it('scheitert das Laden, versucht es nach retryMs (RETRY_3D_MS) von selbst wieder, bis er da ist; stop beendet das', async () => {
    const v = new Views3D(5);
    let ready = 0;
    let loads = 0;
    const view3d = (): Promise<View3D> => (++loads < 3 ? Promise.reject(new Error('offline')) : EIS_PACK.view3d!());
    await v.use({ id: 'eis', view3d }, () => ready++);
    await vi.waitFor(() => expect(ready).toBe(1));
    expect(loads).toBe(3);
    expect(v.look('eis')).toBeDefined();

    const gone = new Views3D(5);
    let tries = 0;
    await gone.use({ id: 'eis', view3d: () => (tries++, Promise.reject(new Error('offline'))) }, () => ready++);
    gone.stop(); // die 3D-Ansicht geht: kein weiterer Versuch
    await new Promise((done) => setTimeout(done, 30));
    expect(tries).toBe(1);
  });

  it('ein Paket ohne 3D-Teil ändert nichts', async () => {
    const v = new Views3D();
    let ready = 0;
    await v.use({ id: 'eis' }, () => ready++);
    expect([ready, v.look('eis')]).toEqual([0, undefined]);
  });
});
