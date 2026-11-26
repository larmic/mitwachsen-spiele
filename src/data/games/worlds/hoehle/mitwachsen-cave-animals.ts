// Höhlen-Tiere in der Kristallgrotte: Wohnorte (Fundorte) je Art. Nur das Welt-Paket der Höhlenwelt
// (src/scripts/games/worlds/hoehle/) liest diese Daten; Name, Ton, Gangart und Futter kennt der Kern (`CAVE_SPECIES`
// und `CAVE_FOOD` in mitwachsen-hoehle.ts), die Modelle stehen in mitwachsen-cave-models.ts.
// Konzept: docs/games/mitwachsen.md (Höhlenwelt) · Spec: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import type { CaveSpeciesId } from '../../mitwachsen-hoehle';

/**
 * Fundorte der Höhlen-Tiere: freier Grottenboden (`floor`), der Pilzgarten mit seinen Leuchtpilzen (`shrooms`), der
 * Lehmhang daneben (`clay`, der Hang des Dachses), der Steg am stillen See (`jetty`), der Geröllhang (`scree`) und
 * der Kristallbogen (`arch`, nur die Felder unter dem Bogen, an denen man hängen kann)
 */
export type CaveHaunt = 'floor' | 'shrooms' | 'clay' | 'jetty' | 'scree' | 'arch';

/**
 * Fundorte über die ganze Grotte, in der Reihenfolge der Leiste: `at` [quer, vom Tor weg] von der Mündung aus sagt, wo;
 * dort sucht die Grotte das nächste Feld mit dem Thema `near` und darum das nächste erreichbare Feld. Das erste Tier
 * jeder Art wohnt dort, die anderen drei verteilt der Seed über die Grotte. Der erste Maulwurf wohnt gegenüber dem
 * Platz des Bahnhofs, solange es die Bahn nicht gibt (Blick hinein); mit der Bahn sitzt er auf Toks Helm und zieht nach
 * Bau 2 ins Gehege am Höhlenbett (`WorldPack.away` im Paket der Bahn). Der Siebenschläfer schläft vorn im Lokschuppen
 * (in seiner ersten Reihe, nah am Gleis; der Lokschuppen kommt mit Bau 2), der Dachs am
 * Lehmhang neben dem Pilzgarten (liegt die Schleife der Grubenbahn auf dieser Seite, rückt er mit dem Hang hinter ihre Umkehr), die Glühwürmchen zwischen den Leuchtpilzen, die Fledermaus unter dem Kristallbogen, der
 * Grottenolm am Steg, Murmeltier und Sonnen-Eidechse auf dem Geröllhang am See.
 */
export const CAVE_ANIMALS: readonly { species: CaveSpeciesId; near: CaveHaunt; at: readonly [number, number] }[] = [
  { species: 'maulwurf', near: 'floor', at: [-6, 13] },
  { species: 'dachs', near: 'clay', at: [-36, 43] },
  { species: 'grottenolm', near: 'jetty', at: [0, 109] },
  { species: 'eidechse', near: 'scree', at: [22, 112] },
  { species: 'siebenschlaefer', near: 'floor', at: [9, 13] },
  { species: 'fledermaus', near: 'arch', at: [25, 57] },
  { species: 'murmeltier', near: 'scree', at: [28, 120] },
  { species: 'gluehwuermchen', near: 'shrooms', at: [-22, 50] },
];

/** So hoch über dem Boden hängt man unter dem Kristallbogen (Unterkante des Bogens, `Cell.perch`) */
export const ARCH_PERCH = 3;
