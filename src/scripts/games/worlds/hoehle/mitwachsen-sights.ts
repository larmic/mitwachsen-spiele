// Sehenswürdigkeiten der Kristallgrotte (`WorldPack.sights`, Regeln in mitwachsen-sight.ts): Spielzeug, zu dem das Kind
// hingeführt wird, bis es es einmal gefunden hat. Vom Bett nach hinten: die Kristall-Laterne (solange sie auf ihrem
// Sockel steht), das Säulen-Glockenspiel in der Kristallhalle (dort wohnen auch die Lichtgeister, sie brauchen keinen
// eigenen Eintrag), die Netze der Tupfspinnen (das nächste) und das Ende des Holzstegs am stillen See, an dem der
// Grottenolm auftaucht. Der Ruf ist der eigene Klang. Halte der Bahnen trägt der Kern von selbst ein.
// Wer hier ein neues Spielzeug baut, trägt es ein (Regel in CLAUDE.md).

import { jettyEnd } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { cellsOf, type Sight } from '../../mitwachsen-sight';
import { lanternSpot } from './mitwachsen-lantern';
import { CAVE_PLACE_SIGHTS } from './mitwachsen-cave-places-look';
import { webs } from './mitwachsen-spider';

export const SIGHTS: readonly Sight[] = [
  {
    id: 'hoehle:laterne',
    cells: (world) => {
      const spot = lanternSpot(world);
      return world.cell(...spot).deco === 'lantern' ? [spot] : []; // ohne Grotte kein Sockel
    },
    ready: (s) => s.lamp !== 'hoehle',
    call: (_, [x, y]) => ({ type: 'lantern', x, y }),
    color: '#ffe08a',
  },
  {
    id: 'hoehle:saeulen',
    cells: (world) => cellsOf(world, 'hoehle', 'saeulen', (c) => c.deco === 'column'),
    call: (world, [x, y]) => ({ type: 'column', x, y, note: world.cell(x, y).note ?? 0 }),
    color: '#b48cf0',
  },
  {
    id: 'hoehle:netze',
    cells: (world) => webs(world),
    call: (_, [x, y]) => ({ type: 'web', x, y }),
    color: '#f3ecff',
  },
  {
    id: 'hoehle:steg',
    cells: (world) => cellsOf(world, 'hoehle', 'steg', (c) => c.deco === 'jetty' && jettyEnd(c)),
    call: (_, [x, y]) => ({ type: 'olm', x, y }),
    color: '#6fd6f0',
  },
  ...CAVE_PLACE_SIGHTS, // Leuchtpilze, Kristalltürmchen, Zahlen-Kristalle, Echo-Wand (Issue 56)
];
