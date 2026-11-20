# Spec: Mitwachsen (Stufe ab 3)

Verhalten des Spiels unter `/spielen/` (die Startseite `/` ist die Seite für Eltern mit „Spiel starten“). Konzept und Hintergrund: [docs/games/mitwachsen.md](../games/mitwachsen.md).

Umgesetzt ist es in reinen, getesteten Teilen und einer Web Component:

| Teil | Datei | Tests |
| --- | --- | --- |
| Zufall, Rauschen, Stücke | [`src/lib/games/rng.ts`](../../src/lib/games/rng.ts), [`chunks.ts`](../../src/lib/games/chunks.ts) | `rng.test.ts` |
| Ansicht von vorn, Modelle aus Quadern | [`src/lib/games/front.ts`](../../src/lib/games/front.ts) | – (Zeichnen) |
| Inhalte: Gegenden, Tore, Tiere, Figur | [`src/data/games/mitwachsen.ts`](../../src/data/games/mitwachsen.ts) | über die Tests unten |
| Zuhause je Gegend: Lagen relativ zum Bett, ans Bett gelegt, Gegend eines Felds, Bett beim Start | [`src/data/games/mitwachsen-homes.ts`](../../src/data/games/mitwachsen-homes.ts), [`src/scripts/games/mitwachsen-home.ts`](../../src/scripts/games/mitwachsen-home.ts) | „Zuhause je Gegend“ (`mitwachsen-world.test.ts`, `mitwachsen-state.test.ts`) |
| Welt aus dem Seed | [`src/scripts/games/mitwachsen-world.ts`](../../src/scripts/games/mitwachsen-world.ts) | `mitwachsen-world.test.ts` |
| Spielregeln (Zustandsmaschine) | [`src/scripts/games/mitwachsen-state.ts`](../../src/scripts/games/mitwachsen-state.ts) | `mitwachsen-state.test.ts` |
| Spielstände | [`src/scripts/games/mitwachsen-save.ts`](../../src/scripts/games/mitwachsen-save.ts) | `mitwachsen-save.test.ts` |
| Ruhiger Takt der Eingabe | [`src/scripts/games/input-pace.ts`](../../src/scripts/games/input-pace.ts) | `input-pace.test.ts` |
| Nebel (erkundete Felder) | [`src/scripts/games/mitwachsen-fog.ts`](../../src/scripts/games/mitwachsen-fog.ts) | `mitwachsen-fog.test.ts` |
| Karte | [`src/scripts/games/mitwachsen-map.ts`](../../src/scripts/games/mitwachsen-map.ts) | – (Zeichnen) |
| App: Manifest, Icons, Service Worker, Updates | [`src/data/pwa.ts`](../../src/data/pwa.ts), [`src/lib/pwa/`](../../src/lib/pwa/) (`manifest.ts`, `precache.ts`, `sw.ts`), [`src/integrations/service-worker.ts`](../../src/integrations/service-worker.ts), Anmeldung und Updates in [`pwa-register.ts`](../../src/scripts/games/pwa-register.ts), Entscheidungen in [`pwa-update.ts`](../../src/scripts/games/pwa-update.ts) | `precache.test.ts`, `sw.test.ts`, `manifest.test.ts`, `pwa-update.test.ts`, `pwa.test.ts` (Daten und App-Gate), `e2e/pwa.spec.ts`, `e2e/installable.spec.ts`, `e2e/pwa-update.spec.ts` |
| Browser: Tastatur, Takt, Kamera, Töne, Menü | [`larmic-mitwachsen.ts`](../../src/scripts/games/larmic-mitwachsen.ts), [`mitwachsen-render.ts`](../../src/scripts/games/mitwachsen-render.ts) (2D und Ebene darüber), [`mitwachsen-3d.ts`](../../src/scripts/games/mitwachsen-3d.ts) (3D mit Three.js), [`sfx.ts`](../../src/scripts/games/sfx.ts) | – |

Bei Änderungen am Verhalten Spec und Tests mitziehen.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Welt** | Ein Spielstand: Seed, Weltname, Figurenname und Fortschritt. Mehrere Welten nebeneinander. „Welt“ allein meint immer den Spielstand, nie eine Gegend und nie ein Biom. Wo ein Name wie „Eis-Welt“ oder „Sandwelt“ vorkommt, ist er nur ein Name: entweder eine Gegend (die Eis-Welt, der Gletscherkessel, wird eine) oder eine Welt hinter einem Tor (Biom der Landschaft). |
| **Feld** | Ganzzahlige Koordinate (x nach rechts, y nach unten/vorn). Jedes Feld hat eine Höhe (Wasser 0, Boden 1, Hügel bis 3). |
| **Gegend** | Von Hand entworfener Bereich mit eigenem Zuhause. Zum Start nur die **Lichtung** mit dem Bett, ringsum Felsen mit acht großen Toren; weitere Gegenden (als erste die Eis-Welt) kommen als eigener Eintrag dazu. In welcher Gegend ein Feld liegt, sagt `world.realm(x, y)` (im Code `realm`); die Landschaft gehört zur Lichtung. Jedes Tier gehört zu einer Gegend (`animal.realm`): Tiere einer Gegend zu ihr, Tiere der Landschaft zur Lichtung. Eine Gegend kann hinter einem Tor liegen (`behind`). |
| **Zuhause** | Bett, Plätze zum Aufwachen, Wiese mit Futter- und Wassertrog, Unterstand und Kreis der Portal-Gegenstücke einer Gegend. Lagen relativ zum Bett in `HOMES` (`src/data/games/mitwachsen-homes.ts`, je Gegend, TypeScript verlangt für jede einen Eintrag); die Welt legt sie ans Bett (`world.homes`, `homeAt(world, x, y)` in `mitwachsen-home.ts` für das Zuhause der Gegend eines Felds). Das Bett der Lichtung steht in ihrer Mitte (0, 0). |
| **Welt hinter einem Tor** | Nur das Biom der endlosen Landschaft in der Richtung eines großen Tors, im Thema des Tors (`cell.biome`): Eiswelt, Sandwelt, Wasserwelt, Lavaberge, Höhlenwelt, Wald, Wolkenwelt, Pilzwald. Kein Spielstand und keine Gegend: Sie hat kein Zuhause und gehört (wie alle Landschaft) zur Lichtung. Die Eis-Welt als Gegend ist etwas anderes: ein von Hand entworfener Kessel mit eigenem Zuhause. |
| **Landschaft** | Alles außerhalb der Gegenden, endlos aus dem Seed berechnet, in Stücken von 16 × 16 Feldern. |
| **Tor** | Tor im Zaun oder Brücke übers Wasser. Gehört zu der Gegend, in der es steht. |
| **Portal-Plattform** | Flache Platte mit runden Ecken aus 3 × 3 Feldern im Material einer Welt, steht neben ihrem großen Tor. Alle neun Felder sind begehbar: Mitte (`portal`) und Rand (`portalrim`, Seitenmitten und Ecken); die Zierde in den Ecken ist nur Bild. Keine Vorder- und Rückseite. Ihr **Gegenstück** steht im Kreis um das Bett (9 Felder), in Richtung ihres Tors. Beide erwachen zusammen (`portals`). Form, Farben und Bild je Welt: `src/data/games/mitwachsen-portals.ts`; Regeln: `src/scripts/games/mitwachsen-portal.ts`. |
| **Takt** | 100 ms. Tiere laufen im Takt, die Schlafsperre zählt in Takten. |

## Ereignisse (Befehle an `step`)

| Befehl | Auslöser | Wirkung |
| --- | --- | --- |
| `move(dir)` | Pfeiltaste im ruhigen Takt: höchstens ein Schritt alle 260 ms, ob getippt oder gehalten. Ein Druck ist genau ein Schritt, auch wenn der Finger etwas länger liegt; erst wer 450 ms hält, läuft gleichmäßig weiter (Spieltest am Tablet). Ein Tipp während eines Schritts wird gemerkt (höchstens einer). Bei einer Begegnung (Tier gefunden oder angestoßen, Beeren, Füttern, Wasser schöpfen, Tränken, Plattform erwacht, Reise, Klangstein) bleibt die Figur stehen, bis der Pfeil neu gedrückt wird; sonst tauschte sie mit gehaltenem Pfeil gleich den Platz mit dem neuen Tier. *Tests: `input-pace.test.ts`* | Schritt, Hineinlaufen oder Wand, siehe Regeln |
| `action` | Ab 3 an keine Taste gebunden (erster Spieltest: Leertaste war zu viel; die Leertaste tut nichts, auch kein Touch-Knopf). Der Befehl bleibt in den Regeln für spätere Altersstufen | Singen und Folgen, Schlafen oder Rufen |
| `tick` | Takt, solange Seite sichtbar und Menü zu | Tiere laufen umher, Tiere der Landschaft tauchen auf und verschwinden, nahe Portal-Plattformen erwachen |

`step(state, world, cmd, explored)`: `explored(x, y)` sagt, ob ein Feld schon aus dem Nebel ist (den Nebel führt die Ansicht); nur dort erwacht eine Plattform. Ohne Angabe gilt alles als erkundet.

Schläft die Figur, wecken `move` und `action` sie (nach der Sperrzeit), sonst tun sie nichts.

`step` liefert den neuen Zustand und **Ereignisse** für Ton, Bild und Speichern: `step` (mit Kletterrichtung), `bump`, `sing` (mit `first`), `follow`, `swap`, `aside` (ein Tier der Wiese macht Platz), `story` (Klangstein angelaufen, mit `first`), `home`, `gate` (Tor geht auf; derzeit löst es keine Regel aus, es kommt mit dem Schlüssel wieder), `portal` (Plattform am Tor und ihr Gegenstück erwacht), `teleport` (gereist, mit Ziel `gate` oder `home`), `ready` (nach der Ankunft von der Mitte gestiegen: wieder bereit), `pick` (Beeren gepflückt), `regrow` (Beeren nachgewachsen), `feed` (Beeren in den Futtertrog, mit den Tieren dieser Wiese), `fill` (Eimer am Wasser gefüllt), `pour` (Wasser in den Wassertrog, mit den Tieren dieser Wiese), `call`, `sleep`, `wake`.

## Regeln

1. **Start:** Die Figur schläft im Bett der Gegend, in der die gespeicherte Position liegt. Fehlt die Position, ist sie kaputt (keine ganzen Zahlen) oder liegt ihre Gegend hinter einem Tor, das zu ist, schläft sie im Bett der Lichtung (heute liegt jede Position auf der Lichtung oder in ihrer Landschaft). Die erste Taste weckt sie an einem freien Platz neben dem Bett. *Tests: „startet schlafend im Bett …“, „startet am Bett der Gegend, in der die gespeicherte Position liegt“, „unbekannte oder kaputte Position: Start am Bett der Lichtung“, „liegt die gespeicherte Position hinter einem Tor, das zu ist: Start am Bett der Lichtung“*
2. **Laufen:** Ein Feld in Pfeilrichtung, die Figur schaut dorthin. *Test: „geht ein Feld in Pfeilrichtung …“*
3. **Klettern:** Eine Stufe hinauf geht immer, auch auf Klettersteine; danach Stufe für Stufe weiter. Herunter geht jederzeit, egal wie tief (auf der Lichtung gibt es aber keine Stufe höher als eins). Wasser, Bäume, Büsche, Zäune, der Felsring, Bett und geschlossene Tore versperren das Feld; die Figur bleibt stehen (`bump`). *Tests: „klettert eine Stufe …“, „fällt beliebig tief herunter …“, „läuft nicht durch Wasser …“*
3a. **Beerenbüsche:** Läuft die Figur in einen Busch mit Beeren, pflückt sie sie (sie hüpft, Beeren springen heraus, es ploppt) und bleibt stehen. Ohne Beeren ist der Busch ein Hindernis. Nach 300 Takten (30 s) wachsen neue Beeren, auch nachts. Gepflücktes wird nicht gespeichert. Nach dem Pflücken trägt die Figur einen Korb mit Beeren auf dem Rücken (`basket`). Läuft sie damit in den Futtertrog, kommen die Beeren hinein, der Korb ist weg, und alle Tiere der Wiese, auf der der Trog steht, freuen sich (hüpfen, Herz, fröhliche Töne). Ohne Korb ist der Trog ein Hindernis. *Tests: „in einen Busch laufen pflückt die Beeren …“, „Korb mit Beeren“, „am Trog freuen sich nur die Tiere der Wiese, auf der er steht“*
3b. **Eimer mit Wasser:** Läuft die Figur mit leerer Hand ans Wasser, schöpft sie einen Eimer voll (`fill`) und bleibt am Ufer stehen; mit vollem Eimer ist Wasser wieder nur ein Hindernis. Mit vollem Eimer in den Wassertrog: Das Wasser kommt hinein, alle Tiere der Wiese, auf der der Trog steht, freuen sich (`pour`), wie die Beeren am Futtertrog. Korb und Eimer trägt sie gleichzeitig, jeder Trog nimmt nur das Seine. Nicht gespeichert, wie der Korb. *Tests: „Eimer mit Wasser“, „am Trog freuen sich nur die Tiere der Wiese, auf der er steht“*
4. **Aktion neben einem Tier** (vorn, sonst das nächste der acht Nachbarfelder): Es singt. Beim ersten Mal ist es gefunden. Läuft es frei umher, folgt es danach der Figur. Folgt es schon oder ist es im Garten, singt es nur. *Tests: „singt bei der Aktion …“, „nimmt mit der Aktion auch ein Tier schräg daneben …“, „Tiere im Garten singen …“*
5. **Hineinlaufen in ein Tier:** Ein frei umherlaufendes Tier singt, ist beim ersten Mal gefunden und folgt der Figur; die Figur bleibt stehen. Die Aktionstaste braucht es dafür nicht (erster Spieltest: Leertaste war zu viel). In ein folgendes Tier hineinlaufen tauscht sofort den Platz, so kann die Figur immer umdrehen. Ein Tier auf der Wiese macht Platz: Es hüpft auf ein freies Feld seiner Wiese zur Seite (sonst geradeaus weiter), ruft kurz und schaut zur Figur; die Figur geht im selben Zug weiter und hält nicht an. So kommt sie auch durch eine volle Wiese (Rückmeldung: Mit vielen Tieren war der Start so voll, dass man nicht mehr laufen konnte). Ist kein Feld frei, tauschen beide den Platz, wenn das Tier auf dem Feld der Figur stehen darf; sonst singt es nur. Kommt ein folgendes Tier durch den Tausch auf die Wiese, ist es zu Hause (Regel 7). *Tests auch: „Randfälle aus der Prüfung“* *Tests: „Hineinlaufen reicht …“, „in ein folgendes Tier hineinlaufen tauscht sofort …“, „ein Tier auf der Wiese macht Platz …“, „ist seitlich nichts frei …“, „kommt durch eine volle Wiese …“*
6. **Gänsemarsch:** Geht die Figur einen Schritt, rückt jedes folgende Tier auf den Platz seines Vordermanns. *Test: „läuft im Gänsemarsch …“*
7. **Wiese ums Bett (Zuhause der Tiere):** Jede Gegend hat ihre eigene Wiese um ihr Bett (`HOMES`), ohne Zaun, mit Futter- und Wassertrog; auf der Lichtung mit Radius 6. Ein folgendes Tier, das die Wiese **seiner** Gegend betritt, löst sich aus der Kette, ruft seinen Ton (Ereignis `home`), bekommt einen eigenen Platz auf der Wiese, läuft dorthin und bleibt für immer auf der Wiese (gespeichert, auch nach dem Schlafen). Auf der Wiese einer anderen Gegend zieht es nicht ein. Beim Laden stehen die Tiere verteilt auf der Wiese ihrer Gegend. Intern heißt die Wiese weiter „Garten“ (`cell.garden`, `homeAnimals`). *Tests: „Wiese ums Bett“, „ein Tier zieht nur auf der Wiese seiner eigenen Gegend ein“*
8. **Tore:** Wann ein Tor aufgeht, sagt `opens`: nie (`'never'`) oder mit einem Schlüssel, dem Tier einer Art (`{ key }`). Die acht großen Tore der Lichtung stehen alle auf `'never'` und öffnen nicht, auch wenn alle Tiere gefunden sind; auch ein alter Spielstand öffnet sie nicht (`initialState` übernimmt nur Tore, die nicht `'never'` sind). Offen bleibt offen. *Tests: „Große Tore“*
9. **Schlafen:** Die Figur läuft ins Bett der Gegend, in der sie steht (nicht in den ersten 15 Takten nach dem Aufwachen, dann ist das Bett nur ein Hindernis, damit sie nicht aus Versehen gleich wieder einschläft). Mit dem Befehl `action` auch, wenn das Bett vorn oder daneben ist (und kein Tier näher). Folgende Tiere gehen heim: Tiere einer Gegend an einen freien Platz nahe ihrem Start, Tiere der Landschaft verschwinden und tauchen später an ihrem Platz auf. 30 Takte lang weckt keine Taste. Geweckt wird sie an einem freien Platz neben demselben Bett. *Tests: „läuft ins Bett und schläft ein …“, „gleich nach dem Aufwachen ist das Bett nur ein Hindernis“, „legt sich mit der Aktion am Bett schlafen …“, „schickt folgende Tiere beim Schlafen heim“, „schläft im Bett der Gegend, in der die Figur steht, und wacht dort auf“*
9a. **Portal-Plattformen:**
   - **Erwachen:** Kommt die wache Figur bis auf 2 Felder an eine Plattform am Tor heran (gemessen vom Rand der Plattform, auch schräg: Abstand zur Mitte nach Chebyshev höchstens 3), erwacht sie (`portal`), aber nur, wenn ihr Mittelfeld schon erkundet ist (kein Leuchten im Nebel). Geprüft nach jedem Befehl, also auch im Takt: Lichtet sich der Nebel erst nach dem Schritt, erwacht sie im nächsten Takt. Mit ihr erwacht das Gegenstück am Bett; gespeichert in `portals` wie bisher. Die Figur bleibt dabei stehen (Begegnung), läuft danach normal weiter. Ein schlafendes Gegenstück weckt niemand; es ist ein Sockel, der nichts auslöst.
   - **Reisen:** Nur wenn die Figur das **Mittelfeld** einer wachen Plattform betritt (Schritt oder Platztausch mit einem folgenden Tier). Der Rand ist Boden und löst nichts aus; die Ecken sind fest, aufsteigen geht über die vier Seitenmitten. Die Figur kommt auf dem Mittelfeld des Gegenstücks an und schaut nach Süden; folgende Tiere reisen mit und stehen danach um die Plattform, nie darauf (nächste freie Felder außerhalb der 3 × 3).
   - **Erst runter, dann wieder rauf:** Wer auf einer Mitte ankommt, reist nicht sofort zurück (`arrived`, nicht gespeichert). Erst wenn die Figur ein anderes Feld betritt, ist die Plattform wieder bereit (`ready`, kurzes Pling), und der nächste Tritt auf die Mitte reist zurück. Keine Sperrzeit. Schlafen vergisst die Ankunft; wer nach dem Laden auf einer Mitte stünde, reist erst beim nächsten Betreten.
   - *Tests: „Portal-Plattformen“ (state, world), „Portal-Plattformen: Erwachen/Reisen“ (`mitwachsen-portal.test.ts`), Browser-Test „Spiel: Portal-Plattform erwacht beim Herangehen …“ (`e2e/smoke.spec.ts`)*
10. **Rufen:** Aktion ohne Tier und Bett in der Nähe. *Test: „ruft, wenn weder Tier noch Bett …“*
11. **Umherlaufen:** Freie Tiere ruhen 8 bis 25 Takte, dann gehen sie einen Schritt oder drehen sich. Sie bleiben in ihrem Zuhause (Gegend, Stück der Landschaft oder Wiese ums Bett) und nie auf einem Feld an einem Durchgang (Tore, Portal-Plattformen und deren Nachbarfelder); wer außerhalb steht (nach einem Platztausch), zieht heim, ein Tier der Wiese dabei nur über die Wiese. Steht die Figur daneben, bleiben sie stehen und schauen sie an. *Tests: „bleibt stehen und schaut …“, „läuft umher, aber nur in seinem Zuhause“, „Durchgänge bleiben frei“*
11a. **Wechselnde Plätze:** Beim Öffnen einer Welt und an jedem neuen Morgen (Aufwachen) bekommen alle frei umherlaufenden Tiere der Gegenden neue Plätze: zufällige erreichbare Felder ihrer Gegend (`world.spotsOf(realm)`, nicht auf der Wiese, nicht an Durchgängen), mindestens 8 Felder von deren Bett und 5 voneinander. Der Zufall kommt aus dem Zustand (Seed der Welt und Zahl der Besuche), gleiche Befehle ergeben weiter den gleichen Zustand. Tiere der Wiese bleiben, wo sie sind. *Tests: „Tiere an wechselnden Stellen“*
12. **Landschaft:** Tiere der Landschaft gibt es in den Stücken um die Figur (Abstand 1). Ab Abstand 3 verschwinden frei laufende wieder. Gleiche Welt, gleiches Stück: gleiche Tiere am gleichen Platz.
13. **Klangsteine:** Läuft die Figur in einen Klangstein (oder steht davor und nutzt die Aktion), erklingt seine Geschichte (Ereignis `story`); die Figur bleibt stehen. Beim ersten Mal ist sie neu (`first`) und wird als gehört gespeichert (`heard`). Tiere in drei Feldern Umkreis drehen sich zur Figur und bleiben mindestens 40 Takte stehen. Abspielen und Anhalten (noch einmal hineinlaufen) macht die Ansicht, ebenso das Anhalten bei Menü, Schlafen und Tab-Wechsel. *Tests: „Klangsteine“ (state, world), „Geschichten der Klangsteine“ (`mitwachsen-stories.test.ts`)*

## Klangsteine

| Regel | Tests |
| --- | --- |
| Einer am Bett (`BED_STONE`, außerhalb des freien Platzes ums Bett), einer vor jedem großen Tor gegenüber der Portal-Plattform; fest, erreichbar, die Bucht vor dem Tor bleibt frei | „einer am Bett, einer vor jedem Tor …“ |
| Zu jedem Stein gibt es eine Geschichte mit Titel, Text und Melodie; die Texte stehen wortgleich in `docs/games/mitwachsen.md` | „gibt es am Bett und für jedes große Tor“, „stehen wortgleich in der Doku …“ |
| Melodien sind kürzer als 5 s und bleiben in der Pentatonik (klingen zu den Tieren) | „Melodien sind kurz …“ |
| Eine Aufnahme (`voice`) wird nur eingetragen, wenn die Datei unter `public/` liegt; ohne Aufnahme bleibt es bei der Melodie | „jede eingetragene Aufnahme liegt wirklich unter public/“ |
| Gehörte Geschichten kommen mit dem Spielstand wieder, unbekannte fallen weg | „gehörte Geschichten kommen mit dem Spielstand wieder …“, „verwirft unbekannte Tore …“ (save) |

## Welt

| Regel | Test |
| --- | --- |
| Gleicher Seed ergibt gleiche Felder, anderer Seed andere Landschaft | „entsteht aus demselben Seed immer gleich …“ |
| In der Mitte steht nur das Bett, ringsum (2 Felder) ist es flach und frei | „In der Mitte steht nur das Bett …“ |
| Die Lichtung ist groß (Ellipse 80 × 68, über 9000 erreichbare Felder) mit Hügeln, Teichen, lichten Hainen, Blumenwiesen und Klettersteinen | „Alle Tiere wohnen erreichbar …“ |
| Frei zugänglich für ein kleines Kind: Benachbarte Felder unterscheiden sich um höchstens eine Ebene, so kommt man überall wieder heraus; was man nicht erreichen kann, wird Fels | „Auf der Lichtung ist keine Stufe höher als eins …“ |
| Bäume und Büsche stehen einzeln: Im Umkreis von zwei Feldern steht kein weiteres Hindernis | „Bäume und Büsche stehen einzeln …“ |
| Die großen Tore liegen weit vom Bett (über 60 Felder) und weit auseinander (über 30 Felder); vor jedem eine freie Bucht bis zur Lichtung, dahinter kommt man nie (auch nicht außen herum) | „Die großen Tore liegen weit …“, „Vor jedem großen Tor kommt man hin, dahinter nie …“, „Die fünf Felder …“ |
| Lage und Reihenfolge der acht Tore würfelt der Seed: gleichmäßig verteilt mit etwas Spiel, jedes in einer geraden Reihe senkrecht zur nächsten Achse, so tief im Fels wie die tiefste Stelle seines Torhauses | „Lage und Reihenfolge der Tore würfelt der Seed“ |
| Hinter jedem Tor ein Gang durch den Fels in seine Welt (eben, schon im Thema); außerhalb des Felsrings liegt in Richtung jedes Tors seine Welt, die Grenzen sind leicht gewellt | „Hinter jedem Tor liegt in seiner Richtung seine Welt“ |
| Vier Tiere je Art (`herd`, zusammen 40) wohnen auf vom Bett aus erreichbaren Feldern, jedes auf eigenem Platz: das erste nah am Wunschort, die weiteren aus dem Seed verteilt, mit Abstand zueinander und zum Bett (`world.spawns`, je Kennung `lichtung:<art>` bzw. `lichtung:<art>:<n>`); die Landschaft hinter dem Felsring bleibt draußen | „Alle Tiere wohnen erreichbar …“ |
| Felsring in Terrassen (3, 4, außen 5), nur fürs Auge: nicht zu betreten, also weder zu besteigen noch hineinzufallen; mit festem Außenrand, so ist er überall gut zehn Felder dick | „Der Felsring ist nicht zu betreten“ |
| Eine Stufe hinauf, beliebig tief herunter (in der Landschaft) | „In der Landschaft klettert man eine Stufe hinauf …“ |
| Acht große Tore zu je fünf Feldern, links und rechts je zwei Felder Turm (fest), alle zu (`opens: 'never'`); die Welt liefert Felder, Mitte, Richtung nach außen und Winkel (`world.gates`) | „Acht große Tore …“ |
| Neben jedem großen Tor eine Portal-Plattform (Mitte gleich neben dem Turm, sechs Felder neben der Tormitte, drei Felder vor der Torreihe; die Bucht ist auf ihrer Seite breiter). Die Gegenstücke stehen im Kreis um das Bett (Radius 9, `HOMES.lichtung.portalRing`), jedes in Richtung seines Tors (Winkel und Reihenfolge wie die Tore); gerundet wird zum nächsten Feld, berührte eine Plattform dort eine andere, nimmt sie die nächste andere Rundung. Jede Plattform ist flach (3 × 3), alle neun Felder begehbar und vom Bett aus erreichbar; ringsum ein Feld frei (auch Felsen des Felsrands weichen), ein Feld weiter kein Baum und kein Busch (`world.portals`) | „3 × 3 Felder am Tor und am Bett, von allen vier Seiten erreichbar, ringsum frei“ |
| Im Ring um das Bett berührt keine Plattform eine andere (Mitten mindestens 4 Felder auseinander), keine liegt auf der Wiese, unter dem Riesenpilz, und ihr freier Ring nicht auf Bett, Trögen, Pilzstiel oder Klangstein | „im Ring um das Bett: keine Plattform berührt …“ (3000 Seeds) |
| Ums Bett die Wiese: eben, frei, vom Bett aus erreichbar, mit Futtertrog (`HOMES.lichtung.food`) und Wassertrog (`HOMES.lichtung.water`), am Rand Blumen; Tiere der Lichtung wohnen nicht auf der Wiese | „Ums Bett liegt die Wiese …“ |
| Jede Gegend hat ein Zuhause (`world.homes`): Bett, Plätze zum Aufwachen, Tröge und Unterstand liegen in ihr, so wie `HOMES` sie relativ zum Bett legt; das Bett der Lichtung steht bei 0, 0. Ihre Wohnplätze (`world.spotsOf(realm)`) liegen in ihr und nicht auf der Wiese | „jede Gegend hat ein Zuhause …“ |
| Die Landschaft ist sanft (selten mehr als eine Stufe zwischen Nachbarn) | „ist meist sanft …“ |

## Nebel

| Regel | Test |
| --- | --- |
| Am Anfang liegt alles im Nebel außer einem Kreis mit Radius 10 um das Bett | (Komponente) |
| Bei jedem Schritt lichtet sich ein Kreis mit Radius 7 um die Figur | „lichtet sich rund um die Figur …“ |
| Nur wenn sich etwas geändert hat, wird die Nebel-Maske neu berechnet | „meldet nur Stücke, in denen sich wirklich etwas geändert hat“ |
| Erkundetes wird gespeichert (je Stück 32 Byte als Base64) und übersteht Laden und kaputte Daten | „übersteht das Speichern und Laden“, „ist im Spielstand klein …“ |
| Im Nebel sind keine Tiere und keine Zeichen über Tieren zu sehen; die Karte zeigt nur Erkundetes | (Zeichnen) |

Die Regeln kennen den Nebel nicht: Er betrifft nur, was gezeichnet wird.

## Stimmung der Richtungen

Die Lichtung gibt auf dem Weg nur eine Ahnung dessen, was hinter einem Tor wartet; die eigentliche Welt beginnt erst hinter dem Tor. `world.climate(x, y)` liefert die Welt des nächsten Tors (wie hinter dem Felsring, Grenzen leicht gewellt) und die Stärke: 0 bis knapp zur Hälfte des Wegs zum Rand, dann weich ansteigend bis 1 am Felsring. Flecken (Schnee, Sand, Basalt, Stein, Moos) gibt es nur vereinzelt nah am Rand (höchstens etwa jedes zehnte Feld), besondere Bäume mischen sich unter die normalen; Teilchen und Wind halb so stark, Schnee fällt nur ganz nah am Eistor. Alles aus dem Seed; nur Boden, Baumart und Farben ändern sich, keine Höhen, nichts versperrt (die Regeln bleiben gleich).

| Richtung | Stimmung | Test |
| --- | --- | --- |
| Eis | Schneeflecken (ohne Grasbüschel und Blumen), Bäume mit Schnee auf der Krone, kühles Licht; Regen fällt hier als Schnee | „Richtung Eis Schnee …“ |
| Sand | gelbliches Gras, Sandflecken nahe am Rand, helles warmes Licht | „… Sand …“ |
| Wasser | Blütenbäume | „… Richtung Wasser Blüten …“ |
| Lava | trockenes Gras, Basaltflecken und kahle Bäume nahe am Rand, rötlich warmes Licht | (Zeichnen) |
| Höhle | graueres Gras, Steinflecken, dämmriger | (Zeichnen) |
| Wald | Herbstbäume in Orange und Rot, warmes Licht | „… Richtung Wald Herbst …“ |
| Pilze | lila Moosflecken, leicht lila Licht | „… Richtung Pilze Moos“ |
| Wolken | viel Wind, ziehende Wolkenschatten, weiße Federwölkchen | (Zeichnen) |
| Am Bett und auf der Wiese neutral | | „am Bett ist es neutral“ |

Leben: Herbstblätter wehen Richtung Wald, Funken glimmen Richtung Lava, Sporen schweben Richtung Pilze, Glühwürmchen leuchten Richtung Höhle auch am Tag (nicht bei reduzierter Bewegung). Wind (`windAt`, getestet): überall eine leichte Brise, stärker Richtung Wolken und Wald und bei Wolken und Regen; die Grasbüschel wiegen sich (Shader, bei reduzierter Bewegung still).

Licht: Sonne und Himmelslicht nehmen leicht Farbe und Helligkeit der Richtung an, in der die Figur steht (`MOOD_LIGHT`, höchstens gut ein Drittel); das Gras ist zart getönt (höchstens gut die Hälfte). In 2D eine ganz leichte Tönung; in 3D keine Tönung auf der Ebene darüber (dort würde sie zu einem flächigen Schleier). Die Farben der Welt bleiben erkennbar.

## Wetter und Unterstand

Rein in `mitwachsen-weather.ts`: Das Wetter folgt aus Seed, Tag (`state.day`) und Spielzeit seit dem Aufwachen (`state.tick - state.dayStart`), gleiche Werte ergeben gleiches Wetter. *Test: „nach dem Schlafen beginnt das Wetter von vorn …“*

| Regel | Test |
| --- | --- |
| Alle 5 Minuten Spielzeit (3000 Takte) ein neues Wetter: Sonne 50 %, Wolken 25 %, Regen 25 %; jeder Tag beginnt mit Sonne | „jeder Tag beginnt mit Sonne …“ |
| Weicher Übergang über 20 s; nach dem Regen 1,5 Minuten Regenbogen | „wechselt weich …“, „nach dem Regen steht eine Weile ein Regenbogen …“ |
| Regnet es, gehen die Tiere der Wiese unter den Unterstand ihrer Gegend, auf der Lichtung den Riesenpilz (7 × 3 Felder oben auf der Wiese, `HOMES.lichtung.shelter`, `cell.roof`; der Stiel in der Mitte ist fest): jedes an einen eigenen Platz darunter, vorn zuerst, oder, wenn er voll ist, dicht daneben, und bleibt dort; danach zurück an ihre Plätze. Sie verlassen die Wiese dabei nie | „Unterstand bei Regen“ |
| Bild: Wolken dämpfen Sonne und Himmel, Regen fällt in feinen schrägen Strichen (nicht bei reduzierter Bewegung), der Regenbogen steht als Pixelbogen oben rechts. Der Unterstand ist ein Riesenpilz (Fliegenpilz): cremefarbener Stiel mit Kragen in der Mitte, hoher roter Hut mit weißen Tupfen in Stufen; der Hut sitzt so hoch, dass man die Tiere in den vorderen Reihen darunter sieht, und wird vor der Figur durchsichtig wie Laub | (Zeichnen) |

## Nachwachsen

Rein in `mitwachsen-growth.ts`. Jedes Schlafen zählt einen Tag (`state.day`, gespeichert als `day`). Nur Zierde, die Regeln ändern sich nicht.

| Regel | Test |
| --- | --- |
| Mit jedem Tag blüht auf freier Wiese der Lichtung mehr (1,2 % der Felder je Tag, höchstens 12 %), dazu Pilze (0,3 % je Tag, höchstens 3 %) | „am ersten Tag wächst nichts dazu …“ |
| Was einmal gewachsen ist, bleibt an späteren Tagen | „was gewachsen ist, bleibt …“ |
| Nur freie Wiese der Lichtung; Bäume, Wasser, Steine und die Welten hinter den Toren bleiben | „nur auf freier Wiese …“ |
| Jedes Schlafen zählt einen Tag, der Tag kommt mit dem Spielstand wieder | „jedes Schlafen zählt einen Tag …“ |

## Müde werden (Medienzeit)

Rein in `mitwachsen-tired.ts`, die Uhr gehört zum Kind (ein Wert je Browser, `larmic.games.mitwachsen.tired`), nicht zur Welt.

| Regel | Test |
| --- | --- |
| Gezählt wird nur echte Spielzeit: Takt läuft (Seite sichtbar, Menü und Hinweis zu) und die Figur ist wach; Lücken über 5 s zählen nicht | „zählt nur echte Spielzeit …“ |
| Nach 15 und 20 Minuten setzt sich die Figur 2,5 s hin (Laufen geht so lange nicht), gähnt, und eine Sprechblase sagt es (Mond und „Zzz“ für das Kind, ein Satz zum Vorlesen) | „gähnt nach 15 und 20 Minuten …“ |
| Nach 25 Minuten will die Figur ins Bett (Mond und Bett in der Blase, dazu ein „i“-Knopf zum Hinweis für Eltern), danach alle 3 Minuten wieder | „gähnt nach 15 und 20 Minuten …“ |
| Verpasste Hinweise kommen nur einmal | „meldet verpasste Hinweise nur einmal“ |
| Spielt niemand: nach 20 s ohne Eingabe setzt sich die wache Figur, schaut zum Betrachter und liest in einem großen aufgeschlagenen Buch auf dem Schoß (weiße Seiten mit Zeilen nach oben, alle 5 s blättert eine Seite um); nach 2 Minuten nickt sie ein (Augen zu, „Zzz“). Jede Taste weckt sie, sie läuft sofort los. Solange sie liest oder döst, läuft die Uhr fürs Müdewerden nicht. Nach Menü, Hinweis oder Tab-Wechsel beginnt die Zeit neu | „ohne Eingabe setzt sich die Figur …“ |
| Ab 20 Minuten wird das Licht golden (bis 25 Minuten 60 %, ab 35 Minuten ganz) | „der Himmel wird ab 20 Minuten abendlich …“ |
| Gesperrt wird nichts. Schlafen im Bett beendet den Tag (die Zeit beginnt neu), ebenso eine Pause über 60 Minuten | „nach einer langen Pause beginnt ein neuer Tag“ |
| Gespeichert alle 5 s und mit dem Spielstand; Kaputtes ergibt einen neuen Tag | „übersteht Speichern und Laden …“ |

**Hinweis für Eltern** (`MitwachsenParentInfo.astro`): unter 3 Jahren, 3 bis 6 Jahre (S2k-Leitlinie), WHO, gemeinsames Spielen (Madigan u. a.), jeweils mit Angabe, wer es empfiehlt, und ohne Vorschriften, wie das Spiel hilft, Quellen als Links. Erscheint beim ersten Öffnen vor dem Spiel (gemerkt in `larmic.games.mitwachsen.info`), wieder zu öffnen im Menü („Für Eltern: Medienzeit“) und über den „i“-Knopf der Bett-Sprechblase. Steht ohne JavaScript im Text der Seite. Solange er offen ist, ruht das Spiel.

## Invarianten

Geprüft mit je 4000 zufälligen Befehlen auf drei Welten (*Test: „Invarianten bei wildem Drücken“*):

- Die wache Figur steht immer auf einem Feld, auf dem man stehen kann.
- Nie stehen zwei Wesen auf einem Feld.
- Tiere auf der Wiese verlassen sie nie.
- Jedes Tier ist höchstens einmal in der Kette.
- Gleiche Befehle ergeben den gleichen Zustand (kein `Math.random`, Zufall aus dem Zustand).

In der 3D-Ansicht liegen in Torhäusern und Portal-Plattformen (in jedem Zustand, der zugleich sichtbar ist) nie zwei Flächen deckungsgleich in einer Ebene; sonst flackern sie beim Bewegen (Z-Fighting, Rückmeldung: Grafikfehler am Regenbogen). Gold ersetzt die Voxel darunter, statt über ihnen zu liegen. *Test: „Torhäuser und Portal-Plattformen flackern nicht“ (`mitwachsen-gatehouse.test.ts`)*

Auch zwischen Torhaus und Gelände nicht: Die zwei Reihen hinter den Türmen, die das Torhaus ganz umschließt, sind im Felsring so flach wie das Turmfeld; hohe Felsblöcke dort stellten ihre Wände genau in die inneren Turmwände (Rückmeldung: Torseiten flackern). *Test: „Torhaus und Felsring“ (`mitwachsen-world.test.ts`)*

Schatten flimmern nicht beim Laufen: Die Schattenkamera folgt der Figur nur in ganzen Pixeln ihrer Schattenkarte (quer zum Licht eingerastet), und ein kleiner Versatz entlang der Flächen (`normalBias`) verhindert Streifen auf Wänden, die die Sonne schräg trifft (Rückmeldung: Flackern an den Seiten der Baumstämme). *Test: „Schatten rasten ein“ (`mitwachsen-geo.test.ts`)*

## App (installieren und ohne Netz spielen)

Das Spiel lässt sich als App auf den Home-Bildschirm legen und startet danach auch ohne Netz.

| Was | Regel |
| --- | --- |
| Manifest | `/manifest.webmanifest`, beim Build erzeugt: Name „Mitwachsen“, `lang` de, `start_url` und `id` `/spielen/`, `scope` `/` (so installiert „Zum Home-Bildschirm“ auch von der Startseite aus das Spiel), `display` standalone (Uhr und Akku bleiben sichtbar, Vollbild gibt es im Menü), Farben `--sky-1`. **Keine `orientation`:** Das Spiel dreht sich mit dem Gerät |
| Icons | Grasblock auf Himmel (`--sky-2`), beim Build gerendert: 192 und 512 px, dazu je eine maskierbare Fassung mit Rand (Würfel auf 60 %, bleibt im sicheren Kreis von 80 %); dazu wie bisher `apple-touch-icon` |
| Kopfdaten | Jede Seite verweist auf das Manifest, setzt `theme-color` und `apple-mobile-web-app-*`. Das ist kein JavaScript: Die Startseite lädt weiterhin keine einzige JavaScript-Datei |
| Service Worker | `/spielen/sw.js`, Gültigkeit (`scope`) nur `/spielen/`. Angemeldet nur von der Spielseite, nach dem Laden, nur im fertigen Build, mit `updateViaCache: 'none'` (die Frage nach einer neuen Version geht nie über den HTTP-Cache); Fehler bleiben still, das Spiel läuft auch ohne |
| Erster Start | Ohne Netz läuft die App erst, nachdem die Spielseite einmal mit Netz geöffnet war: Die Startseite lädt kein JavaScript und meldet deshalb keinen Service Worker an. Wer von der Startseite aus installiert, startet die App einmal mit Netz (oder öffnet vorher das Spiel) |
| Vorab gespeichert | alles, was `/spielen/` braucht: die Seite selbst, Skripte (auch das per `import()` nachgeladene Three.js), Stylesheets, Schriften, Icons, Manifest, Aufnahmen der Klangsteine. Die Liste wird nach dem Build aus der fertigen Seite gesammelt (Verweise in HTML, CSS, Manifest und JavaScript), nie von Hand gepflegt. Zusammen höchstens `PRECACHE_BUDGET` (960 KiB, `scripts/verify-pwa.ts`; heute rund 894 KiB, gut 550 KiB davon Three.js): Jedes Gerät lädt alles mit jeder neuen Version ganz, auch über Mobilfunk |
| Anfragen | nur GET auf der eigenen Seite. Dateien der Liste kommen aus dem Cache, fehlt dort etwas, aus dem Netz. Ein Aufruf von `/spielen/` (auch mit `?…` oder `index.html`) bekommt das gespeicherte HTML. Andere Pfade der eigenen Seite kommen aus einem älteren `mitwachsen-*`-Cache, falls es sie dort gibt (für eine alte, noch offene Seite), sonst aus dem Netz, und werden nie gespeichert. Fremde Adressen gehen unverändert ins Netz |
| Neue Version | Cache-Name `mitwachsen-<Version>`, die Version ist ein Hash über Pfade und Inhalte. Die neue Version lädt im Hintergrund und wartet; von sich aus gilt sie ab dem nächsten echten Start (keine Seite der alten mehr offen). Installierte Apps werden aber meist nur angehalten und fortgesetzt, ohne neu zu laden – darum übernimmt das Spiel eine wartende Version selbst, an zwei sicheren Stellen (siehe „Updates an sicheren Stellen“) |
| Aufräumen | beim Aktivieren der neuen Version werden die alten `mitwachsen-*`-Caches gelöscht, aber nur, wenn keine Spielseite mehr offen ist (gezählt werden alle Fenster unter `/spielen/`, auch ohne Service Worker) – auch die Seite, die um `skipWaiting` gebeten hat, zählt, denn sie lädt vielleicht erst im nächsten sicheren Moment neu. Ist noch eine offen (die bittende Seite oder ein zweiter Tab mit der alten Version), bleiben sie: Diese Seite holt ihre Dateien mit Hash im Namen, auch ein spät nachgeladenes Three.js, bis zuletzt aus ihrem Cache – auf dem Server gibt es sie dann nicht mehr. Jede Spielseite meldet sich nach dem Laden beim Service Worker („tidy“); ist sie die einzige offene Spielseite und wartet keine neuere Version, räumt er die alten Caches dann weg. Fremde Caches bleiben immer |
| Speicher | Als installierte App (display-mode standalone) bittet die Spielseite still um dauerhaften Speicher (`navigator.storage.persist()`), damit Spielstände nicht weggeräumt werden; im Browser-Tab nicht, weil manche Browser dort nachfragen |
| iPhone und iPad | Die App vom Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari: Ein in Safari begonnener Spielstand erscheint einmalig nicht in der App (Welt-Code im Menü hilft, die Landschaft mitzunehmen). Dafür gilt für Apps auf dem Home-Bildschirm die Löschung nach 7 Tagen ohne Besuch nicht |

### Updates an sicheren Stellen

Rein in `pwa-update.ts`, angewandt in `pwa-register.ts`. Kein Hinweis für das Kind, Eltern müssen nichts tun. Die mit „e2e“ bezeichneten Tests stehen in `e2e/pwa-update.spec.ts`.

| Regel | Test |
| --- | --- |
| **Auslöser 1, Gute Nacht:** Die Figur ist ins Bett gegangen (Ereignis `sleep`, Spielstand gespeichert). Nach dem Ritual (`RITUAL_MS`, 4 s: Nacht blendet ein, Schlaflied verklingt) fragt die Seite nach einer neuen Version (`registration.update()`) | „schlafend nach dem Gute-Nacht-Ritual ist sicher …“, e2e „nach dem Gute-Nacht-Ritual …“ |
| **Auslöser 2, lange Pause:** Wird die Seite nach mindestens `LONG_PAUSE` (30 Minuten, Uhrzeit) verborgen wieder sichtbar, fragt sie ebenso nach einer neuen Version | „zählt erst ab der Schwelle …“, e2e „zurück nach langer Pause …“ |
| **Sicherer Moment:** Die Figur schläft seit mindestens `RITUAL_MS` (oder seit dem Öffnen der Welt), oder der Hinweis für Eltern ist beim allerersten Öffnen noch offen (kommt nach dem Laden genauso wieder). Nie, wenn das Menü offen ist, der Hinweis aus dem Menü oder der Sprechblase geöffnet wurde, die Seite verborgen ist, das Spiel im Vollbild läuft (Neuladen beendete es) oder der Spielstand nur im Arbeitsspeicher liegt (kein `localStorage`) | „mitten im Spiel nie“, „nie, solange Eltern …“, „der Hinweis beim allerersten Öffnen …“, „nie ohne dauerhaften Speicher …“ |
| **Übernehmen:** Wartet eine neue Version und ist der Moment sicher, innerhalb von `ARM_MS` (60 s) nach einem Auslöser – auch wenn sie erst jetzt fertig geladen ist –, bittet die Seite sie per Nachricht um `skipWaiting`. Ohne Auslöser, später oder mitten im Spiel nie | „übernimmt eine wartende Version kurz nach einem Auslöser …“, „nicht lange nach dem Auslöser …“, e2e „mitten im Spiel wird nie neu geladen …“ |
| **Neu laden:** Sobald die neue Version die Seite übernimmt (`controllerchange`), prüft die Seite den sicheren Moment noch einmal – zwischen Bitte und Übernahme kann das Kind die Figur geweckt haben (ein ruhender Service Worker startet auf dem Tablet erst). Ist er noch sicher, lädt sie einmal neu. Sonst spielt das Kind ungestört weiter (die neue Version liefert der Seite die alten Dateien, siehe „Aufräumen“), und neu geladen wird beim nächsten Auslöser in einem sicheren Moment (`shouldReload`) | „lädt neu, wenn die neue Version übernommen hat …“, „nicht, wenn das Kind die Figur zwischen Bitte und Übernahme geweckt hat …“, e2e „weckt das Kind die Figur zwischen Bitte und Übernahme …“ |
| **Nach dem Neuladen** ist alles wie vorher: Die Welt öffnet schlafend im Bett, sofort Nacht (ohne Überblendung), ohne Ton, ohne Hinweis für Eltern (schon gesehen); die Müde-Uhr ist nach dem Schlafen ohnehin neu | e2e „nach dem Gute-Nacht-Ritual …“ |
| **Keine Schleife:** Neu geladen wird nur, wenn die Seite selbst um `skipWaiting` gebeten hat (beim ersten Besuch übernimmt `clients.claim()` die Seite ohne Neuladen), und höchstens einmal in `APPLY_GAP` (10 Minuten, gemerkt im `sessionStorage`) | „lädt nicht in einer Schleife neu“, e2e (kein zweites Neuladen) |
| **Mehrere Tabs:** Nur der Tab, der schlafen ging, lädt neu. Ein anderer offener Tab läuft mit seiner alten Version ungestört weiter und bekommt seine Dateien weiter (siehe „Aufräumen“) | „ein zweiter alter Tab bekommt …“ (`sw.test.ts`), e2e „ein zweiter, alter Tab …“ |

Der Browser-Test arbeitet mit zwei echten Fassungen der Seite: Vor dem Test leitet `e2e/versions.ts` aus dem Build in `dist/` eine zweite ab (`.e2e/v2`): Die 3D-Datei mit Three.js bekommt neuen Inhalt und einen neuen Namen, die alte fehlt auf dem Server, und der Service Worker wird mit demselben Code wie beim Build neu geschrieben (`writeServiceWorker`). Kein zweiter Build, nichts Testspezifisches in der Seite. Der Test-Server (`e2e/serve.ts`) liefert einem Browser-Kontext mit dem Cookie `mw-version=2` die zweite Fassung, so laufen die Tests parallel und in der Pipeline genauso wie lokal.

Invarianten:

- Die Startseite meldet keinen Service Worker an und lädt kein JavaScript. *Bundle-Gate (Startseite: Budget 0 für Skriptdateien und eingebettete Skripte; `serviceWorker` ist außerhalb von `/spielen/` verboten, auch eingebettet; „meldet Verbotenes in einem eingebetteten Skript“ in `scripts/bundles.test.ts`), `e2e/pwa.spec.ts`*
- Die Liste enthält alles, was `/spielen/` lädt, und jede JavaScript-Datei der Seite; jeder Eintrag ist ein Pfad der eigenen Seite und existiert; der Service Worker speichert sich nicht selbst. *App-Gate `npm run verify:pwa` (`scripts/pwa.ts`)*
- Die Version passt zum Inhalt: Ändert sich eine Datei, ändert sich der Service Worker, und Geräte bekommen die neue Fassung. *App-Gate, „ändert die Version mit jedem Inhalt“ (`precache.test.ts`)*
- Eine neue Version löscht beim Installieren nichts; alte Caches verschwinden erst beim Aktivieren, und nur, wenn keine Spielseite mehr offen ist (auch die bittende nicht), sonst nach dem Neuladen per „tidy“. *„eine neue Version lässt die alte stehen …“, „räumt nicht, solange …“, „die bittende Seite behält ihren alten Cache …“, „„tidy“ räumt nicht …“ (`sw.test.ts`)*
- Der Service Worker ruft `skipWaiting` nie von sich aus, nur auf die Bitte des Spiels; das Spiel bittet nur an einer sicheren Stelle und lädt nie mitten im Spiel neu. *„wartet von sich aus …“ (`sw.test.ts`), `pwa-update.test.ts`, e2e „mitten im Spiel wird nie neu geladen …“*
- Eine neue Fassung wartet, solange eine Seite der alten offen ist; die alte Seite spielt weiter und bekommt ihr altes Three.js auch ohne Netz, obwohl der Server es nicht mehr hat. Sind alle Seiten zu, gilt beim nächsten Öffnen die neue, und die alten Caches sind weg. *„Zwei Fassungen: die offene alte Seite läuft weiter …“ (`e2e/pwa-update.spec.ts`)*
- Das Gute-Nacht-Ritual übernimmt eine wartende Fassung und lädt genau einmal neu, in die Nacht im Bett. *„nach dem Gute-Nacht-Ritual kommt die wartende Fassung …“ (`e2e/pwa-update.spec.ts`)*
- Neu geladen wird nur in einem sicheren Moment, auch wenn das Kind die Figur zwischen der Bitte um `skipWaiting` und der Übernahme weckt. *„nicht, wenn das Kind die Figur … geweckt hat …“ (`pwa-update.test.ts`), e2e „weckt das Kind die Figur zwischen Bitte und Übernahme …“*
- Startseite und Spielseite sind für Chromium installierbar: keine Einwände (`Page.getInstallabilityErrors`, im vollen Chromium – die Headless-Shell meldet nie etwas; `in-incognito` zählt nicht, Playwright-Kontexte sind privat), Manifest ohne Fehler (`Page.getAppManifest`). Eine Gegenprobe zeigt, dass die Prüfung greift: ohne Manifest `no-manifest`, mit `display: 'browser'` und ohne Icons die passenden Einwände. *„Seite … ist für Chromium installierbar“, „Gegenprobe: ohne Manifest …“ (`e2e/installable.spec.ts`)*
- Die Anmeldung fragt am HTTP-Cache vorbei nach neuen Versionen (`updateViaCache` nie `'all'`). *„fragt am HTTP-Cache vorbei …“ (`pwa-update.test.ts`), `e2e/pwa.spec.ts` (Spiel ohne Netz)*
- Was vorab gespeichert wird, bleibt im Budget `PRECACHE_BUDGET`. *App-Gate, „lässt genau das Budget durch …“ (`scripts/pwa.test.ts`)*
- Ohne Netz startet `/spielen/` neu, mit 3D, ohne Fehler in der Konsole. *„Spiel: Service Worker steuert /spielen/, ohne Netz startet das Spiel trotzdem“ (`e2e/pwa.spec.ts`)*

## Speichern

| Was | Regel |
| --- | --- |
| Schlüssel | `larmic.games.index` (Liste der Welten, aktuelle Welt), `larmic.games.world.<id>` je Welt, `larmic.games.muted` |
| Format | `{ v: 4, game: 'mitwachsen', age, id, seed, worldName, figureName, openGates, metAnimals, homeAnimals, portals, position, visits, day, explored, heard }`; `heard` sind die schon gehörten Geschichten (fehlt es, ist keine gehört); `day` zählt die Tage (fehlt er, ist es Tag 0); `portals` sind die wachen Portal-Plattformen (Format wie bei den früheren Portalen: alte Spielstände laden unverändert, ihre aktiven Portale sind wache Plattformen; Unbekanntes fällt weg); `explored` ist der Nebel je Stück (fehlt er, beginnt die Welt im Nebel); `age` ist die Altersstufe der Welt (bisher nur 3) |
| Umzug | Version 1 (Arbeitstitel `game: 'threeyear'`, ohne Alter) → 2 (Alter 3) → 3 (`penAnimals` heißt jetzt `homeAnimals`) → 4 (Start auf der Lichtung: gefundene Tiere des alten Zuhauses, die es auf der Lichtung gibt, bleiben gefunden; Tore, Garten und Position beginnen neu). Ältere Indizes werden übernommen |
| Wann | sofort bei gefunden, Garten, Tor, Plattform erwacht, Reise, Schlafen, Weltwechsel und Umbenennen; sonst alle 10 s; beim Verlassen der Seite |
| Fehler | Jeder Zugriff fängt Fehler ab. Ohne Speicher läuft das Spiel bis zum Neuladen weiter. |
| `migrate()` | verwirft Fremdes (anderes Spiel, unbekannte Version) und räumt auf (unbekannte Tore und Arten, doppelte Einträge, kaputte Felder) |
| Welt-Code | Seed in Basis 36, z. B. `0IDFDSE`; ergibt dieselbe Landschaft ohne Spielstand |

*Tests: `mitwachsen-save.test.ts`*

## Was angezeigt wird

| Was | Regel |
| --- | --- |
| Ansicht | **3D** mit Three.js (WebGL): Kamera schräg von oben (55°) aus Süden, folgt der Figur; echtes Sonnenlicht mit Schatten, Himmel und Nebel in der Ferne. Three.js wird erst beim Spielstart per `import()` nachgeladen (Bundle-Gate: höchstens 128 KB JavaScript beim Laden der Spielseite, kein Three.js). Darüber liegt ein durchsichtiges 2D-Canvas für Zeichen über den Tieren, Herzen, Noten, Heimweg-Pfeil, Nacht, Schmetterlinge und die Leiste. Ohne WebGL bleibt die **2D-Ansicht von vorn** (Reihe für Reihe von hinten nach vorn), sie läuft auch, bis 3D geladen ist |
| Verdeckte Figur | In 3D wird Laub halb durchsichtig, das zwischen Kamera und Figur steht (Baumkronen, Büsche, Hecken auf Körperhöhe oder darüber; Boden und Felsen bleiben fest): ein weicher Kreis um die Sichtlinie, bis zu drei von vier Pixeln weggelassen, die Figur selbst bleibt unverändert. In 2D wird die Figur halb durchsichtig obenauf gezeichnet |
| Nebel | keine Blöcke: Die Welt verblasst am Rand des Erkundeten weich in die Himmelsfarbe und verschwindet im Dunst. 3D: Nebel-Maske (128 × 128 Felder um die Figur, zweimal weich verwischt) als Textur, ein Shader-Zusatz mischt nach der Beleuchtung in die Himmelsfarbe (nachts dunkel). 2D: Unerkundetes bleibt leer, am Rand heller Dunst |
| Große Tore | Mächtige Torhäuser (9 Felder breit, Türme gut 6 Ebenen hoch) mit geschlossener Doppeltür und leuchtendem Zeichen, je Welt geschmückt: Eis (Schneehauben, Eisspitzen, Eiszapfen), Sand (Stufenkronen, Bänder), Wasser (Wasserfälle, Muscheln), Lava (glühende Adern und Krone), Höhle (leuchtende Kristalle), Wald (Laubkronen, Ranken), Wolken (Wolkentürme, Regenbogen), Pilze (Pilzstiele mit Riesenhüten). Vor der Figur wird ihr Mauerwerk durchsichtig. Steht die Figur vor einem Tor, lichtet sich der Nebel im Gang dahinter (Blick in die Welt) |
| Welten hinter den Toren | Eis: Schnee, zugefrorene Seen, Eisblöcke, Schneetannen. Sand: Dünen, blühende Kakteen, Oasen mit Palmen. Wasser: Inseln mit Palmen und Seerosen. Lava: Basalt, glühende Flüsse und Seen, kahle Bäume. Höhle: dunkler Stein, leuchtende Kristalle, Tropfsteine. Wald: Bäume, Tannen, Beerenbüsche, Farne. Wolken: Wolkeninseln über dem Himmel. Pilze: lila Moos und Riesenpilze. Tiere dort sind vorerst die der Landschaft |
| Portal-Plattformen | Flache Platte mit runden Ecken aus 24 × 24 Voxeln (ein Voxel 1/8 Feld breit und hoch, so groß wie ein Pixel der Bodentexturen): Sockel zwei Lagen (0,25) hoch im Material der Welt, der äußerste Ring nur eine Lage (eine kleine Schwelle); Mittelfeld eine Lage höher mit dem Bild der Welt (8 × 8 Pixel); Zierde klein in der äußersten Spitze der Ecken, höchstens drei Lagen über dem Sockel, nur Bild; auf der Plattform steht die Figur entsprechend höher. Im Mesh nur Flächen, an denen kein anderer Voxel anliegt (*Test: „verdeckte Flächen fallen weg“*). **Schlafend** am Tor: alles matt, Bild nur grau eingeritzt, kein Gold. **Schlafend** am Bett: leerer grauer Sockel aus Lichtungsstein, für alle Welten gleich (nur die erhöhte Mitte), ohne Bild, ohne Zierde. **Erwachen:** das Licht kommt in vier Stufen. **Bereit:** Bild leuchtet und pulsiert, Gold-Rahmen eng um die Mitte („hier drauf“), außen mit dunkler Kante, mit Lauflicht, Funken kreisen flach über der Mitte; am Bett Lauflicht und Funken nur, wenn die Figur nah ist. **Angekommen:** Bild gedimmt, kein Rahmen-Gold, dafür goldene Pfeile mit dunkler Kante in den vier Seitenfeldern, die nach außen zeigen („erst runter“), pulsieren in Stufen; beim Heruntersteigen springt es mit einem Pling zurück in den Rahmen. Neben dem Gold liegt in jeder Welt eine deutlich andere Farbe (Lava: dunkler Basalt statt Glut, die Flamme hat dunkle Ecken; *Test: „Gold hebt sich in jeder Welt vom Sockel daneben ab“*). Bei reduzierter Bewegung: keine Funken, kein Lauflicht, kein Pulsieren, kein Stufen-Erwachen; Zustände nur an Farbe und Helligkeit (Gold mit dunkler Kante). 2D-Ersatz: dieselben Voxel als kleine Quader (je Säule einer), ohne Bewegung. Auf der Karte: Kästchen, sobald erkundet, grau solange schlafend, farbig, sobald wach. Erwachen und Reisen klingen und funkeln |
| Hochformat | In 3D rückt die Kamera im Hochformat weiter weg (bis 1,8-fach), der Nebel rückt mit |
| Kamera | folgt der Figur; Figur in der Bildmitte. Etwa 18 Felder breit |
| Feinheit | Texturen 8 × 8 wie auf der Seite, jedes Texel mit feiner Körnung in 2 × 2 Unterpixeln |
| Höhen | höhere Flächen etwas heller; dunkle Kante, wo es hinuntergeht; Schatten am Fuß eines höheren Nachbarn; helle Vorderkante und dunkle Unterkante jeder Stufe |
| Figur | wird zusätzlich halb durchsichtig obenauf gezeichnet, damit sie hinter Hügeln und Bäumen sichtbar bleibt |
| Wesen | gleiten zu ihrem Feld, etwas schneller als der Takt der Eingabe (gut 4 Felder/s); Sprünge über mehr als 2,5 Felder springen direkt |
| Folgende Tiere | kleines Herz darüber |
| Verlorene Tiere | noch nicht gefunden: kleines Fragezeichen über dem Kopf (wippt leicht, außer bei reduzierter Bewegung) |
| Tiere auf der Wiese | ab und zu steigt ein kleines Herz auf (nicht bei reduzierter Bewegung); beim Ankommen hüpfen sie, rufen ihren Ton und funkeln |
| Wiese ums Bett | offen, Blumen am Rand; Futtertrog aus Holz mit Heu und Möhren, Wassertrog |
| Klangsteine | grauer Steinblock, darüber eine goldene Achtelnote, die schwebt und sich leicht dreht; noch nie gehört: größer und sanft pulsierend (bei reduzierter Bewegung still, aber größer). Beim Zuhören sitzt die Figur, solange sie stehen bleibt, und Noten steigen auf; Melodie über WebAudio, Aufnahme danach als Audiodatei, die erst jetzt geladen wird |
| Beerenbüsche | niedrig und rund in zwei Stufen, mit roten Beeren oben und vorn, damit man sie nicht für Baumwipfel hält (erster Spieltest) |
| Natur | Grasbüschel, Farne, Pilze, bemooste Findlinge (blockieren, nur auf Hügeln); Bäume als Eiche, Birke, Herbst- oder Blütenbaum, in Gruppen; Farbflecken im Boden. Reine Zierde aus dem Seed, die Regeln ändern sich nicht |
| Licht und Leben | weiche Schatten unter Bäumen, Büschen, Tieren und Figur; warmes Licht von oben links, leichter Dunst oben, dunklere Ränder; glitzerndes Wasser mit hellem Ufer; tagsüber Schmetterlinge und Pollen, nachts Glühwürmchen (Bewegtes nicht bei reduzierter Bewegung) |
| Leiste unten | ein Platz je Art, nach Gegenden gruppiert (eine Art gilt als gefunden, sobald eines ihrer Tiere gefunden ist), dahinter Tiere der Landschaft, die im Garten wohnen: heller Platz mit Umriss und Fragezeichen = noch verloren, Holz mit Tier in Farbe = gefunden, Gras = zu Hause im Garten, Herz = folgt gerade |
| Tafel am Tor | Tiere der Gegend auf dem Brett: gefundene in Farbe, verlorene als Umriss |
| Karte | oben rechts, genordet wie die Kamera, etwa 41 × 41 Felder um die Figur: Felder in ihren Farben, die Figur als Punkt, das Bett der Gegend, in der die Figur steht, als Häuschen. Liegt es außerhalb, zeigt ein Pfeil am Kartenrand nach Hause |
| Touch-Steuerung | auf Geräten ohne Maus (oder nach der ersten Berührung): Steuerkreuz unten links (kein Aktionsknopf); langes Drücken öffnet keine Lupe, Auswahl oder Menüs des Browsers (`touchstart`/`contextmenu` abgefangen, `-webkit-touch-callout: none`), im selben ruhigen Takt wie die Tastatur; die Leiste rückt darüber |
| Kopf | oben links Zahnrad (Menü für Eltern, darin auch der Weg zur Startseite), Mitte Name der Figur, rechts Karte. Kein Zurück-Button: Das Spiel steht für sich |
| Nacht | dunkler Himmel mit Sternen und Mond, die Figur liegt im Bett, Zzz steigt auf. Beim Einschlafen blendet die Nacht ein; öffnet eine Welt (die Figur schläft im Bett), ist es sofort Nacht |
| Menü | Zahnrad oben links: Welten wählen, neue Welt, Welt löschen (zweiter Klick bestätigt), Namen, Welt-Code kopieren, Ton, Vollbild, zur Startseite. Das Spiel pausiert, solange es offen ist |
| Reduzierte Bewegung | keine Partikel, Noten und Zzz, kein Gleiten und Hüpfen, Tore und Nacht ohne Überblendung; Töne bleiben |
