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
