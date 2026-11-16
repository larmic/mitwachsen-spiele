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
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links und Sprungmarken, Bundle-Gate (Startseite ohne Spiel, JS-Budget), Seiten-Gate (keine externen Ressourcen)
npm run test:e2e # Guard-Gate nach dem Build: Smoke-Test im Browser (Playwright, e2e/): Seiten, Spiel, 404, ohne Konsolenfehler; Barrierefreiheit nach WCAG 2.2 AA (axe-core, e2e/a11y.spec.ts); einmalig: npx playwright install chromium
npm run gates    # alle Gates in der Reihenfolge der Pipeline
# Git-Hook .githooks/pre-commit (aktiviert durch npm install) prüft vor jedem Commit Formatierung, Lint, Architektur, Tests
```

Vor jedem Commit `npm run format`, `npm run lint`, `npm run arch`, `npm run check`, `npm test`, `npm run build`, `npm run verify` und `npm run test:e2e` ausführen.

## Aufbau

- `src/pages/` – Seiten: `/` (Startseite für Eltern mit „Spiel starten“; Texte in `src/data/landing.ts`, noch Platzhalter, Eckdaten aus `src/content/games/mitwachsen.md`, Styles in `src/styles/landing.css`), `/spielen/` (das Spiel, `noindex`, nicht in der Sitemap), `/datenschutz/`, 404 (Impressum und Kontakt liegen auf larmic.de, der Footer verlinkt dorthin); dazu `favicon.*`, `[icon].png.ts`, `og.png.ts` (beim Build erzeugt)
- `src/layouts/BaseLayout.astro` – Kopfdaten, Schriften, Würfel-Symbole; `PlainPage.astro` – Himmel, Inhalt auf Papier, Footer
- `src/content/` – Eckdaten des Spiels im Frontmatter von `src/content/games/mitwachsen.md` (Rumpf wird nicht gezeigt), Schema in `src/content.config.ts`; alle Texte der Startseite stehen in `src/data/landing.ts`
- `src/components/` – `MitwachsenGame.astro` (Spielfläche), `MitwachsenParentInfo.astro` (Hinweis für Eltern), Kopf, Footer
- Spiel: `src/lib/games/` (Zufall, Stücke, Ansicht von vorn – generisch, läuft im Browser), `src/data/games/mitwachsen.ts` (Gegenden, Tiere, Figur), `src/scripts/games/` (Welt, Regeln und Speichern rein und getestet; `larmic-mitwachsen.ts` Web Component, `mitwachsen-3d.ts` 3D-Ansicht mit Three.js (wird per `import()` nachgeladen; dazu `mitwachsen-geo.ts` Textur-Atlas und Baukasten, `mitwachsen-gatehouse.ts` Torhäuser und Portale), `mitwachsen-tired.ts` Müde werden (Medienzeit), `mitwachsen-render.ts` 2D-Ansicht und Ebene darüber, `input-pace.ts` ruhiger Takt, `sfx.ts` Töne)
- `src/lib/voxel/` – Würfel-Grafik, läuft beim Build: `textures.ts` (Pixel-Raster, auch vom Spiel genutzt), `render.ts`, `cube.ts`, `blocks.ts` (Würfel-Symbole, Texturen als CSS, Insel `ISLAND` und Säulen `tower` für Startseite und Vorschaubild), `icon.ts` (Favicon)
- `src/data/site.ts` – Titel, Adresse, Kontakt; `src/data/landing.ts` – alle Texte der Startseite
- `src/styles/` – `tokens.css` (Design-Tokens), `global.css`, `sections.css`
- `scripts/` – Gates nach dem Build: `bundles.ts` (Bundle-Gate), `dist.ts` (Seiten-Gate)
- `docs/design-system.md` – Farben, Typografie, Bausteine
- `docs/games/` – Mitwachsen, wächst mit meinem Sohn: `README.md` (Einleitung, Altersstufen, gemeinsame Regeln), `mitwachsen.md` (Konzept der Stufe ab 3). Vor Arbeiten am Spiel lesen
- `docs/specs/mitwachsen.md` – Spec des Spiels (Regeln, Invarianten, zugehörige Tests). Bei Änderungen am Verhalten Spec und Tests mitziehen
- `docs/todo.md` – offene Punkte vor dem Livegang

## Regeln

- Schichten (geprüft durch `npm run arch`): `src/lib` ist generisch und importiert nichts aus `src/data`, `components`, `layouts`, `pages`, `scripts`. `src/data` kennt keine Oberfläche. Browser-Code in `src/scripts` nutzt aus `lib` nur `textures.ts` und `src/lib/games/`, nichts aus Node. `src/lib/games/` und `src/data/games/` laufen im Browser und nutzen aus `lib` nur `games/` und `textures.ts`.
- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Alle Inhalte bleiben im HTML; Interaktion ist Zusatz. Ohne JavaScript bleibt die Seite für Eltern lesbar, das Spiel zeigt einen `<noscript>`-Text.
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal). Geprüft durch `npm run verify:dist` (Logik in `scripts/dist.ts`).
- Animationen respektieren `prefers-reduced-motion`.
- Die Startseite bleibt schlank (geprüft durch `npm run verify:bundles`, Logik in `scripts/bundles.ts`): die Startseite lädt kein JavaScript, Seiten außerhalb von `/spielen/` laden kein Spiel und kein Three.js und höchstens 32 KB JavaScript; die Spielseite lädt 3D nur nachträglich per `import()`.
- Keine Navigation per View Transitions (`ClientRouter`): Jede Seite lädt neu, das Spiel startet und endet sauber.
- TypeScript prüft jeden Index-Zugriff (`noUncheckedIndexedAccess`): fehlende Einträge behandeln; Auswahl aus Listen über `pick`/`cycle` (`src/lib/games/rng.ts`), Feld-Schlüssel über `fromKey` (`chunks.ts`). `!` nur, wo die Stelle selbst zeigt, dass der Eintrag existiert, und in Tests.
- Spielstände liegen nur im `localStorage` (Präfix `larmic.games.`, von larmic.de übernommen). Ändert sich das Format, gehört eine Migration in `mitwachsen-save.ts` mit Test.
- Ändert sich eine Adresse, leitet die alte weiter (`redirects` in `astro.config.mjs`) und kommt in `LEGACY` in `scripts/verify-dist.ts`.
