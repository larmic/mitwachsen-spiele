import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATES } from './mitwachsen';
import { STORIES, melodyLength } from './mitwachsen-stories';
import { STORY_TEXTS } from './mitwachsen-story-texts';

describe('Geschichten der Klangsteine', () => {
  it('gibt es am Bett, für jedes große Tor, am Schneebett und am Höhlenbett (zweite Fassungen), bei den Lichtgeistern und an der Bahn', () => {
    expect(Object.keys(STORIES).sort()).toEqual(
      ['bett', ...GATES.map((g) => g.id), 'eis-offen', 'hoehle-offen', 'lichtgeister', 'lokschuppen', 'bahnhof'].sort(),
    );
    expect(Object.keys(STORY_TEXTS).sort()).toEqual(Object.keys(STORIES).sort());
    // beide Fassungen der Eis-Geschichte beginnen gleich und klingen gleich
    const [first, open] = [STORY_TEXTS.eis, STORY_TEXTS['eis-offen']];
    expect(open.text.startsWith('Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Jetzt ist')).toBe(
      true,
    );
    expect(first.text.split('. ')[0]).toBe(open.text.split('. ')[0]);
    expect(STORIES['eis-offen'].melody).toEqual(STORIES.eis.melody);
  });

  it('die Höhlen-Geschichte hat zwei Fassungen: gleicher erster Satz, gleiche Melodie; die erste wortgleich', () => {
    const [first, open] = [STORY_TEXTS.hoehle, STORY_TEXTS['hoehle-offen']];
    // die Geschichte am geschlossenen Höhlentor (Konzept „Gleisbauer und Höhlen-Welt“), seit der Dunkelmaske mit dem
    // Satz zum Dunkel, den der Vater am 24.11.2026 freigegeben hat (Konzeptseite „Höhle nach dem ersten Spielen“)
    expect(first.text).toBe(
      'Hinter diesem Tor geht es unter die Erde, in eine große Höhle. Dunkel ist es dort nur ein bisschen, und die Laterne macht es hell. An den Wänden wachsen Kristalle, die in allen Farben glitzern. Eine Fledermaus wohnt da. Sie schläft am Tag mit dem Kopf nach unten und wacht erst auf, wenn du ins Bett gehst. Vielleicht weckst du sie später einmal.',
    );
    expect(first.text.split('. ')[0]).toBe(open.text.split('. ')[0]);
    expect(open.text.split('. ')[1]).toMatch(/^Und jetzt ist sie offen, weil du mit Tok zusammen/);
    expect(STORIES['hoehle-offen'].melody).toEqual(STORIES.hoehle.melody);
  });

  it('die Geschichten der Bahn: Toks Geschichte im Lokschuppen und der Bahnhof Bär, mit eigener Melodie', () => {
    expect(STORY_TEXTS.lokschuppen.text.startsWith('Tok hat eine Spitzhacke')).toBe(true);
    expect(STORY_TEXTS.bahnhof.text.startsWith('Hier ist der Bahnhof beim Bären.')).toBe(true);
    // ohne Aufnahme spielt die Melodie allein, darum hat jede genug Töne
    for (const id of ['lokschuppen', 'bahnhof'] as const)
      expect(STORIES[id].melody.notes.length, id).toBeGreaterThan(4);
  });

  it('stehen wortgleich in der Doku (docs/games/mitwachsen.md), zum Vorlesen und Einsprechen', () => {
    const doc = readFileSync('docs/games/mitwachsen.md', 'utf8').replace(/\s+/g, ' ');
    for (const [id, s] of Object.entries(STORY_TEXTS)) {
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
