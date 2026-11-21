// Torplatten in der 3D-Ansicht: vor jedem großen Tor ein flacher, ovaler Stein aus Voxeln (mitwachsen-plate.ts), Rand
// in der Farbe der Welt; was das Welt-Paket beiträgt (`GateLook.plate`, Eis: Scholle mit Schneeflocke), legt es darauf.
// Tritt die Figur darauf, sinkt er fast einen Voxel ein (`DIP`) und der Rand leuchtet heller; nur Bild, keine Regel.
// Führt der verlaufene Pinguin zu ihrem Tor, ist ihr Rand golden und pulsiert (`plateGold`, wie in 2D).
// Die Platte hängt im Torhaus ihres Tors und wird mit ihm gebaut. Wird nur mit der 3D-Ansicht nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore)

import { Group, Mesh, type Material, type MeshBasicMaterial } from 'three';
import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { plateGold } from './mitwachsen-guest-look';
import { Vox, parts, type Parts } from './mitwachsen-gate-kit';
import {
  PLATE_LEN,
  PLATE_ROW,
  PLATE_STONE,
  PLATE_VOX,
  SINK,
  plateSink,
  plateVoxel,
  type PlateFx,
  type PlateLook,
} from './mitwachsen-plate';

/**
 * So tief sinkt sie in 3D ein: knapp einen Voxel, ihre Oberseite bleibt über dem Boden (er liegt genau auf Höhe h,
 * früher lag dort die goldene Bucht 0,02 darüber). Läge sie in derselben Ebene wie der Boden, flackerte sie, während das Kind darauf steht.
 */
export const DIP = SINK - 0.045;

/**
 * Voxel der Torplatte des Tors `id` in Torhaus-Koordinaten (x entlang des Tors, +z zur Lichtung): Reihe `PLATE_ROW` der
 * Bucht, einen Voxel dick über dem Boden (y 0 … 1/8). Rand in `bright` (leuchtet; `gold`: golden statt in der Farbe
 * der Welt), Fläche und Zeichen in `solid`.
 */
export function plateParts(p: Parts, id: GateId, look?: PlateLook, gold = false) {
  const [side, top] = look?.face ?? PLATE_STONE;
  const v = new Vox();
  for (let i = 0; i < PLATE_LEN; i++)
    for (let k = 0; k < PLATE_VOX; k++) {
      const kind = plateVoxel(i, k, look?.mark);
      const at = [i - PLATE_LEN / 2, 0, k + (PLATE_ROW - 0.5) * PLATE_VOX] as const;
      if (kind === 'rim') v.set(...at, gold ? GOLD.top : THEME_COLORS[id].portal, 'bright');
      else if (kind === 'mark') v.set(...at, '#ffffff');
      else if (kind) v.set(...at, side, 'solid', top);
    }
  v.emit(p);
}

/**
 * Die Torplatten: je Tor eine Gruppe, die die 3D-Ansicht in ihr Torhaus hängt (`of`, mit ihm neu gebaut). Die Platte
 * liegt auf derselben Höhe wie die Tormitte (beide Felder haben Höhe 1, geprüft in mitwachsen-world.test.ts).
 */
export class Plates3D {
  private plates = new Map<GateId, { group: Group; rim: MeshBasicMaterial; gold: boolean }>();

  /** `solid`: Stein (beleuchtet, mit Nebel); `glow()` legt je Platte ein Leuchtmaterial für den Rand an (mit Nebel) */
  constructor(
    private readonly solid: Material,
    private readonly glow: () => MeshBasicMaterial,
  ) {}

  /**
   * Platte des Tors `id` neu bauen, geschmückt mit dem, was das Welt-Paket hinter ihm beiträgt (`look`); `gold`: Der
   * Pinguin führt zu diesem Tor, der Rand ist golden und pulsiert
   */
  of(id: GateId, look?: PlateLook, gold = false): Group {
    this.plates.get(id)?.rim.dispose(); // ihre Geometrie räumt das Torhaus mit ab
    const p = parts();
    plateParts(p, id, look, gold);
    const rim = this.glow();
    const group = new Group();
    for (const [geo, mat] of [
      [p.solid, this.solid],
      [p.bright, rim],
    ] as const) {
      const m = new Mesh(geo.build(), mat);
      m.receiveShadow = true;
      group.add(m);
    }
    this.plates.set(id, { group, rim, gold });
    return group;
  }

  /**
   * Je Bild: Die betretene Platte sinkt ein (bei reduzierter Bewegung ohne Übergang), ihr Rand leuchtet heller; ein
   * goldener Rand pulsiert (bei reduzierter Bewegung ruhig und hell)
   */
  sync(fx: PlateFx | null, now: number, reduced: boolean) {
    for (const [id, p] of this.plates) {
      p.group.position.y = (-plateSink(fx, id, now, reduced) * DIP) / SINK;
      const pulse = p.gold ? 0.55 + 0.45 * plateGold(now, reduced) : 0.75;
      p.rim.color.setScalar(fx?.id === id && fx.on ? 1 : pulse);
    }
  }
}
