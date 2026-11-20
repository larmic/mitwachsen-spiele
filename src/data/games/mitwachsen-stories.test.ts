import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATES } from './mitwachsen';
import { STORIES, melodyLength } from './mitwachsen-stories';

describe('Geschichten der Klangsteine', () => {
  it('gibt es am Bett, für jedes große Tor und am Schneebett (zweite Fassung der Eis-Geschichte)', () => {
    expect(Object.keys(STORIES).sort()).toEqual(['bett', ...GATES.map((g) => g.id), 'eis-offen'].sort());
    // beide Fassungen der Eis-Geschichte beginnen gleich und klingen gleich
    const [first, open] = [STORIES.eis, STORIES['eis-offen']];
    expect(open.text.startsWith('Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Jetzt ist')).toBe(
      true,
    );
    expect(first.text.split('. ')[0]).toBe(open.text.split('. ')[0]);
    expect(open.melody).toEqual(first.melody);
  });

  it('stehen wortgleich in der Doku (docs/games/mitwachsen.md), zum Vorlesen und Einsprechen', () => {
    const doc = readFileSync('docs/games/mitwachsen.md', 'utf8').replace(/\s+/g, ' ');
    for (const [id, s] of Object.entries(STORIES)) {
      expect(doc.includes(`**${s.title}**`), `Titel ${id}`).toBe(true);
      expect(doc.includes(s.text), `Text ${id}`).toBe(true);
    }
  });

  it('jede eingetragene Aufnahme liegt wirklich unter public/', () => {
    for (const s of Object.values(STORIES)) if (s.voice) expect(existsSync(`public${s.voice}`), s.voice).toBe(true);
  });

  it('Melodien sind kurz und bleiben in der Pentatonik C–D–E–G–A (klingen zu den Tieren)', () => {
    const PENTA = [0, 2, 4, 7, 9]; // Halbtöne über C
    for (const [id, s] of Object.entries(STORIES)) {
      expect(melodyLength(s.melody), id).toBeLessThan(5);
      for (const [hz] of s.melody.notes) {
        const semis = Math.round(12 * Math.log2(hz / 261.63));
        expect(PENTA, `${id}: ${hz} Hz`).toContain(((semis % 12) + 12) % 12);
      }
    }
  });
});
