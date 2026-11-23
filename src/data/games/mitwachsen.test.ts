import { describe, expect, it } from 'vitest';
import { GATES, REGIONS, REGION_IDS, gateOfKey, keyOf, realmOfAnimal, regionBehind, speciesOf } from './mitwachsen';
import { HOMES } from './mitwachsen-homes';
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

  it('die Höhlenwelt hat noch keine Tiere; Kennungen mit ihr ergeben keine Art und gehören doch zu ihr', () => {
    const hoehle = REGIONS.find((r) => r.id === 'hoehle')!;
    expect(hoehle.animals).toEqual([]);
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
  it('die zweite Fassung je Tor, wenn es eine gibt und das Tor offen ist: heute nur die Eis-Geschichte', () => {
    expect(openStory('eis')).toBe('eis-offen');
    expect(GATES.filter((g) => openStory(g.id)).map((g) => g.id)).toEqual(['eis']);
    expect(told('eis', [])).toBe('eis');
    expect(told('eis', ['eis'])).toBe('eis-offen');
    expect(told('hoehle', ['hoehle', 'eis'])).toBe('hoehle'); // Höhle: ohne zweite Fassung bleibt es beim Text
    expect(told('bett', ['eis'])).toBe('bett');
    expect(Object.hasOwn(STORIES, 'hoehle')).toBe(true);
  });
});
