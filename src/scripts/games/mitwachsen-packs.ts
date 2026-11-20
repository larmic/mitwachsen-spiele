// Welt-Pakete laden (Browser): per import() aus dem Netz oder dem Cache des Service Workers, bevor die Welt entsteht.
// Scheitert das oder dauert es zu lange (Netz hängt beim ersten Besuch), läuft das Spiel ohne diese Welt weiter, still
// wie ohne WebGL: Hinter ihrem Tor steht eine Eisklippe, der Spielstand behält alles für den nächsten Start.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { GuideRules } from './mitwachsen-guide';
import type { WorldPack } from './mitwachsen-pack';

/** Ein geladenes Welt-Paket mit den Regeln, die es der Ansicht mitbringt */
export type LoadedPack = WorldPack<GuideRules>;

/** So lange wartet der Start höchstens auf die Pakete, dann geht es ohne sie los */
export const PACK_WAIT_MS = 4000;

export const loadPacks = (): Promise<LoadedPack[]> =>
  Promise.race([
    import('./worlds/eis').then(
      (m) => [m.pack],
      () => [],
    ),
    new Promise<LoadedPack[]>((done) => setTimeout(() => done([]), PACK_WAIT_MS)),
  ]);
