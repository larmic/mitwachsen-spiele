// Texte der Startseite (/), alle an einer Stelle.
//
// PLATZHALTER: Die Texte hier sind vorläufig. Sie stammen aus dem Text für Eltern auf larmic.de (/spiele/mitwachsen/,
// docs/games/README.md) und sollen nur zeigen, wie viel Text wohin passt. Jede Stelle mit „Platzhalter“ ist zu
// ersetzen. Die Eckdaten (Alter, Steuerung, …) kommen weiter aus src/content/games/mitwachsen.md.
//
// Blöcke (`block`) sind die Würfel-Symbole aus src/lib/voxel/blocks.ts: grass, dirt, stone, log, leaves, plank, pilz.

/** Adresse des Spiels: Ziel aller „Spiel starten“-Buttons */
export const PLAY_URL = '/spielen/';

/** Kopf der Seite im Himmel */
export const HERO = {
  title: 'Mitwachsen',
  // Platzhalter
  subtitle: 'Ein ruhiges Spiel für Kinder ab 3 Jahren – gespielt zusammen mit Mama oder Papa.',
  // Platzhalter
  intro:
    'Das Kind läuft über eine Lichtung, findet verlorene Tiere und bringt sie nach Hause. Ihr sitzt daneben, erzählt und entscheidet, wann Schluss ist.',
  cta: 'Spiel starten',
  more: 'Mehr für Eltern',
};

/** Abschnitt „Was ist Mitwachsen?“ */
export const ABOUT = {
  title: 'Was ist Mitwachsen?',
  // Platzhalter
  paragraphs: [
    'Mitwachsen ist ein Spiel im Browser für Kinder ab 3 Jahren. Es gibt keine Punkte, keinen Zeitdruck und nichts, was man falsch machen kann.',
    'Gebaut hat es ein Vater für seinen Sohn: einfach, langsam und so, dass man gut wieder aufhören kann.',
  ],
  // Bildunterschrift zum Bild der Lichtung (src/assets/games/mitwachsen.webp)
  shotAlt:
    'Die Lichtung im Spiel: in der Mitte das Bett und die Figur, rundherum Hase, Igel, Schaf, Ente, Frosch und Biene, links ein Futtertrog, rechts ein Wassertrog, am Rand leuchtende Portale',
  // Platzhalter
  shotCaption: 'Die Lichtung: Hier wohnen die Tiere, die das Kind schon gefunden hat.',
  // Eckdaten zusätzlich zu denen aus src/content/games/mitwachsen.md
  facts: [
    ['Kosten', 'kostenlos, ohne Werbung'],
    ['Spielstand', 'bleibt im eigenen Browser'],
  ] as [string, string][],
};

/** Abschnitt „So spielt ihr zusammen“: drei Karten */
export const TOGETHER = {
  title: 'So spielt ihr zusammen',
  // Platzhalter (alle drei Karten)
  steps: [
    {
      block: 'grass',
      title: 'Das Kind steuert',
      text: 'Mit den Pfeiltasten oder per Touch. Lesen muss niemand, alles Wichtige zeigt das Bild.',
    },
    {
      block: 'plank',
      title: 'Ihr sitzt daneben',
      text: 'Ihr erzählt, lest die kleinen Geschichten vor und redet über das, was ihr gerade seht.',
    },
    {
      block: 'pilz',
      title: 'Am Ende ins Bett',
      text: 'Die Figur legt sich schlafen, es wird Nacht, und für heute ist das Spiel vorbei.',
    },
  ],
};

/** Abschnitt „Wächst mit“: eine Säule je Altersstufe, jedes Jahr ein Block höher */
export const STAGES = {
  title: 'Wächst mit eurem Kind',
  // Platzhalter
  intro:
    'Jedes Jahr kommt etwas dazu, das zum Alter passt. Die Welt mit allen gefundenen Tieren bleibt dabei dieselbe.',
  // Platzhalter (Stufen ab 4 und ab 5 sind Ideen, Stand: docs/games/README.md)
  list: [
    { age: 'ab 3 Jahren', status: 'spielbar', text: 'Laufen, die Lichtung erkunden, Tiere finden, schlafen gehen.' },
    { age: 'ab 4 Jahren', status: 'geplant', text: 'Blöcke bauen und abbauen, Vorlagen nachbauen.' },
    { age: 'ab 5 Jahren', status: 'geplant', text: 'Kleine Aufgaben und Zählen.' },
  ],
};

/** Abschnitt Bildschirmzeit */
export const SCREEN_TIME = {
  title: 'Bildschirmzeit mit Maß',
  // Platzhalter
  intro:
    'Fachleute empfehlen für Kinder zwischen 3 und 6 Jahren höchstens kurze Zeiten am Bildschirm und dass Eltern dabei sind. Mitwachsen hilft dabei, ohne etwas abzubrechen.',
  // Platzhalter (Zeiten wie im Spiel, src/scripts/games/mitwachsen-tired.ts)
  marks: [
    { time: '15 Min.', text: 'Die Figur wird zum ersten Mal müde.' },
    { time: '20 Min.', text: 'Sie wird noch müder.' },
    { time: '25 Min.', text: 'Sie möchte ins Bett.' },
  ],
  // Platzhalter
  note: 'Wann Schluss ist, entscheidet ihr. Beim ersten Start zeigt das Spiel einen kurzen Hinweis für Eltern mit den Empfehlungen und Quellen.',
};

/** Abschnitt „Versprochen“: Liste mit Häkchen */
export const PROMISES = {
  title: 'Darauf könnt ihr euch verlassen',
  // Platzhalter
  items: [
    'Keine Werbung und nichts zu kaufen',
    'Keine Anmeldung und kein Konto',
    'Kein Tracking und keine Cookies',
    'Keine Punkte, keine Tagesbelohnung, kein Zeitdruck',
    'Der Spielstand bleibt im eigenen Browser',
    'Kostenlos',
  ],
};

/** Schluss mit zweitem „Spiel starten“ */
export const CLOSING = {
  // Platzhalter
  title: 'Lust auf eine Runde?',
  // Platzhalter
  text: 'Am besten am Computer oder Tablet, mit dem Kind auf dem Schoß.',
};
