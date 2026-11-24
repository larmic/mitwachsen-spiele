import { describe, expect, it } from 'vitest';
import { GATES, REGIONS, REGION_IDS, gateOfKey, keyOf, realmOfAnimal, regionBehind, speciesOf } from './mitwachsen';
import { HOMES } from './mitwachsen-homes';
import { BAHN_LIVE, tryBahn } from './mitwachsen-live';
import { STORIES, openStory, told } from './mitwachsen-stories';

describe('Gegenden und Tore', () => {
  it('die Gegenden als Liste: Lichtung, Eis-Welt, Höhlenwelt, in dieser Reihe auch in REGIONS und HOMES', () => {
    expect(REGION_IDS).toEqual(['lichtung', 'eis', 'hoehle']);
    expect(REGIONS.map((r) => r.id)).toEqual([...REGION_IDS]);
    expect(Object.keys(HOMES)).toEqual([...REGION_IDS]);
  });

  it('jede Gegend außer der Lichtung liegt hinter ihrem eigenen Tor, und das Tor hat denselben Namen', () => {
    expect(REGIONS[0].behind).toBeUndefined();
    for (const r of REGIONS.slice(1)) {
      expect(r.behind, r.id).toBe(r.id);
      expect(regionBehind(r.behind!)).toBe(r);
    }
    expect(regionBehind('sand')).toBeUndefined(); // hinter den anderen Toren liegt nur Landschaft
  });

  it('Kennungen mit der Höhlenwelt ergeben die Art und gehören zu ihr', () => {
    expect(speciesOf('hoehle:fledermaus:3')).toBe('fledermaus');
    expect(speciesOf('hoehle:hase')).toBe('hase'); // Art aus der Kennung (die Gegend gibt es)
    expect(realmOfAnimal('hoehle:hase')).toBe('hoehle');
  });

  it('Schlüssel je Tor (`opens`): das Eistor öffnet der Pinguin, alle anderen gehen nie auf, auch das Höhlentor', () => {
    expect(keyOf('eis')).toBe('pinguin');
    expect(gateOfKey('pinguin')).toBe('eis');
    expect(gateOfKey('hase')).toBeUndefined();
    for (const g of GATES.filter((t) => t.id !== 'eis')) expect(keyOf(g.id), g.id).toBeUndefined();
  });
});

describe('Was ein Klangstein erzählt (told)', () => {
  it('die zweite Fassung je Tor, wenn es eine gibt und das Tor offen ist: Eis- und Höhlen-Geschichte', () => {
    expect(openStory('eis')).toBe('eis-offen');
    expect(openStory('hoehle')).toBe('hoehle-offen');
    expect(GATES.filter((g) => openStory(g.id)).map((g) => g.id)).toEqual(['eis', 'hoehle']);
    expect(told('eis', [])).toBe('eis');
    expect(told('eis', ['eis'])).toBe('eis-offen');
    expect(told('hoehle', ['eis'])).toBe('hoehle'); // Höhlentor zu: die erste Fassung, wortgleich wie bisher
    expect(told('hoehle', ['hoehle', 'eis'])).toBe('hoehle-offen');
    expect(told('bett', ['eis', 'hoehle'])).toBe('bett');
    // die Steine der Bahn erzählen immer ihre eigene Geschichte
    expect(told('bahnhof', ['eis', 'hoehle'])).toBe('bahnhof');
    expect(told('lokschuppen', ['eis', 'hoehle'])).toBe('lokschuppen');
    expect(Object.hasOwn(STORIES, 'hoehle')).toBe(true);
  });

  it('solange die Bahn-Phase aus ist (BAHN_LIVE), geht das Höhlentor nicht auf: sein Stein erzählt die erste Fassung', () => {
    expect(BAHN_LIVE).toBe(false);
    expect(keyOf('hoehle')).toBeUndefined(); // ohne Schlüssel kommt das Höhlentor nie in die offenen Tore
    expect(told('hoehle', ['eis'])).toBe('hoehle');
    tryBahn();
    try {
      expect(keyOf('hoehle')).toBe('tok'); // im Blick hinein (Entwickler-Schalter): Tok öffnet es, dann die zweite
      expect(told('hoehle', ['eis', 'hoehle'])).toBe('hoehle-offen');
    } finally {
      tryBahn(false);
    }
  });
});
