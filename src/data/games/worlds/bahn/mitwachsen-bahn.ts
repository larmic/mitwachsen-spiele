// Höhlenbahn: Maße der Linie und Farben des Gleises. Nur das Paket der Bahn (src/scripts/games/worlds/bahn/) liest diese
// Daten; es wird nachgeladen, und bis zum Freischalten (`BAHN_LIVE`) holt es nur der Entwickler-Schalter.
// Konzept: docs/games/mitwachsen.md (Höhlenwelt, Tok und die Bahn) · Spec: docs/specs/mitwachsen.md („Tok und die Bahn“)

/**
 * Die eine Linie von Bahnhof Bär auf der Lichtung durch das Höhlentor zum Bahnhof Fledermaus in der Grotte. Lagen in der
 * Bucht vor dem Höhlentor in u (quer, wie in mitwachsen-bay.ts: die Torplatte −1 … 1, Toks Platz +2) und t (Reihen vor
 * der Tür, negativ zur Lichtung hin).
 */
export const LINE = {
  /**
   * Bahnhof Bär: Mitte `r` Felder vom Bett, `angle` Grad neben dem Strahl vom Bett zum Höhlentor (für jeden Seed), zuerst
   * auf der Seite der Spur (u −2); Bahnsteig `wide` × `long` Felder, das nächste Feld `steps` Schritte vom Bett. Jedes
   * Feld mindestens `ring` Felder vom Bett (außerhalb des Portalrings, r 9) und `gap` Felder (Chebyshev) fern von
   * Plattformen, Wiese, Trögen, Wasser, Klangsteinen, Torplatten und dem Fußweg zum Tor (der Fußweg weicht ihm aus)
   */
  bear: { r: [13, 16], angle: [20, 30], steps: [12, 16], long: 7, wide: 2, ring: 10.5, gap: 2 },
  /** Spur des Gleises in der Bucht und im Gang: u −2, am Rand der Tür (Platte −1 … 1, Toks Platz +2, Warteplätze |u| ≥ 3) */
  lane: -2,
  /** Vor der Bucht (drei Reihen vor der Tür) liegen `cut` Felder Einschnitt, davor das Tunnelportal, davor `lead` Felder gerade */
  cut: 3,
  lead: 3,
  /** Mindestens so viele Felder Gerade zwischen zwei Kurven (alle rechtwinklig) */
  straight: 4,
  /** Rampen: höchstens eine Stufe je so viele Felder */
  ramp: 3,
  /** Eine Kurve kostet die Suche so viel wie so viele Felder mehr (lieber gerade), eine Stufe eines */
  turn: 3,
  /**
   * Auf der Lichtung darf das Gleis tiefer liegen als das Gelände (ein Einschnitt durch einen Hügel, die Ränder rücken mit
   * herunter); jede Stufe tiefer kostet die Suche so viel wie so viele Felder mehr
   */
  dig: 1,
  /** Durch einen Teich führt das Gleis auf einem Damm (das Wasser dort wird Gras); jedes Feld Damm kostet so viel mehr */
  dam: 4,
  /** Gesucht wird in einem Rechteck um Anfang und Ende der Strecke, so viele Felder Rand */
  margin: 14,
  /**
   * Grenzen der Suche, damit der Bau einer Welt nie lange dauert: höchstens so viele Plätze für Bahnhof Bär bekommen eine
   * ganze Trassen-Suche, und jede Suche schaut höchstens so viele Zustände an (dann gilt der Platz als unpassend)
   */
  tries: 6,
  budget: 200_000,
} as const;

/**
 * Farben des Gleises: Holzschwellen und graue Schienen, roter Prellbock mit dunklen Puffern, Tunnelportal aus lila-grauem
 * Stein (wie die Bänder am Höhlentor) mit Grasdach. Je Paar Seite und Oberseite. Kein Gold: das ist die Aktionsfarbe
 */
export const RAIL_COLORS = {
  sleeper: ['#8a5a34', '#a8723f'],
  rail: ['#9aa0ab', '#c9c6d6'],
  buffer: ['#d9483b', '#e0574a'],
  pads: '#1d2838',
  stone: ['#6e6688', '#7b7396'],
  grass: ['#5c9e34', '#6dbd47'],
} as const;

/**
 * Bau 1 (Tok baut Bahnhof Bär und das Gleis bis vor das Höhlentor): so viele Takte zu 0,1 s (`ticks`, 8 s) und was wann
 * geschieht, als Bruchteil des Baus (0 … 1): die Hacke klopft dreimal (`pink`), Bahnhof Bär ploppt auf (`pop`), die
 * Gleiswelle läuft vom Bahnhof bis an den Prellbock in der Bucht (`wave`, bei reduzierter Bewegung in drei Stufen), der Zug
 * rollt ein (`roll`, mit Pfiff), „Ding-Dong“ (`ding`), die Tür geht auf (`door`, „pff“), Tok steigt in den hinteren Wagen
 * (`board`, „Ju-hu“)
 */
export const BUILD = {
  ticks: 80,
  pink: 0,
  pop: 0.1,
  wave: [0.15, 0.45],
  roll: [0.45, 0.8],
  ding: 0.82,
  door: 0.87,
  board: 0.92,
} as const;
