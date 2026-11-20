// Welt-Pakete laden (Browser): per import() aus dem Netz oder dem Cache des Service Workers, aber erst, wenn ihr Tor
// eine Rolle spielt (`needsPack`, mitwachsen-pack.ts). Braucht eine Welt das Paket schon beim Öffnen, wartet der Start
// höchstens `PACK_WAIT_MS` darauf; sonst kommt es im Takt nach, sobald es nötig wird, und wird in die laufende Welt
// eingebaut (`arrive`). Scheitert das Laden, läuft das Spiel ohne diese Welt weiter, still wie ohne WebGL: Hinter ihrem
// Tor steht eine Eisklippe, der Spielstand behält alles; beim nächsten Bedarf (frühestens nach `RETRY_MS`) neu versucht.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Part } from '../../lib/games/front';
import { SPECIES, type GateId, type Point, type SpeciesId } from '../../data/games/mitwachsen';
import type { GuideRules } from './mitwachsen-guide';
import { needsPack, type Need } from './mitwachsen-pack';
import type { WorldPack } from './mitwachsen-pack-types';
import type { View2D } from './mitwachsen-view';
import { beyondRing } from './mitwachsen-world';

/** Ein geladenes Welt-Paket mit den Regeln und Zeichenteilen, die es der Ansicht mitbringt */
export type LoadedPack = WorldPack<GuideRules, View2D>;

/** So lange wartet der Start höchstens auf ein Paket, das die Welt gleich braucht; dann geht es ohne los */
export const PACK_WAIT_MS = 4000;
/** Nach einem gescheiterten Laden frühestens so viel später wieder versuchen */
export const RETRY_MS = 30_000;

const eis = () => import('./worlds/eis').then((m) => m.pack);

/**
 * Modelle von Arten aus einem Welt-Paket eintragen (Eis-Welt: ihre zehn Tiere, `ICE_MODELS`): sobald das Paket
 * ankommt, bevor eines seiner Tiere erscheint. Bis dahin ist ihr Modell leer (der Kern kennt nur Name, Ton, Gangart).
 * Ändert `SPECIES` für die ganze Seite (in Tests: test-worlds.ts ruft es beim Import).
 */
export function addModels(models: Partial<Record<SpeciesId, readonly Part[]>> = {}) {
  for (const [id, parts] of Object.entries(models) as [SpeciesId, readonly Part[]][]) SPECIES[id].parts = parts;
}
const noop = () => {};

/** Die Welt-Pakete einer Spielseite: welche schon da sind, und Laden bei Bedarf */
export class Packs {
  private ready: LoadedPack[] = [];
  private loading: Promise<unknown> | null = null;
  private failedAt = -Infinity;

  /** `arrive`: ein Paket ist angekommen (einbauen), `load` holt es (im Test ersetzbar) */
  constructor(
    private readonly arrive: (pack: LoadedPack) => void,
    private readonly load: () => Promise<LoadedPack> = eis,
  ) {}

  /** Die geladenen Pakete (für `createWorld`) */
  get loaded(): readonly LoadedPack[] {
    return [...this.ready];
  }

  get(id: LoadedPack['id']): LoadedPack | undefined {
    return this.ready.find((p) => p.id === id);
  }

  /** Braucht der Spielstand das Paket und fehlt es noch, wird es geholt; erfüllt, sobald es da ist (oder scheiterte) */
  want(need: Need, gates: ReadonlyMap<GateId, { mid: Point }>, now = performance.now()): Promise<void> {
    if (this.get('eis') || !needsPack(need, gates, beyondRing)) return Promise.resolve();
    if (!this.loading && now - this.failedAt >= RETRY_MS)
      this.loading = this.load().then(
        (pack) => {
          addModels(pack.models);
          this.ready.push(pack);
          this.arrive(pack);
        },
        () => {
          this.failedAt = performance.now();
          this.loading = null;
        },
      );
    return (this.loading ?? Promise.resolve()).then(noop);
  }

  /** Wie `want`, aber höchstens `PACK_WAIT_MS` warten (Öffnen einer Welt: das Netz kann beim ersten Besuch hängen) */
  wait(need: Need, gates: ReadonlyMap<GateId, { mid: Point }>, ms = PACK_WAIT_MS): Promise<void> {
    return Promise.race([this.want(need, gates), new Promise<void>((done) => setTimeout(done, ms))]);
  }
}
