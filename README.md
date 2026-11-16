# mitwachsen-spiele.de

Mitwachsen: ein ruhiges Spiel für Kinder ab 3 Jahren, das man zusammen mit Mama oder Papa spielt. Ohne Werbung, ohne Punkte, kostenlos im Browser. Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages unter https://www.mitwachsen-spiele.de.

Das Spiel stammt von [larmic.de](https://larmic.de) und hat hier eine eigene Seite bekommen.

## Schnellstart

Voraussetzung ist Node.js in der Version aus `.nvmrc` (26), zum Beispiel über Homebrew:

```bash
brew install node
npm install
npm run dev
```

Die Seite läuft dann unter http://localhost:4321 und lädt Änderungen sofort neu.

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Live-Reload |
| `npm run check` | Prüft Typen und Inhalts-Schemas. Guard-Gate |
| `npm test` | Unit-Tests (Vitest) für Spielregeln, Welt, Speichern und Würfel-Grafik, mit Mindest-Abdeckung der reinen Module (Schwellen in `vitest.config.ts`). Guard-Gate |
| `npm run lint` | ESLint für TypeScript und Astro. Guard-Gate |
| `npm run format` / `format:check` | Prettier formatiert bzw. prüft den Code. `format:check` ist Guard-Gate |
| `npm run arch` | Architekturregeln (dependency-cruiser, `.dependency-cruiser.cjs`): Schichten `lib` → `data` → Oberfläche, Browser-Code ohne Build-Code. Guard-Gate |
| `npm run build` | Erzeugt die fertige Seite in `dist/` |
| `npm run verify` | Prüft die fertige Seite in `dist/`: gültiges HTML (html-validate), keine toten internen Links und Sprungmarken (linkinator), das Bundle-Gate (Startseite ohne JavaScript-Datei, übrige Seiten ohne Spiel und im JavaScript-Budget) und das Seiten-Gate (keine externen Ressourcen ohne Klick). Guard-Gate nach dem Build |
| `npm run test:e2e` | Smoke-Test im Browser (Playwright, `e2e/`): Startseite (Weg ins Spiel, Aufbau, 320 px ohne seitliches Scrollen), Rechtliches, 404 und das Spiel, ohne Fehler in der Konsole, dazu Barrierefreiheit jeder Seite nach WCAG 2.2 AA (axe-core). Guard-Gate nach dem Build; einmalig `npx playwright install chromium` |
| `npm run preview` | Zeigt den gebauten Stand aus `dist/` lokal an |
| `npm run gates` | Alle Guard-Gates in der Reihenfolge der Pipeline, inklusive Build |

## Projektstruktur

```
src/
  pages/              / (Seite für Eltern), /spielen/ (das Spiel, noindex), /impressum/, /datenschutz/, 404,
                      dazu favicon, apple-touch-icon und og.png (beim Build erzeugt)
  layouts/            BaseLayout (Kopfdaten; die Startseite baut darauf direkt auf), PlainPage (Himmel, Inhalt auf Papier, Footer)
  content/games/      Eckdaten des Spiels im Frontmatter (Alter, Steuerung …), Schema in content.config.ts;
                      alle Texte der Startseite stehen in data/landing.ts
  components/         MitwachsenGame (Spielfläche), MitwachsenParentInfo (Hinweis für Eltern), Kopf, Footer …
  scripts/games/      das Spiel im Browser: Welt, Regeln, Speichern (rein, getestet), Web Component,
                      2D- und 3D-Ansicht (Three.js, per import() nachgeladen), Töne
  lib/games/          generische Spiel-Bausteine: Zufall, Stücke, Ansicht von vorn (läuft im Browser)
  lib/voxel/          Würfel-Grafik beim Build: Texturen, Würfel, Szene, Icon
  data/games/         Gegenden, Tiere, Figur, Geschichten
  data/site.ts        Titel, Adresse, Kontakt
  data/landing.ts     alle Texte der Startseite (noch Platzhalter)
  styles/             tokens.css (Design-Tokens), global.css, sections.css, landing.css (Startseite)
scripts/              Gates nach dem Build: Bundle-Gate, Seiten-Gate
e2e/                  Smoke-Test und Barrierefreiheit (Playwright)
docs/games/           Konzept des Spiels, Altersstufen, gemeinsame Regeln
docs/specs/           Spec des Spiels (Regeln, Invarianten, zugehörige Tests)
docs/design-system.md Farben, Typografie, Bausteine
docs/todo.md          Offene Punkte (Livegang)
```

## Guard-Gates

Jeder Commit läuft durch dieselben deterministischen Prüfungen, egal ob ein Mensch oder eine KI den Code geschrieben hat. Fällt eine durch, geht nichts live.

| Gate | Prüft | Werkzeug |
| --- | --- | --- |
| Formatierung | einheitlicher Code-Stil | Prettier |
| Lint | typische Fehler in TypeScript und Astro, Größe und Verschachtelung | ESLint |
| Architektur | Schichten: `lib` ist generisch, `data` kennt keine Oberfläche, Browser-Code bekommt keinen Build-Code, keine Zyklen | dependency-cruiser |
| Typen und Inhalte | TypeScript strikt, auch jeder Zugriff per Index (`noUncheckedIndexedAccess`), Markdown-Inhalte gegen ihr Schema | astro check |
| Unit-Tests | Regeln, Welt und Speichern des Spiels (Spec: [docs/specs/mitwachsen.md](docs/specs/mitwachsen.md)), Würfel-Grafik, die Gates selbst; die Abdeckung der reinen Module darf nicht sinken | Vitest, v8-Coverage |
| Fertige Seite | gültiges HTML, keine toten internen Links und Sprungmarken, Startseite ohne Spiel und im JavaScript-Budget, das Spiel lädt 3D erst bei Bedarf, keine externen Ressourcen ohne Klick | html-validate, linkinator, Bundle-Gate, Seiten-Gate |
| Im Browser | Seiten laden, das Spiel startet, keine Fehler in der Konsole; Barrierefreiheit jeder Seite nach WCAG 2.2 AA | Playwright, axe-core |

Lokal laufen alle zusammen mit `npm run gates`. Zusätzlich prüft ein Git-Hook (`.githooks/pre-commit`) vor jedem Commit die schnellen Gates – Formatierung, Lint, Architektur, Unit-Tests. `npm install` aktiviert ihn automatisch; im Notfall überspringt `git commit --no-verify` ihn.

## Deployment

Die Pipeline `.github/workflows/deploy.yml` läuft bei jedem Pull Request (auch von Renovate) und bei jedem Push auf `main`. Sie hat zwei Jobs:

1. **Guard-Gates und Build** – nur mit Leserechten: installiert die Abhängigkeiten (`npm ci`), durchläuft die Guard-Gates, baut die Seite und prüft das Ergebnis (`npm run verify`) und im Browser (`npm run test:e2e`).
2. **Deploy auf GitHub Pages** – nur auf `main`, erst wenn Job 1 grün ist: veröffentlicht die fertige Seite mit `actions/deploy-pages`. Er braucht nur die Rechte `pages: write` und `id-token: write`, keine Schreibrechte aufs Repo, und installiert und baut nichts.

So laufen die Install-Skripte neuer Paketversionen nie mit einem Schreib-Token.

In den GitHub-Pages-Einstellungen ist die Quelle „GitHub Actions“. Die Domain `www.mitwachsen-spiele.de` steht dort ebenfalls (Custom domain), eine `CNAME`-Datei braucht es dafür nicht, und Jekyll läuft bei diesem Weg nicht, also auch kein `.nojekyll`. Alle Actions sind auf Commit-SHAs gepinnt.

Es gibt vorerst nur diese eine Stufe. Eine Teststufe ist für später geplant.

Renovate hält Abhängigkeiten und Actions aktuell. Neue Versionen werden erst nach drei Tagen vorgeschlagen (`minimumReleaseAge`). Minor- und Patch-Updates übernimmt Renovate automatisch, aber nur, wenn alle Guard-Gates grün sind. Major-Updates kommen als Pull Request zur Prüfung.

### Einmalig einrichten

Diese Einstellungen stehen nicht im Code und müssen einmal von Hand gesetzt werden (Stand in `docs/todo.md`):

1. **DNS** beim Domain-Anbieter für `mitwachsen-spiele.de`:
   - `www` als `CNAME` auf `larmic.github.io`
   - die Domain ohne `www` (`@`) mit `A`-Einträgen auf `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - und `AAAA`-Einträgen auf `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
2. **Domain verifizieren** (Profil → Settings → Pages → „Add a domain“, TXT-Eintrag): Dann kann kein fremdes Repo die Domain übernehmen.
3. **GitHub Pages** (Repo → Settings → Pages): Quelle „GitHub Actions“, Custom domain `www.mitwachsen-spiele.de`, nach dem DNS-Check „Enforce HTTPS“ anhaken. Die Domain ohne `www` leitet GitHub dann selbst auf `www` weiter.
4. **Renovate**: der Renovate-App (GitHub App „Renovate“ von Mend) Zugriff auf dieses Repo geben.
5. **Branch-Schutz** für `main` (Settings → Rules oder Branches): Pflicht-Check „Guard-Gates und Build“. Ohne ihn übernimmt Renovate Updates per Automerge, ohne dass die Gates grün sein müssen.

## Datenschutz und Recht

- Impressum (`/impressum/`) nach § 5 DDG und § 18 Abs. 2 MStV, Datenschutzerklärung unter `/datenschutz/`.
- Beim Laden der Seite wird nichts von Dritten nachgeladen: Schriften sind lokal gebündelt, keine Cookies, kein Tracking.
- Der Spielstand bleibt im Browser (`localStorage`) und wird nicht übertragen.
- Keine Mail-Adresse steht am Stück im HTML: Der Link entsteht erst im Browser (`MailLink.astro`), ohne JavaScript steht „mail[at]larmic.de“ da.

## Design

Farben, Typografie und Bausteine stehen in [docs/design-system.md](docs/design-system.md). Die Design-Tokens liegen in `src/styles/tokens.css`.

## Lizenz

Der Quellcode steht unter der MIT-Lizenz. Texte, Bilder, Impressum und Datenschutzerklärung sind davon ausgenommen, hier sind alle Rechte vorbehalten. Details in [LICENSE](LICENSE).
