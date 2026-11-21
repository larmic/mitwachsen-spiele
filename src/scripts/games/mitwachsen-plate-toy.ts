// Torplatte als Spielzeug in der Ansicht: merkt sich (flüchtig, nie gespeichert), welche Platte die Figur zuletzt
// betreten oder verlassen hat (`PlateFx`, für 2D und 3D: einsinken, hochspringen, Rand leuchtet) und spielt dazu: Betreten
// klonkt (Eis: klirrt, Klang aus dem Welt-Paket) und spielt den nächsten Ton des Motivs, beim fünften glitzert die
// Platte (auch bei reduzierter Bewegung); Verlassen ploppt. Keine Begegnung, keine Regel: Die Figur läuft weiter.
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore, Begriff „Torplatte“)

import { PLATE_TUNE, plateTones, plopp, type Sfx } from './sfx';
import { plateMid, type PlateFx } from './mitwachsen-plate';
import { portalColor } from './mitwachsen-portal';
import type { View2D } from './mitwachsen-view';
import type { World } from './mitwachsen-world';

type Spot = { x: number; y: number; z: number };
type Point = { x: number; y: number };
type Packs = readonly { id: string; view?: Pick<View2D, 'clink'> }[];

/**
 * Spielzeug der Torplatten: liefert eine Funktion, die je Bild nachsieht, ob die Figur seit dem letzten Bild eine
 * Platte betreten oder verlassen hat, dazu spielt (`packs`: Klang der Platte aus dem Welt-Paket; `glint`: kurzes
 * Glitzern über einem Punkt, auch bei reduzierter Bewegung) und liefert, was die Ansicht zeigt. `at`: wo der Körper der
 * Figur gerade ist (gerundet aufs Feld, nicht das Ziel ihres Schritts): Klonk und Einsinken kommen, wenn die
 * Füße die Platte erreichen. In einer neuen Welt (auch wenn ein Welt-Paket ankam) merkt sie nur, wo die Figur steht,
 * ohne Ton: Steht sie beim Laden auf einer Platte, ist diese gleich eingesunken. Schläft die Figur auf der Platte ein
 * (sie liegt dann im Bett), springt die Platte still hoch; aufwachen kann sie dort nicht (sie wacht am Bett auf).
 */
export function plateToy(sfx: Pick<Sfx, 'score'>, glint: (at: Spot, colors: readonly string[]) => void) {
  let fx: PlateFx | null = null;
  let tune = 0; // so oft hintereinander auf dieselbe Platte getreten (0 beim ersten Mal): der Ton des Motivs
  let seen: World | null = null;
  return (world: World, at: Point, sleeping: boolean, packs: Packs, now: number): PlateFx | null => {
    const id = sleeping ? undefined : world.cell(Math.round(at.x), Math.round(at.y)).plate;
    const was = fx?.on ? fx.id : undefined;
    const fresh = world !== seen;
    seen = world;
    if (fresh) tune = -1; // das nächste Betreten beginnt das Motiv
    if (id === was) return fx;
    if (id && !fresh) tune = fx?.id === id ? tune + 1 : 0;
    // `was` ist beim Verlassen gesetzt, sonst wäre id === was
    fx = id ? { id, since: fresh ? -Infinity : now, on: true } : fresh ? null : { id: was!, since: now, on: false };
    if (fresh || sleeping) return fx; // neue Welt, eingeschlafen: still
    if (!id) sfx.score(plopp(was!));
    else {
      sfx.score(plateTones(id, tune, packs.find((p) => p.id === id)?.view?.clink));
      const [px, py] = plateMid(world.gates.get(id)!); // die Platte liegt vor ihrem Tor
      if (tune % PLATE_TUNE.length === PLATE_TUNE.length - 1)
        glint({ x: px, y: py, z: world.cell(px, py).h }, [portalColor(id), '#ffffff']);
    }
    return fx;
  };
}
