// „Noch nicht“ an einem großen Tor in Bild und Ton: Steht die Figur auf seiner Torplatte und fehlt noch etwas (`hint`
// in mitwachsen-guide.ts), leuchtet im Torzeichen zweimal ein leerer goldener Umriss dessen, was fehlt (aus dem Modell
// der Art gerastert, 2D und Ebene über 3D), es klingt „hm-hm?“, der Riegel
// klappert, der Klangstein summt das Motiv (`notYet`), und die Live-Region sagt es. Nie ein Fehlerton, nie Rot. In 3D
// wackeln dazu die Flügel (`hintShake` in mitwachsen-gate-motion-3d.ts). Nachgeladen, sobald die Figur zum ersten Mal
// auf die Platte des Eistors tritt (`import()` aus dem Welt-Paket der Eis-Welt, worlds/eis/mitwachsen-plate-hint.ts),
// nie mit der Spielseite: eigene Grenze im Bundle-Gate (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Regel 8a „Noch nicht“, „Was angezeigt wird“: Große Tore)

import type { Part, Projection } from '../../lib/games/front';
import { SPECIES, type GateId, type SpeciesId } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { PLATE_TUNE, plateHz, type Scored, type Sfx } from './sfx';
import type { World } from './mitwachsen-world';
import { GUIDE_GATE, type HintDraw } from './mitwachsen-guide';

/** So lange (ms) zeigt das Tor, was fehlt; der Umriss pulsiert zweimal je 0,8 s */
export const HINT_MS = 1600;
const PULSE = HINT_MS / 2;
/** So viele Pixel misst der Umriss in der Länge oder Höhe, je `HINT_PX` Felder: knapp 3 Felder, gut zu erkennen */
export const SIL = 16;
export const HINT_PX = 0.18;
/** Unterkante des Umrisses über dem Boden (wie der Umriss des Pinguins, zwischen den Eisenbändern der Tür) */
export const HINT_Y = 1;

/**
 * „Hm-hm?“ am Tor `id`: ein weicher, fragender Doppelton (eine Quarte hinauf), mit jedem Wackeln der Tür (0 und 0,8 s)
 * klappert leise der Riegel (ganz kurz und hoch; bei reduzierter Bewegung wackelt nichts, also klappert auch nichts),
 * dann summt der Klangstein davor einmal das Motiv der Torplatte, eine Oktave tiefer. Alles in der Pentatonik der
 * Welt, nichts fällt wie das Anstoßen, höchstens zwei Stimmen zugleich, nach gut 2 s vorbei
 */
export const notYet = (id: GateId, reduced?: boolean): Scored[] => [
  [plateHz(id, -5), 0.18, 'sine', 0.1, 1, 0],
  [plateHz(id, 0), 0.26, 'sine', 0.1, 1, 0.22],
  ...(reduced ? [] : [0, 0.8]).map((at): Scored => [plateHz(id, 24), 0.03, 'triangle', 0.03, 1, at]),
  ...PLATE_TUNE.map((n, i): Scored => [plateHz(id, n - 12), 0.2, 'sine', 0.05, 1, 1 + i * 0.24]),
];

/**
 * Leerer Umriss einer Art von der Seite (Kopf nach rechts), aus den Quadern ihres Modells gerastert, je Zeile von oben:
 * 'o' golden (der Rand und die Augen der Seite als Merkmal, sonst läse man nur einen Ring), '.' leer. Höchstens `SIL`
 * Pixel lang oder hoch. Ein Quader füllt die Pixel, deren Mitte er deckt; ist er dünner als ein Pixel (Ohren, Augen),
 * jedes, das er berührt, so geht nichts verloren.
 */
export function silhouette(parts: readonly Part[]): string[] {
  const [f0, f1, u0, u1] = parts.reduce(
    ([a, b, c, d], p) => [Math.min(a, p[0]), Math.max(b, p[0] + p[3]), Math.min(c, p[2]), Math.max(d, p[2] + p[5])],
    [9, -9, 9, -9],
  );
  const px = Math.max(f1 - f0, u1 - u0) / SIL;
  const [cols, rows] = [f1 - f0, u1 - u0].map((len) => Math.round(len / px)) as [number, number];
  // deckt [a, a + len] das Pixel ab `lo`?
  const covers = (a: number, len: number, lo: number) =>
    len < px ? a < lo + px && a + len > lo : a <= lo + px / 2 && a + len > lo + px / 2;
  const hit = (c: number, r: number, eye?: boolean) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    parts.some(
      (p) => (!eye || p[8] === 'r') && covers(p[0], p[3], f0 + c * px) && covers(p[2], p[5], u1 - (r + 1) * px),
    );
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      hit(c, r) && (!hit(c - 1, r) || !hit(c + 1, r) || !hit(c, r - 1) || !hit(c, r + 1) || hit(c, r, true))
        ? 'o'
        : '.',
    ).join(''),
  );
}

/**
 * Wie hell der Umriss ist (0 … 1), `t` ms nachdem das Tor ihn zu zeigen begann: Er leuchtet zweimal auf und vergeht
 * wieder, nur über die Deckkraft (darum auch bei reduzierter Bewegung); nach `HINT_MS` 0
 */
export const hintGlow = (t: number) => (t >= 0 && t < HINT_MS ? Math.sin((Math.PI * (t % PULSE)) / PULSE) : 0);

/**
 * Leerer goldener Umriss der Art `species` im Zeichen des Tors `id` (2D und Ebene über 3D, Projektion `P`): zur Kamera
 * gewandt, unten auf der Höhe `HINT_Y` vor der Tür, `t` ms nach Beginn (pulsierend, `hintGlow`); je Pixel Gold mit
 * einem dunkleren Schatten, so hebt es sich vom Holz ab. Gold aus den Tokens, die einzige Aktionsfarbe
 */
export function hintOutline(
  ctx: CanvasRenderingContext2D,
  world: World,
  P: Projection,
  id: GateId,
  rows: readonly string[],
  t: number,
) {
  const g = world.gates.get(id);
  const glow = hintGlow(t);
  if (!g || !glow) return;
  const [x, y] = [g.mid[0] + 0.5 - g.out[0] / 4, g.mid[1] + 0.5 - g.out[1] / 4];
  const z = world.cell(...g.mid).h + HINT_Y;
  ctx.globalAlpha = glow;
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const at = (dc: number, dr: number) =>
        P(x + (c + dc - row.length / 2) * HINT_PX, y, z + (rows.length - r - dr) * HINT_PX);
      const [[ax, ay], [bx, by]] = [at(0, 0), at(1, 1)];
      ctx.fillStyle = GOLD.side;
      ctx.fillRect(ax + 1, ay + 1, bx - ax, by - ay);
      ctx.fillStyle = GOLD.light;
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    }),
  );
  ctx.globalAlpha = 1;
}

/**
 * Das Tor `id` zeigt ab `since` (ms), dass `species` fehlt: spielt „hm-hm?“ (`notYet`, bei reduzierter Bewegung ohne
 * Riegel), sagt es in der Live-Region des Spiels (`.mw-say`), jedes Mal, auch denselben Text (erst leeren, dann setzen,
 * sonst schweigt der Screenreader), und liefert die Zeichnung des Umrisses
 */
export function showHint(
  sfx: Pick<Sfx, 'score'>,
  species: SpeciesId,
  since: number,
  reduced?: boolean,
  id: GateId = GUIDE_GATE,
): HintDraw {
  const say = document.querySelector('.mw-say');
  sfx.score(notYet(id, reduced));
  if (say) {
    say.textContent = '';
    setTimeout(() => (say.textContent = `Noch nicht. Es fehlt noch: ${SPECIES[species].name}`), 99);
  }
  const rows = silhouette(SPECIES[species].parts);
  return (ctx, world, P, now) => hintOutline(ctx, world, P, id, rows, now - since);
}
