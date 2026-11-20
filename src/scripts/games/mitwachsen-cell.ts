// Ein Feld der Welt von Mitwachsen: Boden, Höhe, Zierde und wozu es gehört. Nur Typen; gebaut wird in
// mitwachsen-world.ts (Lichtung, Landschaft) und mitwachsen-kessel.ts (Eis-Welt).
// Spezifikation: docs/specs/mitwachsen.md

import type { GateId, RegionId } from '../../data/games/mitwachsen';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { PlatformSpot } from './mitwachsen-portal';

export type Ground =
  | 'grass'
  | 'stone'
  | 'water'
  | 'path'
  | 'sand'
  // Welten hinter den Toren
  | 'snow'
  | 'ice'
  | 'basalt'
  | 'lava'
  | 'cave'
  | 'cloud'
  | 'sky' // Leere zwischen den Wolken
  | 'moss';
export type Deco =
  | 'tree'
  | 'bush'
  | 'flower'
  | 'reed'
  | 'lily'
  | 'rock'
  | 'fence'
  | 'gate'
  | 'bridge'
  | 'bed'
  | 'sign'
  | 'hedge'
  | 'arch'
  | 'fern'
  | 'boulder'
  | 'mushroom'
  | 'biggate'
  | 'gatetower' // Turm eines großen Tors (fest; das Torhaus zeichnet die Ansicht)
  | 'portal' // Mittelfeld einer Portal-Plattform: Wer es betritt, reist (wenn die Plattform wach ist)
  | 'portalrim' // Rand einer Portal-Plattform (Seitenmitten und Ecken): begehbar, löst nichts aus
  | 'cactus'
  | 'crystal'
  | 'stalagmite'
  | 'bigshroom'
  | 'cloudpuff'
  | 'trough' // Futtertrog auf der Wiese
  | 'watertrough' // Wassertrog
  | 'shelterpilz' // Stiel des Riesenpilzes auf der Wiese (zeichnet auch den Hut)
  | 'igloo' // feste Rückwand des Iglus (die Mitte zeichnet die Kuppel)
  | 'icebowl' // Futterschale aus Eis auf der Schneewiese
  | 'fishcrate' // Fischkiste im Gletscherkessel: Hineinlaufen fängt Fische ins Netz (fest wie ein Busch)
  | 'klangstein'; // Stein mit schwebender Note: Hineinlaufen spielt die Geschichte des Ortes
export type TreeKind =
  'oak' | 'birch' | 'autumn' | 'red' | 'blossom' | 'winter' | 'pine' | 'snowpine' | 'palm' | 'dead';

export type Cell = {
  h: number; // Oberkante in Ebenen: Wasser 0, Boden 1, Hügel bis 3
  ground: Ground;
  deco: Deco | null;
  color?: string; // Blumenfarbe
  region: RegionId | 'wild' | 'border'; // border: Fels, Zaun oder Wasser zwischen Gegenden
  solid: boolean; // Deko versperrt das Feld (Baum, Busch, Fischkiste, Fels, Zaun, Bett, Tafel)
  gate?: GateId; // Tor oder Brücke: begehbar, sobald offen
  sign?: GateId; // Tafel zu diesem Tor
  garden?: true; // Wiese ums Bett: Hier sind gefundene Tiere zu Hause
  roof?: true; // unter dem Unterstand auf der Wiese
  tree?: TreeKind; // Baumart bei deco 'tree'
  tufts?: number; // Grasbüschel auf dem Feld (nur Zierde, begehbar)
  portal?: PlatformSpot; // Feld einer Portal-Plattform (am Tor oder am Bett)
  biome?: GateId; // Welt hinter einem Tor
  part?: { id: GateId }; // Turm eines Tors: gehört zu dieser Welt
  shade?: number; // Farbfleck im Boden: −1 dunkler … +1 heller (große, weiche Flecken)
  tint?: string; // Farbe, mit der Gras und Blätter auf der Lichtung getönt sind (Stimmung der Richtung)
  story?: StoryId; // Klangstein dieser Geschichte
  slide?: true; // Rutschspur vom Eistor zum Schneebett (begehbar; glänzt, sobald das Tor offen ist)
};
