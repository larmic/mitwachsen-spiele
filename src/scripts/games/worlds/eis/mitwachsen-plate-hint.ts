// „Noch nicht“ am Eistor in der Ansicht, im Welt-Paket der Eis-Welt (es ist geladen, sobald die Figur dem Tor nah
// ist, `NEAR_GATE`; was fehlt, kennt nur die Eis-Welt: Arten der Lichtung, dann der Pinguin): Je Bild fragt die Ansicht
// über den Haken `View2D.hint`, ob das Tor zeigen soll, was fehlt (`hint` in mitwachsen-guide.ts, rein, im Kern). Bild,
// Ton und Live-Region kommen aus mitwachsen-hint-look.ts (eigene Datei, nachgeladen). Nichts davon wird gespeichert.
// Spezifikation: docs/specs/mitwachsen.md (Regel 8a „Noch nicht“, „Was angezeigt wird“: Große Tore)

import type { SpeciesId } from '../../../../data/games/mitwachsen';
import { GUIDE_GATE, hint, type Guided, type Hint } from '../../mitwachsen-guide';
import type { Sfx } from '../../sfx';
import type { World } from '../../mitwachsen-world';

/**
 * „Noch nicht“ am Eistor in der Ansicht: liefert die Funktion, die je Bild fragt, ob das Tor zeigen soll, was fehlt
 * (`hint` in mitwachsen-guide.ts, rein); sie merkt sich (flüchtig, nie gespeichert), wann es das zuletzt tat. Bild, Ton
 * und Live-Region kommen aus mitwachsen-hint-look.ts, geholt schon, wenn die Figur die Platte betritt (vor der ersten
 * Sekunde Stehen): So beginnen Wackeln der Flügel (ab `at`), Nebel im Gang (`lift(true)`), Ton und Umriss (`draw`) im
 * selben Bild. Kommt das Bild erst später, beginnt alles zusammen, sobald es da ist; fehlt die Datei (ohne Netz und noch
 * nicht gespeichert; sie wird mit dem Spiel vorab gespeichert), bleibt es bis zum nächsten Laden der Seite still, nur
 * der Nebel lichtet sich und die Flügel wackeln. Verlässt die Figur die Platte vorher, kommt nichts nach. Läuft der
 * Takt zurück (eine andere Welt öffnet, sie beginnt bei Takt 0), zählt das letzte Mal nicht mehr, sonst schwiege das
 * Tor dort, bis ihr Takt den alten eingeholt hat. Dreht die 3D-Ansicht zur Torfront (`r3d`), zeigt es erst, wenn sie
 * angekommen ist (p = 1); vorher zählt das Stehen nicht als gezeigt, so kommt es beim Ankommen gleich.
 */
export function plateHint() {
  let shown: Hint & { t: number } = { t: -1e9 }; // t: Takt, an dem das Tor zuletzt zeigte, was fehlt
  let look: typeof import('../../mitwachsen-hint-look') | null | undefined; // null: Holen gescheitert
  let asked = false; // schon geholt (einmal je Seite)
  let due: SpeciesId | undefined; // fehlt, wartet auf das Bild
  return (
    state: Guided,
    world: World,
    now: number,
    reduced: boolean,
    sfx: Pick<Sfx, 'score'>,
    lift: (peek: true) => void,
    r3d?: { arrived(): boolean } | null,
  ): Hint => {
    const on = world.cell(state.player.x, state.player.y).plate === GUIDE_GATE;
    if (on && !asked) {
      asked = true;
      import('../../mitwachsen-hint-look').then(
        (m) => (look = m),
        () => (look = null),
      );
    }
    const sp = r3d?.arrived() === false ? undefined : hint(state, world, state.tick < shown.t ? -1e9 : shown.t);
    if (sp) shown = { t: state.tick };
    due = on ? (sp ?? due) : undefined;
    if (due && look !== undefined) {
      lift(true);
      shown = { t: shown.t, id: GUIDE_GATE, at: now, draw: look?.showHint(sfx, due, now, reduced) };
      due = undefined;
    }
    return shown;
  };
}
