import { describe, expect, it } from 'vitest';
import { MEADOW, cubeDefs, sceneSvg, textureCss } from './blocks';

describe('cubeDefs', () => {
  it('erzeugt je Block ein Symbol mit Präfix', () => {
    const defs = cubeDefs();
    for (const id of ['grass', 'dirt', 'stone', 'log', 'leaves', 'plank', 'pilz']) {
      expect(defs).toContain(`<symbol id="v-${id}"`);
    }
    expect(cubeDefs('x')).toContain('id="x-grass"');
  });
});

describe('textureCss', () => {
  it('setzt die drei Texturen als CSS-Variablen', () => {
    const css = textureCss();
    expect(css).toMatch(/--tex-grass: url\(/);
    expect(css).toMatch(/--tex-dirt: url\(/);
    expect(css).toMatch(/--tex-stone: url\(/);
  });
});

describe('sceneSvg', () => {
  it('zeichnet jeden Block genau einmal, von hinten nach vorn', () => {
    const { uses } = sceneSvg(MEADOW);
    expect(uses.match(/<use /g)).toHaveLength(MEADOW.length);
    // Der Pilz steht vorn auf der Wiese und kommt nach dem Gras darunter
    expect(uses.indexOf('#v-pilz')).toBeGreaterThan(uses.lastIndexOf('#v-grass'));
  });
  it('umschließt alle Blöcke mit der viewBox', () => {
    const { viewBox } = sceneSvg([{ i: 0, j: 0, k: 0, sym: 'grass' }]);
    expect(viewBox).toBe('0 0 80 84.8');
  });
  it('liefert für eine leere Szene einen einzelnen Würfelrahmen', () => {
    expect(sceneSvg([])).toEqual({ viewBox: '0 0 80 84.8', uses: '' });
  });
});
