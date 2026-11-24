// Freigabe der Bahn-Phase von Mitwachsen (Tok, Gleis, Zug, Hau-ruck am Höhlentor): der eine Schalter `BAHN_LIVE`, den
// der letzte Schritt der Bahn („Freischalten“) auf true setzt, und der Blick hinein des Entwickler-Schalters. Eigene
// Datei ohne Importe, weil die Daten der Tore (mitwachsen.ts, `keyOf`) und die Regeln der Pakete sie brauchen.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Tok und die Bahn“, Freigabe)

/**
 * Freigabe der Bahn-Phase (Tok, Gleis, Zug, Hau-ruck am Höhlentor): Solange false, lädt das Spiel das Paket der Bahn
 * nie von selbst (`bahnWanted` in mitwachsen-pack.ts), das Kind sieht nichts davon und das Höhlentor bleibt zu; nur der
 * Entwickler-Schalter (`?entwickler=bahn`, mitwachsen-dev.ts) zeigt sie. Der letzte Schritt („Freischalten“) setzt ihn
 * auf true
 */
export const BAHN_LIVE: boolean = false;
let tried = false; // Blick hinein: die Bahn-Phase nur für diese Seite an (Entwickler-Schalter)
/**
 * Ist die Bahn-Phase an? Freigeschaltet (`BAHN_LIVE`) oder im Blick hinein (`tryBahn`, nur der Entwickler-Schalter
 * `?entwickler=bahn`, nichts wird gespeichert). Daran hängt, ob das Höhlentor einen Schlüssel hat (`keyOf`: Tok, das
 * Hau-ruck); aus, gilt es wie bisher als ein Tor, das nie aufgeht
 */
export const bahnOn = (): boolean => BAHN_LIVE || tried;
/** Bahn-Phase für diese Seite an- oder ausschalten (Entwickler-Schalter, Tests); nur im Arbeitsspeicher */
export const tryBahn = (on = true) => void (tried = on);
