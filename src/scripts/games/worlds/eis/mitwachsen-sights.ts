// Sehenswürdigkeiten der Eis-Welt (`WorldPack.sights`, Regeln in mitwachsen-sight.ts): Spielzeug im Gletschertal, zu dem
// das Kind hingeführt wird, bis es es einmal gefunden hat. Schneehaufen: Es lockt der nächste, der noch kein fertiger
// Schneemann ist; gefunden mit der ersten Kugel. Eiszapfen-Glockenspiel: gefunden mit dem ersten Ton. Der Ruf ist der
// eigene Klang (Ploppen, der Ton des Zapfens). Den Halt des Schlittens trägt der Kern von selbst ein.
// Wer hier ein neues Spielzeug baut, trägt es ein (Regel in CLAUDE.md).

import { cellsOf, type Sight } from '../../mitwachsen-sight';
import type { World } from '../../mitwachsen-world';
import { SNOWMAN, stageAt } from './mitwachsen-snowman';

const HEAPS = 'eis:schneehaufen';
const heaps = (world: World) => cellsOf(world, 'eis', 'schneehaufen', (c) => c.deco === 'snowheap');

export const SIGHTS: readonly Sight[] = [
  {
    id: HEAPS,
    cells: (world, s) => heaps(world).filter(([x, y]) => stageAt(s.packs, x, y) < SNOWMAN),
    call: (_, [x, y]) => ({ type: 'snowman', x, y, stage: 1 }),
    color: '#ffffff',
    marks: (world, s) => (s.found.includes(HEAPS) ? heaps(world) : []), // auf der Karte auch die fertigen Schneemänner
  },
  {
    id: 'eis:glockenspiel',
    cells: (world) => cellsOf(world, 'eis', 'glockenspiel', (c) => c.deco === 'icicle'),
    call: (world, [x, y]) => ({ type: 'icicle', x, y, note: world.cell(x, y).note ?? 0 }),
    color: '#9fe0ff',
  },
];
