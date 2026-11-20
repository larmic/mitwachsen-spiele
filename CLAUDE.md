# CLAUDE.md

Seite des Kinderspiels Mitwachsen (www.mitwachsen-spiele.de) von Lars Michaelis, im Voxel-Stil. Astro 7, statische Ausgabe, Sprache Deutsch. Das Spiel stammt aus dem Repo von larmic.de.

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen und Inhalts-Schemas prüfen – muss grün sein
npm test         # Guard-Gate: Unit-Tests (Vitest) mit Mindest-Abdeckung der reinen Module (vitest.config.ts) – muss grün sein
npm run lint     # Guard-Gate: ESLint – muss grün sein
npm run format   # Prettier; `npm run format:check` ist das Guard-Gate
npm run arch     # Guard-Gate: Architekturregeln (dependency-cruiser) – muss grün sein
npm run build    # statische Seite nach dist/
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links und Sprungmarken, Bundle-Gate (Startseite ohne Spiel, JS-Budget), Seiten-Gate (keine externen Ressourcen), App-Gate (Manifest, Icons, Service Worker speichert alles fürs Spiel, vorab Gespeichertes im Budget `PRECACHE_BUDGET` in `scripts/verify-pwa.ts`)
npm run test:e2e # Guard-Gate nach dem Build: Smoke-Test im Browser (Playwright, e2e/): Seiten, Spiel, 404, ohne Konsolenfehler; App: Manifest, installierbar laut Chromium (CDP im vollen Chromium, mit Gegenprobe, e2e/installable.spec.ts), Service Worker, Spiel ohne Netz (e2e/pwa.spec.ts), Updates mit zwei Fassungen der Seite (e2e/pwa-update.spec.ts; Fassung 2 leitet e2e/versions.ts vor dem Test aus dist/ ab, der Test-Server liefert sie mit Cookie mw-version=2); Barrierefreiheit nach WCAG 2.2 AA (axe-core, e2e/a11y.spec.ts); einmalig: npx playwright install chromium
npm run gates    # alle Gates in der Reihenfolge der Pipeline
# Git-Hook .githooks/pre-commit (aktiviert durch npm install) prüft vor jedem Commit Formatierung, Lint, Architektur, Tests
```

Vor jedem Commit `npm run format`, `npm run lint`, `npm run arch`, `npm run check`, `npm test`, `npm run build`, `npm run verify` und `npm run test:e2e` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Startseite für Eltern mit „Spiel starten“; Texte in `src/data/landing.ts`, Titel und strukturierte Daten für Suchmaschinen in `src/data/site.ts`, Eckdaten aus `src/content/games/mitwachsen.md`, Styles in `src/styles/landing.css`), `/spielen/` (das Spiel, `noindex`, nicht in der Sitemap), `/datenschutz/`, 404 (Impressum und Kontakt liegen auf larmic.de, der Footer verlinkt dorthin); dazu `favicon.*`, `[icon].png.ts` (apple-touch-icon und Icons der App), `og.png.ts`, `manifest.webmanifest.ts` (beim Build erzeugt)
- `src/layouts/BaseLayout.astro` – Kopfdaten, Schriften, Würfel-Symbole; `PlainPage.astro` – Himmel, Inhalt auf Papier, Footer
- `src/content/` – Eckdaten des Spiels im Frontmatter von `src/content/games/mitwachsen.md` (Rumpf wird nicht gezeigt), Schema in `src/content.config.ts`; alle Texte der Startseite stehen in `src/data/landing.ts`
- `src/components/` – `MitwachsenGame.astro` (Spielfläche), `MitwachsenParentInfo.astro` (Hinweis für Eltern), Kopf, Footer
- Spiel: `src/lib/games/` (Zufall, Stücke, Ansicht von vorn – generisch, läuft im Browser), `src/data/games/mitwachsen.ts` (Gegenden, Tore, Tiere, Figur), `src/data/games/mitwachsen-homes.ts` (Zuhause je Gegend `HOMES`: Bett, Wiese, Tröge, Unterstand relativ zum Bett), `src/data/games/mitwachsen-species.ts` (Form einer Art: Ton, Gangart, Modell), `src/data/games/mitwachsen-eis.ts` (Eis-Welt: Maße des Gletscherkessels `KESSEL`, Eisloch, Fischkisten, Moosfleck, Farben, Netz mit Fischen `FISH_PARTS`, Fischfresser, die zehn Eis-Tiere `ICE_SPECIES` mit Wohnorten `ICE_ANIMALS`), `src/data/games/mitwachsen-portals.ts` (Portal-Plattformen: Voxel-Raster, Farben und Bild je Welt), `src/scripts/games/` (Welt, Regeln und Speichern rein und getestet; `mitwachsen-cell.ts` Typen eines Felds; `mitwachsen-chores.ts` Handgriffe: Beeren pflücken, Fische fangen, Wasser schöpfen, Tröge füllen, Nachwachsen; `mitwachsen-home.ts` Zuhause je Gegend an ihr Bett gelegt und Gegend eines Felds; `mitwachsen-meadow.ts` Wiese und Unterstand je Gegend (Zuhause der Tiere, Plätze auf der Wiese, unter Riesenpilz und Iglu); `mitwachsen-weather.ts` Wetter je Gegend (Regen, Schneefall, Pustewind mit Böen); `mitwachsen-air.ts` Pustewind in Bild und Ton (Wetter dort, wo die Figur ist, Rauschen und Windspiel, Kopfdrehen, Haltungen im Iglu, Schneeeule beim Polarlicht); `mitwachsen-kessel.ts` Gletscherkessel der Eis-Welt hinter dem Eistor (Lage, Gelände, Zuhause, Klangstein, Fischkisten, Moosfleck, Rutschspur); `mitwachsen-border.ts` Weltgrenze am Tor (Durchgang, Warteplätze, warten und wieder einreihen, Wechsel der Gegend); `mitwachsen-free.ts` freie Felder für die Regeln; `mitwachsen-spawns.ts` Wohnorte der Tiere je Gegend; `mitwachsen-gait.ts` Gangart beim Gleiten; `mitwachsen-ice-look.ts` Aussehen von Iglu, Eisschale, Eistrog und Fischkiste für 2D und 3D; `mitwachsen-portal.ts` Lage und Regeln der Portal-Plattformen; `larmic-mitwachsen.ts` Web Component, `mitwachsen-3d.ts` 3D-Ansicht mit Three.js (wird per `import()` nachgeladen; dazu `mitwachsen-geo.ts` Textur-Atlas und Baukasten, `mitwachsen-gatehouse.ts` Torhäuser und Voxel der Plattformen, `mitwachsen-platform-3d.ts` Plattformen und ihre Zustände), `mitwachsen-tired.ts` Müde werden (Medienzeit), `mitwachsen-render.ts` 2D-Ansicht und Ebene darüber (Plattformen in `mitwachsen-platform-2d.ts`, Leben der Richtungen in `mitwachsen-sky.ts`, Leiste unten in `mitwachsen-album.ts`, Pixel-Zeichen und Funken in `mitwachsen-glyphs.ts`, Wetter der Eis-Welt mit Polarlicht in `mitwachsen-ice-sky.ts` und mit ihm das Bild der Weltgrenze in `mitwachsen-border-view.ts`, erst im Kessel oder bei offenem Eistor nachgeladen), `input-pace.ts` ruhiger Takt, `sfx.ts` Töne)
- App (installierbar, ohne Netz spielbar): `src/data/pwa.ts` (Name, Farben, Icons, Ort des Service Workers), `src/lib/pwa/` (`manifest.ts`, `precache.ts` sammelt aus der fertigen Seite, was das Spiel braucht, `sw.ts` Quelltext und Entscheidungen des Service Workers, alles rein und getestet), `src/integrations/service-worker.ts` (schreibt nach dem Build `dist/spielen/sw.js`; `writeServiceWorker` nutzt auch der Browser-Test für Fassung 2), `src/scripts/games/pwa-register.ts` (Anmeldung, nur auf der Spielseite, und Updates an sicheren Stellen), `src/scripts/games/pwa-update.ts` (wann ein Update sicher ist, rein und getestet)
- `src/lib/voxel/` – Würfel-Grafik, läuft beim Build: `textures.ts` (Pixel-Raster, auch vom Spiel genutzt), `render.ts`, `cube.ts`, `blocks.ts` (Würfel-Symbole, Texturen als CSS, Insel `ISLAND` und Säulen `tower` für Startseite und Vorschaubild), `icon.ts` (Favicon und Icons der App)
- `src/data/site.ts` – Titel, Adresse, Kontakt; `src/data/landing.ts` – alle Texte der Startseite
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `scripts/` – Gates nach dem Build: `bundles.ts` (Bundle-Gate), `dist.ts` (Seiten-Gate), `pwa.ts` (App-Gate)
- `docs/design-system.md` – Farben, Typografie, Bausteine
- `docs/games/` – Mitwachsen, wächst mit meinem Sohn: `README.md` (Einleitung, Altersstufen, gemeinsame Regeln), `mitwachsen.md` (Konzept der Stufe ab 3). Vor Arbeiten am Spiel lesen
- `docs/specs/mitwachsen.md` – Spec des Spiels (Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen
- `docs/todo.md` – offene Punkte

## Regeln

- Schichten (geprüft durch `npm run arch`): `src/lib` ist generisch und importiert nichts aus `src/data`, `components`, `layouts`, `pages`, `scripts`. `src/data` kennt keine Oberfläche. Browser-Code in `src/scripts` nutzt aus `lib` nur `textures.ts` und `src/lib/games/`, nichts aus Node. `src/lib/games/` und `src/data/games/` laufen im Browser und nutzen aus `lib` nur `games/` und `textures.ts`.
- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz. Ohne JavaScript bleibt die Seite für Eltern lesbar, das Spiel zeigt einen `<noscript>`-Text.
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal). Geprüft durch `npm run verify:dist` (Logik in `scripts/dist.ts`).
- Animationen respektieren `prefers-reduced-motion`.
- Die Startseite bleibt schlank (geprüft durch `npm run verify:bundles`, Logik in `scripts/bundles.ts`): die Startseite lädt kein JavaScript (weder Datei noch eingebettetes Skript), Seiten außerhalb von `/spielen/` laden kein Spiel und kein Three.js und höchstens 32 KB JavaScript; die Spielseite lädt 3D nur nachträglich per `import()`.
- Der Service Worker gehört nur dem Spiel (`scope` `/spielen/`) und wird nur von der Spielseite angemeldet. `skipWaiting` und Neuladen nur auf Bitte des Spiels an sicheren Stellen (Gute Nacht im Bett, Rückkehr nach langer Pause, solange die Figur schläft; Entscheidungen in `src/scripts/games/pwa-update.ts`), nie mitten im Spiel. Alte Caches löscht erst die aktive neue Version, und nur, wenn keine andere Spielseite mehr offen ist. Die Liste der gespeicherten Dateien entsteht beim Build, nie von Hand, und bleibt im Budget (geprüft durch `npm run verify:pwa`). Angemeldet wird mit `updateViaCache: 'none'`, nie `'all'`. Das Manifest legt die Drehung nicht fest.
- Keine Navigation per View Transitions (`ClientRouter`): Jede Seite lädt neu, das Spiel startet und endet sauber.
- TypeScript prüft jeden Index-Zugriff (`noUncheckedIndexedAccess`): fehlende Einträge behandeln; Auswahl aus Listen über `pick`/`cycle` (`src/lib/games/rng.ts`), Feld-Schlüssel über `fromKey` (`chunks.ts`). `!` nur, wo die Stelle selbst zeigt, dass der Eintrag existiert, und in Tests.
- Spielstände liegen nur im `localStorage` (Präfix `larmic.games.`, von larmic.de übernommen). Ändert sich das Format, gehört eine Migration in `mitwachsen-save.ts` mit Test.
- Ändert sich eine Adresse, leitet die alte weiter (`redirects` in `astro.config.mjs`) und kommt in `LEGACY` in `scripts/verify-dist.ts`.
