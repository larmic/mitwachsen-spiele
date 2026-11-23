# Offene Punkte

## Vor dem Livegang

- [ ] DNS: `www` als CNAME auf `larmic.github.io`, die Domain ohne `www` mit A/AAAA-Einträgen auf GitHub Pages (Werte im README unter „Einmalig einrichten“)
- [ ] Domain im GitHub-Profil verifizieren (TXT-Eintrag)
- [ ] GitHub Pages: Quelle „GitHub Actions“, Custom domain `www.mitwachsen-spiele.de`, „Enforce HTTPS“
- [ ] Branch-Schutz für `main`: Pflicht-Check „Guard-Gates und Build“ (sonst übernimmt Renovate Updates ohne Prüfung)
- [ ] Renovate-App für das Repo freischalten
- [ ] Datenschutzerklärung prüfen lassen
- [ ] Seite in der Search Console anmelden
- [x] Texte der Startseite schreiben (`src/data/landing.ts`, erste Fassung 17.11.2026, gegenlesen)

## Später

- [ ] Teststufe (vorerst zurückgestellt)
- [ ] Content-Security-Policy
- [ ] Eltern-Tipp Geführter Zugriff: Eltern auf der Startseite und/oder im Hinweis für Eltern im Spiel erklären, wie das Kind im Spiel bleibt – iPad „Geführter Zugriff“ (Einstellungen → Bedienungshilfen → Geführter Zugriff) und Android „App anheften“ (Bildschirmfixierung). Vorerst nur dieser Punkt, noch kein Text in der Oberfläche
- [ ] Reisewege nach dem Schlitten (Konzept „Reisewege: ein Fahrzeug je Welt“, vom Vater bestätigt am 22.11.2026; der Schlitten ist umgesetzt, Spec „Der Schlitten“):
  - [ ] Tok: erscheint erst nach der ersten Heimfahrt mit dem Schlitten (Stufe `fest` in `packs.fahrt.schlitten`)
  - [ ] `RIDE_PRELOAD`: das Paket eines Fahrzeugs und seiner Zielgegend schon laden, wenn die Figur 6 Felder vor dem Halt ist; fehlt es noch, schläft das Fahrzeug freundlich (der Schlitten braucht es nicht: Er lebt im Paket der Eis-Welt, das bei offenem Eistor immer geladen ist)
  - [ ] `schlaeft` im Spielstand der Fahrzeuge (beim Boten, der abends gekommen ist) und „Gute Nacht, Fahrzeuge“ (schläft die Figur im Bett der Lichtung, sagen die Fahrzeuge in Sichtweite nacheinander gute Nacht und machen ihr Licht aus, höchstens 4 s, jede Taste beendet es)
  - [ ] Paket `worlds/fahrt/`: Engine (`worlds/eis/mitwachsen-ride*.ts`) und Liste (`src/data/games/mitwachsen-rides.ts`) dorthin ziehen, sobald es ein zweites Fahrzeug gibt (eigener Lader, `needsPack`, Bundle-Grenze, `verify-pwa`, `test-worlds.PACKS`)
- [ ] Höhlenwelt (Konzept „Gleisbahn und Höhle“, Entscheidungen des Vaters vom 23.11.2026: erst die Höhle, dann Tok und der Zug; Grotte nur per Entwickler-Schalter, Höhlentor und Höhlen-Geschichte bleiben, wie sie sind):
  - [x] Schritt 0: Pakete und Gegenden allgemein (`REGION_IDS` mit `hoehle`, `PackId`, Lader je Paket, Welt hinter jedem Tor je Gegend, Boten und „noch nicht“ je Tor, Bucht in `mitwachsen-bay.ts`)
  - [x] Schritt 7: Grotte als Gegend (`worlds/hoehle/`: Lage gerade oder um eine Ecke fern der Eis-Welt, Gelände mit allen Zonen, Licht, Höhlenbett mit Unterstand an der Kristallwand, Platz für den Lokschuppen neben dem Bahnhof, Felswand ohne Paket, Portal `hoehlensee` schlafend, Entwickler-Schalter `?entwickler=hoehle`, Chunks `welt-hoehle`/`welt-hoehle-3d`, `PRECACHE_BUDGET` 615 KiB, 2D-Zeichenteile je Paket)
  - [ ] Offen aus Schritt 7: Wasser in der Grotte ist noch blau wie überall (türkis nur am Steintrog); Abendlicht der Schächte (golden-orange) und Fledermäuse am Abend (Schritt 13); Klangstein am Höhlenbett mit `hoehle-offen` (Schritt 12, der Platz −3, 1 ist frei); Portal `hoehlensee` erwacht nach dem Maulwurf (Schritt 10, `Portal.later` aufheben); der Bahnsteig am frei gehaltenen Platz (`GROTTE.station`) und der Lokschuppen daneben (`GROTTE.shed`: vorn offen, Unterstand wie das Iglu, Toks Zuhause, dorthin fährt abends der Zug) kommen mit der Bahn; Lichtwerte des Konzepts für die Grotte (Sonne 1,6, Himmelslicht 1,0) sind noch nicht übernommen, die 3D-Ansicht rechnet mit ihren eigenen Werten (die Grotte nur nie dunkler als die Dämmerung); `packAt` zählt jede Lage hinter dem Felsring zum Eistor (dem einzigen mit Schlüssel), auch eine in der Grotte; kommt nach der Grotte eine Welt (`bend`), braucht der Kern die Lage der Grotte (`siteOf` in den Kern ziehen)
  - [ ] Schritt 8: acht Höhlentiere mit Modellen, Tönen und Album (Grottenolm statt Axolotl, Sonnen-Eidechse statt Kristallschnecke)
  - [ ] Schritt 9: Leuchtpilze, Tropfwasser, Tropfmoos
