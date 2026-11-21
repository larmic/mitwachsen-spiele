# Konzept: Mitwachsen ab 3

Das Kind läuft mit einer eigenen Figur durch eine endlose Voxel-Welt, findet verlorene Tiere, die singen, wenn man sie findet, bringt sie nach Hause auf die Wiese ums Bett und öffnet so nach und nach neue Gegenden. Zu jedem Ort gibt es eine Geschichte, die ein Klangstein erzählt. Zum Aufhören legt sich die Figur ins Bett, und es wird Nacht.

Hintergrund, Altersstufen und gemeinsame Regeln: [README](README.md). Dieses Dokument beschreibt die erste Stufe (ab 3). Ein früher Prototyp (feste kleine Insel, Tiere treffen) liegt als Artefakt vor und hat gezeigt: Die Pfeiltasten beherrscht das Kind, die schräge Ansicht der Insel auf larmic.de passt aber nicht dazu (→ läuft dort nach rechts unten).

## Grundsätze

1. **Kind steuert, Elternteil sitzt daneben.** Das Kind sieht keinen Text. Texte (Hinweise an Toren) sind zum Vorlesen, Geschichten erzählt ein Klangstein.
2. **Nichts geht schief.** Kein Fehlerton, kein Herunterfallen, kein Verlieren. Wände antworten mit einem Wackeln und „boing“.
3. **Jede Taste tut etwas Freundliches.** Auch wildes Drücken ist gut.
4. **Ritual zum Anfangen und Aufhören.** Die Figur wacht im Bett auf und legt sich dort wieder schlafen. Wann Schluss ist, entscheidet der Elternteil; gespeichert wird ohnehin laufend.

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Pfeiltasten | Figur geht ein Feld in Bildschirmrichtung (→ nach rechts, ↑ nach oben). Gedrückt halten: höchstens etwa 4 Felder pro Sekunde, Autorepeat des Systems wird ignoriert. |
| Leertaste und andere Tasten | Ab 3 ohne Wirkung. Alles geht durch Hineinlaufen: in ein Tier (es folgt), ins Bett (schlafen), auf die Mitte einer Portal-Plattform (reisen). |
| Maus | Nur für das Menü (Zahnrad). Das Kind spielt mit der Tastatur und öffnet es nicht aus Versehen. |
| Touch | Auf Handy und Tablet: Steuerkreuz unten links, im selben ruhigen Takt. |

**Erster Spieltest:** Eine Aktionstaste war für den Dreijährigen ein Schritt zu viel. Darum gibt es ab 3 nur Laufen. Die Regeln kennen die Aktion weiter (singen, schlafen, rufen); eine spätere Altersstufe kann sie wieder an eine Taste binden.

## Ansicht und Kamera

- **3D-Ansicht:** echtes 3D mit Three.js, Kamera schräg von oben (etwa 55°, im Code einstellbar), Sonnenlicht mit Schatten, Nebel in der Ferne. Texturen wie in `src/lib/voxel/textures.ts`, pixelig. Three.js lädt erst beim Spielstart nach, die Startseite nie (Bundle-Gate). Ebenso kommt jede Welt hinter einem Tor als eigenes Welt-Paket (heute die Eis-Welt), damit die Spielseite schlank bleibt, auch wenn noch viele Welten dazukommen. Geladen wird es erst, wenn ihr Tor eine Rolle spielt: Tor offen, der Pinguin ist fällig, die Figur kommt dem Tor nah oder war zuletzt dort. Wer das Tor noch zu hat, startet ein wenig schneller; bei offenem Tor ist alles wie gewohnt sofort da. Mit dem Paket kommen auch Iglu, Fischkisten, Eis-Wetter und die Modelle der Eis-Tiere; was die Welt nur in 3D zeigt (Iglu und Fischkisten in 3D, Tür und Eiszapfen des Eistors), lädt die 3D-Ansicht gleich danach als kleinen eigenen Teil. Für das Kind sieht alles aus wie vorher. Die App speichert alle Welten samt 3D vorab, so geht das Eistor auch ohne Netz wie gewohnt auf.
- **2D-Ansicht von vorn** als Rückfall ohne WebGL und während 3D lädt: Blöcke zeigen Ober- und Vorderseite.
- **Die Figur bleibt in der Bildmitte**, die Kamera folgt ihr weich, die Welt läuft darunter durch. Gezeichnet wird nur, was im Bild ist.
- **Karte** oben rechts: zeigt mehr als das Bild. Liegt das Zuhause außerhalb der Karte, zeigt ein Pfeil am Kartenrand dorthin.
- **Farben:** Farben der Spielwelt (Tiere, Herzen, Nacht, Sterne) sind Spielgrafik wie die Texturen und stehen in einer Spiel-Palette, nicht in `tokens.css`. Herzen sind rosa oder rot, nicht Gold. Tafeln sind aus Holz mit Pixel-Rahmen in Tinte, Umrisse fehlender Tiere in Tinte. Oberfläche (Zahnrad, Menü, Buttons) nutzt die Tokens und `.pxbtn`; Gold bleibt die Farbe für klickbare Aktionen.

## Welt

- **Endlos**, berechnet aus einem **Seed**. Derselbe Seed ergibt immer dieselbe Welt. Gespeichert werden nur Seed und Fortschritt, nie die Landschaft.
- **Start auf der Lichtung:** Am Anfang gibt es nur das **Bett** in der Mitte einer großen Lichtung (gut 160 × 136 Felder) mit sanften Hügeln, mehreren Teichen, einzelnen Bäumen, Blumenwiesen und Steinen zum Klettern. Keine Mauer, kein Zaun. Ums Bett liegt eine offene Wiese mit Futter- und Wassertrog: das Zuhause der gefundenen Tiere.
- **Frei zugänglich (aus dem ersten Spieltest):** Ein Dreijähriger kommt um einen Baum herum, bei mehreren dicht beieinander wird es schwierig. Darum stehen Bäume und Büsche einzeln, mit Platz ringsum. Büsche tragen rote Beeren, damit man sie nicht für Baumspitzen hält. Läuft man hinein, pflückt die Figur die Beeren und freut sich; nach kurzer Zeit wachsen neue. Die Beeren landen in einem Korb auf dem Rücken der Figur. Bringt das Kind sie zum Futtertrog auf der Wiese, ist der Korb wieder leer, und alle Tiere dort freuen sich. Genauso mit Wasser: Läuft die Figur ans Ufer, schöpft sie einen Eimer voll und trägt ihn in der Hand; am Wassertrog leert sie ihn, und die Tiere freuen sich. Korb und Eimer kann sie zugleich tragen. Keine Stufe ist höher als eins, so kommt man überall hinauf und nirgends in eine Ecke, aus der es nicht herausgeht. Die Tore liegen weit weg.
- **Ringsum natürliche Felsen** mit leicht unregelmäßigem Rand, in Terrassen ansteigend. Sie sind eine feste Grenze: Man kann sie weder besteigen noch hineinfallen. Darin stehen acht **große Tore**, eines je Welt. Wo sie stehen und in welcher Reihenfolge, würfelt jede Welt neu. Das Eistor geht auf, wenn der verlaufene Pinguin das Kind abholt (siehe Eiswelt); die anderen sieben sind vorerst verschlossen. Spielbar sind die Lichtung und die Eiswelt.
- **Nebel:** Zu sehen ist nur, was das Kind schon erkundet hat. Dahinter verschwindet die Welt weich im Dunst, wie echter Nebel, und zeigt sich beim Herumlaufen (gespeichert).
- Hinter den Toren: endlose, berechnete Landschaft in Stücken (16 × 16 Felder).
- **Höhen:** Eine Stufe hinauf geht automatisch mit einem kleinen Hüpfer, auch auf Steine und Felsen; dann Stufe für Stufe weiter. Herunter geht immer, egal wie tief.
- **Wasser** ist nicht begehbar.

## Die Lichtung

| | |
| --- | --- |
| Tiere zum Entdecken | zwölf Arten: Hase, Igel, Schaf, Eichhörnchen, Ente, Kuh, Fuchs, Frosch, Biene, Schildkröte, Bär und Zicklein mit kleinen Hörnern, je vier Tiere (aus dem ersten Spieltest: die Lichtung war zu leer; Bär und Zicklein hat sich mein Sohn gewünscht). Die Leiste zeigt jede Art einmal. |
| Tore | acht, eines je Welt (Eis, Sand, Wasser, Lava, Höhle, Wald, Wolken, Pilze), Lage und Reihenfolge je Welt gewürfelt, alle vorerst zu. Jede Welt hat ihren eigenen Zugang (siehe unten) |

Die Leiste unten ist die **Liste der entdeckten Tiere**: Umriss mit Fragezeichen = noch nicht entdeckt, in Farbe = entdeckt, Herz = folgt gerade. Grün hinterlegt = zu Hause auf der Wiese. Wie sich die Tore später öffnen, hängt an der Geschichte (siehe Ideen: Tiere befreien).

## Die Welten

Die Lichtung ist das Zuhause mit dem Bett. Hinter jedem der acht großen Tore liegt eine eigene Welt mit eigenem Thema, eigenen Pflanzen, später eigenen Tieren und einer eigenen Geschichte. Die Landschaft der Welten ist schon gebaut und durch die Tore zu sehen; betreten kann man sie noch nicht. Für alle gilt: freundlich und ungefährlich, nichts kann der Figur passieren, nichts geht verloren.

| Welt | Stand | Thema (`GateTheme`) |
| --- | --- | --- |
| **Lichtung** | spielbar | – |
| **Eiswelt** | spielbar (das Tor öffnet der Pinguin) | `eis` |
| **Sandwelt** | Landschaft gebaut, Tor zu | `sand` |
| **Wasserwelt** | Landschaft gebaut, Tor zu | `wasser` |
| **Lavaberge** | Landschaft gebaut, Tor zu | `lava` |
| **Höhlenwelt** | Landschaft gebaut, Tor zu | `hoehle` |
| **Wald** | Landschaft gebaut, Tor zu | `wald` |
| **Wolkenwelt** | Landschaft gebaut, Tor zu | `wolken` |
| **Pilzwald** | Landschaft gebaut, Tor zu | `pilze` |

**Was alle Welten verbindet:**

- **Die Welt wächst beim Laufen:** Alles entsteht aus dem Seed, Stück für Stück, wenn die Figur dorthin kommt. Derselbe Seed ergibt immer dieselbe Welt, ein anderer eine andere: Die Tore stehen in jeder Welt woanders und in anderer Reihenfolge. In Richtung jedes Tors liegt seine Welt, endlos.
- **Jede Welt hat ihren eigenen Zugang** (Entwurf „Welten-Zugänge“, umgesetzt am 20.11.2026): Eis eine Schlucht zwischen Gletscherwänden mit Eisbogen, Orgelkrone und der Doppeltür; Sand ein Sandsteinbogen mit rieselndem Sandvorhang, Quelle und Palmen; Wasser ein Muschelbogen, in dem eine Wand aus fließendem Wasser steht, die beim Öffnen in ihr Becken sinkt (umgebaut am 21.11.2026, damit das Tor nicht wie betretbar wirkt); Lava eine Glutkaskade, die über Basaltstufen fließt und Stufe für Stufe zu einem Weg erkaltet, neben einem großen Glutbaum (nichts brennt); Höhle eine geschichtete Felswand mit rundem Höhlenmund, Tropfsteinen und Kristallen, ein Rollstein rollt in eine Nische und Kristall-Lampen gehen an; Wald ein Riesenbaum mit Herbstwipfel, durch dessen Stamm der Weg führt, ein Specht klopft die Tür auf; Wolken eine schlafende Riesenwolke, die aufwacht und den Weg freigibt, dazu ein Regenbogen; Pilze ein verwachsenes Pilztor: zwischen zwei gedrungenen blauen Riesenpilzen ist der Weg mit weichen Pilzranken zugewachsen, die sich beim Öffnen wie Farn an die Stiele rollen und dann als Girlande zwischen den Hüten hängen. Wasserwand, Glutkaskade und Ranken bewegen sich ruhig, auch wenn nichts geschieht (nicht bei „weniger Bewegung“). Die Kamera dreht sich nie, die Zugänge liegen aber rundum im Felsring; darum erkennt man jeden auch von der Seite und von hinten: am hohen Wahrzeichen über dem Fels, an einem Zeichen der Welt, das immer zur Kamera schaut, und am Vorfeld, einem Fächer aus dem Boden der Welt vor dem Zugang. Geöffnet wird vorerst nur das Eistor (mit dem Pinguin); die Übergänge der anderen sind gebaut und warten auf ihre Geschichte. Vor dem Tor ist eine freie Bucht; steht das Kind davor, lichtet sich der Nebel im Gang dahinter, und es sieht schon ein Stück der Welt. Hinter das Tor kommt man nicht, auch nicht außen herum.
- **Torplatte vor jedem Tor** (Konzept „Torplatte“, Schritt 1 umgesetzt am 21.11.2026): Mitten in der Bucht, in der mittleren Reihe, liegt vor jedem Tor ein flacher, ovaler Stein, drei Felder breit, mit einem Rand in der Farbe der Welt; vor dem Eistor eine Eisscholle mit Schneeflocke und hellblauem Rand (in 2D und 3D, sobald die Eis-Welt geladen ist). Wer geradeaus zur Tür läuft, tritt sicher darauf; dafür ist auch die Reihe davor eben (wo dort vorher ein Hügel, ein Kletterstein oder Wasser lag, ist jetzt Gras, darum können Tiere bei alten Spielständen ein wenig anders wohnen). Tritt das Kind darauf (sobald die Füße ankommen), sinkt der Stein ein, macht ein dumpfes Klonk (so hoch, dass auch Tablet-Lautsprecher es spielen) (am Eistor ein helles Klirren) und sein Rand leuchtet; geht es herunter, springt er mit einem leisen Plopp hoch. Jedes Betreten spielt den nächsten Ton eines kleinen Motivs in der Tonart der Welt, fünfmal rauf und runter ergibt die Melodie, dann glitzert der Stein kurz. Ein Spielzeug aus Ursache und Wirkung, keine Begegnung: Die Figur hält nie an, auch nicht beim Drüberlaufen. Gleich in 2D, 3D und bei „weniger Bewegung“ (dort sinkt und springt er ohne Übergang). Vor dem Eistor öffnet die Platte das Tor (Schritt 3 umgesetzt am 21.11.2026, siehe „Das Eistor geht auf“); dass das Bild dabei zur Front schwenkt, kommt in den nächsten Schritten.
- **Portal-Plattform neben dem Tor:** Eine flache Platte mit runden Ecken (3 × 3 Felder, alle begehbar) im Material der Welt, mit einem Bild der Welt auf der Mitte und kleiner Zierde in den Ecken; man steigt von überall auf. Kommt das Kind nah heran, erwacht sie: Das Bild leuchtet, ein goldener Rahmen legt sich um die Mitte, Funken kreisen, und sie bleibt wach. Gleichzeitig erwacht ihr Gegenstück im Kreis um das Bett, in Richtung ihres Tors (vorher ein leerer grauer Sockel, der nicht verrät, wohin er führt). Wer auf die Mitte tritt, reist zum Gegenstück, folgende Tiere reisen mit. Nach der Ankunft zeigen goldene Pfeile nach außen: erst runter, dann wieder rauf, und es geht zurück.
- **Eigene Tiere:** Jede Welt bekommt ihre eigenen verlorenen Tiere, sobald man hinein kann. Die Vorschläge unten sind Ideen, gemeinsam mit dem Kind auszusuchen.
- **Gleiche Regeln:** Klettern, Nebel, Folgen und Schlafen bleiben überall gleich. Neu ist nur, wie die Welt aussieht und klingt.
- **Öffnen der Tore:** Wie die Tore aufgehen, hängt an der Geschichte (siehe Ideen: Tiere befreien). Bis dahin bleiben sie zu.

### Lichtung

Große, freie Wiese (gut 160 × 136 Felder) mit sanften Hügeln, Teichen, einzelnen Bäumen, Blumenwiesen und Klettersteinen, ringsum Felsen als feste Grenze. In der Mitte das Bett, im Kreis darum die Portal-Plattformen der acht Welten. Zwölf Tiere: Hase, Igel, Schaf, Eichhörnchen, Ente, Kuh, Fuchs, Frosch, Biene, Schildkröte, Bär, Zicklein. Tag und Nacht, Schmetterlinge, nachts Glühwürmchen.

### Eiswelt

- **Spielbar:** Hinter dem Eistor führt der Gang in ein langes Gletschertal (den Gletscherkessel, etwa 88 × 160 Felder, gut 10.000 Felder Boden, zwei Drittel der Lichtung, gemessen in Schritten aber so weit wie sie), fest am Ende des Gangs, ringsum hohe Eisklippen mit Schnee obenauf (sie antworten wie Felsen mit Wackeln und „boing“). Das Tal läuft vom Tor weg nach hinten, es gibt nur vor und zurück, die Wände führen; es bleibt weit weg von den Gängen der anderen Tore. Der Gang ist der einzige Weg hinein. Gleich vorn, etwa 30 Felder hinter der Mündung, das Schneebett (so ist das Kind vom Tor aus schnell zu Hause), darum die Schneewiese mit einer Futterschale aus Eis (links vor dem Bett) und einem Wassertrog aus Eisblöcken (rechts), dahinter ein großes Iglu als Unterstand: vorn ein weiter Bogen, durch den man hineinsieht, hinten eine feste Wand; vor der Figur wird die Kuppel durchsichtig. Seitlich liegt ein kleiner zugefrorener See mit einem Eisloch zum Wasserschöpfen. Links vorn neben dem Schneebett steht ein Klangstein mit der zweiten Fassung der Eis-Geschichte. Ringsum Winterlandschaft wie draußen in der Eiswelt: Schneehügel in drei Stufen (nie mehr als eine Stufe auf einmal), am Rand verschneite Tannen in lockeren Hainen (in jedem Kessel mindestens vier) und hier und da ein Eisblock zum Hinaufklettern (mindestens zwei), kühles Licht. Am Fuß der Eisklippen und oben auf den Hügeln wachsen kleine Büschel aus hellblauen, türkisen und kornblauen Eiskristallen (in jedem Tal mindestens zwölf, nie in den Farben der Höhle); man geht um jeden herum. Ab und zu blitzt einer auf. Auf der Karte sieht man die Kristalle in ihrer Farbe, die Schneewehen nicht (sie sind nur zum Anschauen). Hinter jeder Tanne, dort, wohin der Wind weht, liegt ein weiches Schneewehen, durch das man laufen kann. Bett, Iglu, Wege, Rutschspur, Plattformen, Eislöcher und Kisten bleiben frei. Weiter hinten im Tal glänzen zwei große zugefrorene Seen, über die man einfach laufen kann (nichts rutscht). In der Mitte jedes Sees ist ein dunkles Eisloch offen, darauf treiben weiße Eisschollen (in 2D schaukeln sie langsam hin und her, bei reduzierter Bewegung liegen sie still). An jedem Eisloch kann man Wasser schöpfen, so gibt es Wasser auch weit weg vom Bett. Am ersten großen See ragt ein hoher Eisberg auf: runde Stufen aus blauem Eis, auf die das Kind Stufe für Stufe klettern kann (nie mehr als eine Stufe auf einmal, oben auf Höhe 5, höher als jeder Hügel), oben weht eine bunte Fahne, auch wenn sonst kein Wind geht (bei reduzierter Bewegung steht sie still). Von oben schaut man weit über das Tal. Vom Hauptweg (geradeaus vom Bett bis ans Talende) führt ein Steg aus glattem Eis zu ihm hin, man findet ihn also, ohne zu suchen; ringsum liegt glattes Eis wie auf dem See. Eis und Wasser bleiben wenig (gut ein Zwanzigstel des Bodens), das Tal bleibt vor allem Schnee. Ganz hinten am Talende hängt ein riesiger gefrorener Wasserfall: eine glatte, tiefblaue Wand aus Eis, so hoch wie die höchsten Klippen, an ihrem Fuß ein gefrorenes Becken, über das man bis an die Wand laufen kann; davor steht die Plattform des Eis-Portals. Läuft das Tal vom Bildschirm weg nach oben, steht die blaue Wand groß hinter dem Becken; in anderen Tälern sieht man sie von der Seite über die Klippen ragen und das glänzende Becken davor. Auf der Karte sieht man Seen hellblau, Schollen weiß, den Eisberg und den Eisfall in ihrem Blau. Dahinter wartet das weite Tal im Nebel zum Entdecken, etwa fünf Dinge (Tannen, Eisblöcke, Kristalle, Schneewehen, Schneehaufen, Kisten) auf hundert Felder, dazwischen viel freier Schnee; das fernste Feld liegt gut 140 Schritte vom Bett. Vom Tor bis ans Bett glänzt die Rutschspur des Pinguins als Eisbahn, sobald das Tor offen ist; sie bleibt für immer und zeigt den Weg nach Hause. Solange das Tor zu ist, kommt man nicht hinein; vom Tor aus sieht man nur ein Stück des Gangs. Im Tal wohnen die zehn Eis-Tiere (unten), je fünf; im Tal und im Land der Eiswelt draußen laufen keine Tiere der Lichtung herum. Die Leiste unten zeigt immer die Tiere der Gegend, in der die Figur steht: auf der Lichtung wie bisher, im Kessel die Eis-Tiere.
- **Aussehen:** Schneefelder, glitzernde Eisblöcke zum Klettern, zugefrorene Seen, verschneite Tannen, Iglus. Kühles, helles Licht, sanfter Schneefall (nicht bei reduzierter Bewegung).
- **Besonderes:** Auf Eis rutscht die Figur nicht (das wäre für ein kleines Kind frustrierend), es knirscht nur beim Laufen.
- **Tiere:** zehn Arten, je fünf Tiere (50, so dicht wie auf der Lichtung; früher je drei: In alten Spielständen kommen die neuen von selbst wild im Tal dazu). Jede Art hat ihren Lieblingsort im Tal, dort ist das erste Tier jeden Tag zu finden (an einem neuen Morgen steht es ein paar Schritte woanders, aber immer dort): Robben und Walrosse an den großen Seen, der Papageitaucher am kleinen See, Rentiere und Moschusochsen bei den Tannen, die Schneeeule in den Tannen hinten, Polarfuchs und Lemming zwischen Eisblöcken, das Eisbärkind hinten am Eisfall, der Pinguin am Iglu. Die anderen laufen verteilt durch das ganze Tal; überall gibt es etwas zu entdecken. Alle Töne in der Pentatonik, von tief bis hoch, damit man jedes Tier am Ton erkennt. Der Schneehase fehlt mit Absicht: Er sähe aus wie der Hase der Lichtung.
- **Fußspuren im Schnee:** Wo das Kind im Tal läuft, bleiben hinter der Figur kleine Stiefelabdrücke im Schnee, und jedes Tier hinterlässt seine eigene Spur: Pinguin-Füßchen wie ein Dreizack, Tatzen beim Eisbärkind, Hufe bei Rentier und Moschusochse, die Hoppelspur des Polarfuchses, winzige Trippelspuren von Lemming und Papageitaucher, die breite Rutschspur mit Flossen von Robbe und Walross, feine Krallen der Schneeeule. Die Spuren verwehen langsam (nach gut einer halben Minute sind sie weg), beim Pustewind und bei Schneefall schneller. Läuft eine ganze Kette hinter der Figur, treten die Tiere in dieselben Felder; auf jedem bleiben höchstens zwei Abdrücke, so wird es nie dunkel. Am Nebelrand liegen keine Spuren. Sie sind klein und blaugrau wie Schatten im Schnee, nie golden und nie wie ein Weg: Sie versprechen nichts, sie erzählen nur, wer hier war. Nur Bild, nichts davon wird gespeichert. Bei reduzierter Bewegung verblassen sie nicht, sondern verschwinden in drei Stufen. Dieselben Spuren lassen sich später im Sand wiederverwenden.
- **Schneemänner bauen:** Hier und da liegen im Tal kleine Schneehaufen, jeder für sich mit freiem Schnee ringsum (nie auf Wegen, der Rutschspur, Plattformen oder der Schneewiese, etwa ein Dutzend weit verstreut). Läuft das Kind hinein, wächst eine Schneekugel heraus, es ploppt fröhlich, die Figur hüpft, Schnee stiebt, und die Tiere ringsum drehen sich um und schauen zu. Beim zweiten Mal sitzt eine zweite Kugel darauf, beim dritten Mal steht ein Schneemann da: Kopf mit Kohleaugen und Möhrennase, Knöpfe, roter Schal und blaue Wollmütze mit Bommel, dazu eine kleine Melodie. Das Kind sieht sofort, dass sein Hineinlaufen etwas Bleibendes baut. Es gibt keinen Fehler und kein Ende: Ein fertiger Schneemann bleibt einfach stehen (man stößt sanft an wie an einen Busch), und gebaute Schneemänner sind auch nach dem Neuladen noch da, halbe ebenso. Nichts schmilzt, und ein Schneemann versperrt nie einen Weg. In 2D wackelt eine frisch gewachsene Kugel kurz, bei reduzierter Bewegung nicht. So wird das weite Tal nach und nach zu einem Tal voller selbstgebauter Schneemänner. Das gibt es nur im Schnee und nicht auf der Lichtung.
- **Eiszapfen-Glockenspiel:** Am Fuß einer Klippe hängen fünf bis sieben Eiszapfen nebeneinander, links der längste, rechts der kürzeste. Läuft das Kind auf einen zu, klingt ein heller Glockenton, große tief und kleine hoch, es glitzert kurz, und in 2D schwingt der Zapfen ein wenig. Die Figur bleibt dabei nicht stehen: Wer die Reihe entlangläuft, spielt eine kleine Tonleiter, zurück rückwärts, und mit Hin und Her eine eigene Melodie. Wer vor einem Zapfen gegen die Wand drückt, läutet ihn noch einmal (statt des Fels-Wackelns), gehalten im Takt. Durch die Zapfen läuft niemand hindurch. Meist hängen sie am Rand des Tals; wo dort kein Platz ist (etwa jedes dritte Tal), an einer kleinen Hügelstufe. Alle Töne stammen aus der Pentatonik, es gibt keinen falschen Ton, aber sofort Musik. Der Klangstein erzählt eine Geschichte, das Glockenspiel ist reines Spielen, und es ist ein Grund, bis an den Rand des großen Tals zu laufen. Nichts wird gezählt oder gespeichert, nichts geht kaputt. Bei reduzierter Bewegung schwingt nichts, es bleiben Ton und ein kurzes, stilles Glitzern. Das gibt es nur im Eis und nicht auf der Lichtung.

  | Tier | Merkmal | Ton | Gangart |
  | --- | --- | --- | --- |
  | Pinguin | aufrecht, schwarzer Rücken, weißer Bauch, gelb-orange Ohrflecken, oranger Schnabel und Füße | fröhliches Tröten, aufwärts (G–A) | watschelt |
  | Eisbärkind | das größte Tier: rund und cremeweiß, kleine runde Ohren, schwarze Nase | tiefes, freundliches Brummen (C–D tief) | normaler Hüpfer |
  | Robbe | grauer Seehund, liegt flach, dunkle Tupfen, weiße Barthaare, große Kulleraugen | kurzes, hohes Bellen (zweimal E) | robbt |
  | Schneeeule | rund und weiß mit schwarzen Tupfen, große gelbe Augen | weiches Huhu (G, dann E) | flattert kurz |
  | Walross | groß, braun-rosa, liegend, zwei lange weiße Stoßzähne, heller Schnauzbart | tiefes Grunzen (ein langes tiefes C) | robbt |
  | Rentier | braun auf hohen dunklen Beinen, weißer Hals, großes helles Geweih | kurzes Grunzen (D–C) | normaler Hüpfer |
  | Polarfuchs | schlank und bläulich-weiß, spitze Ohren, riesiger buschiger Schwanz mit grauer Spitze | helles Kläffen (A, dann C) | springt hoch |
  | Moschusochse | dunkles Zottelfell bis fast zum Boden, heller Sattel, Hörner nach unten gebogen | tiefes Muhen (tiefes G) | normaler Hüpfer |
  | Papageitaucher | klein, schwarz-weiß, weißes Gesicht, großer bunter Schnabel | schnelles Schnarren (E–G–E, hoch) | huscht |
  | Lemming | winzig, rund und goldbraun, schwarze Kappe, rosa Näschen (etwas größer gezeichnet) | Piepsen in schneller Folge (A–C–A–C) | huscht |
- **Futter der Eiswelt:** Statt der Beerenbüsche gibt es sechs **Fischkisten** aus Treibholz mit verschneitem Rand, voll silberblauer Fische, deren Schwanzflossen über den Rand stehen (in 2D zuckt ab und zu eine, in 3D wiegen sie sich leicht im Wind). Sie stehen einzeln mit freiem Platz ringsum. Drei sind nah am Zuhause, jede 8 bis 14 Felder von der Schneewiese: eine am Ende der Rutschspur nahe dem Tor, eine hinter dem Bett, eine nahe dem Eisloch. So läuft das Kind einen kleinen Weg wie zu den Büschen. Drei stehen weit hinten im Tal (links, rechts und ganz hinten vor dem Eis-Portal), ein Grund für den langen Weg. Die Regel bleibt dieselbe: hineinlaufen, tragen, hineinlaufen. Läuft die Figur in eine volle Kiste, macht es Platsch-Plopp und silberblaue Funken steigen auf, sie hüpft und bleibt stehen und trägt nun ein kleines Netz mit zwei Fischen in der linken Hand; Korb auf dem Rücken und Eimer in der rechten Hand bleiben frei, sie kann alles zugleich tragen. Die Kiste ist dann leer (nur Holz und etwas Schnee) und ein Hindernis wie ein abgeernteter Busch; nach 30 Sekunden liegen wieder Fische darin, auch nachts. Mit dem Netz in die **Eisschale** auf der Schneewiese: Die Fische rutschen hinein, das Netz ist leer, eine fröhliche Tonfolge, silberne und goldgelbe Funken, und alle Tiere der Schneewiese freuen sich. Die Fischfresser (Pinguin, Eisbärkind, Robbe, Schneeeule, Walross, Polarfuchs, Papageitaucher) schnappen zusätzlich kurz nach. Für Rentier, Moschusochse und Lemming liegt ein Büschel Moos am Rand der Schale (nur Bild), und irgendwo im Kessel gibt es einen grünen **Moosfleck** unter dem Schnee (nur Kulisse). Jeder Trog nimmt nur das Seine: Beeren nicht in die Eisschale, Fisch nicht in den Futtertrog. Wasser wie auf der Lichtung: an einem Eisloch schöpfen, im Wassertrog aus Eisblöcken leeren. Es freuen sich immer nur die Tiere der Wiese, auf der der Trog steht. Gold gibt es an Kiste und Schale nicht (wie an Busch und Trog).
- **Wetter der Eiswelt:** Der Kessel hat sein eigenes Wetter, alle paar Minuten ein neues, jeder Tag beginnt mit Sonne: Sonne (die Hälfte der Zeit), leiser Schneefall (Flocken fallen senkrecht und langsam, der Himmel bleibt hell) und **Pustewind** statt Regen, nie Regen. Der Pustewind kommt erst, wenn der Pinguin auf der Schneewiese wohnt, und frühestens nach dem nächsten Schlafen, damit nichts seine Ankunft stört; dann etwa alle 20 Minuten für 5 Minuten. Es weht eine leichte Brise, und etwa alle halbe Minute kommt eine Böe von 6 bis 10 Sekunden. Der Himmel bleibt hell und blau, höchstens leicht milchig, nie dunkel. Schneeflocken fliegen in Wellen waagerecht über das Bild (bei einer Böe dichter und schneller), über die Ebene tanzen ein, zwei kleine Schneewirbel, von den Kanten der Eisklippen wehen feine Pulverfahnen, und auf dem Iglu flattert ein bunter Wimpel. Man hört ein weiches Rauschen („fuuu“), leiser als die Spieltöne, das bei Böen leicht anschwillt und nie heult oder pfeift; an der Spitze jeder Böe klingelt ein kleines Windspiel aus Eiszapfen. Die Tiere der Schneewiese gehen ins Iglu, wie beim Regen unter den Riesenpilz: jedes an einen eigenen Platz, vorn zuerst; die Pinguine kuscheln sich eng aneinander, die Schneeeule plustert sich rund auf, das Eisbärkind rollt sich ein, die Moschusochsen stehen dicht beieinander; wer keinen Platz mehr findet, steht dicht an der windgeschützten Seite daneben. Hört der Wind auf, gehen alle zurück an ihre Plätze. Die Figur läuft ganz normal, der Wind schiebt sie nie und nichts rutscht; bei einer Böe dreht sie nur kurz den Kopf zur Seite und lacht leise. Nach dem Wind steht anderthalb Minuten Glitzerluft im Kessel, funkelnder Diamantstaub wie der Regenbogen nach dem Regen. Kein Gewitter, keine Dunkelheit, kein Wackeln der Kamera, nichts geht kaputt. Schritte auf Schnee und Eis knirschen im Kessel (auf der Lichtung klingen sie wie immer, auch auf Schnee). Nachts ist es still, und wenn die Figur im Schneebett schläft, leuchtet ein Polarlicht, die Eiskristalle leuchten sanft mit, und eine Schneeeule sitzt oben auf dem Iglu. Bei reduzierter Bewegung: keine fliegenden Flocken, keine Wirbel, keine Fahnen, kein Glitzern; der Wimpel steht still waagerecht und zeigt so, dass Wind ist; die Kristalle leuchten beim Polarlicht ruhig, ohne zu pulsieren, und blitzen nicht auf. Die Tiere gehen trotzdem ins Iglu, Rauschen und Windspiel bleiben, aber leise. Die Lichtung behält ihr Wetter genau wie bisher, und jede Wiese folgt nur dem Wetter ihrer Welt.

  Für die Eltern-Geschichte: „Huiii, der Pustewind spielt Fangen mit den Schneeflocken! Die Tiere kuscheln sich ins Iglu. Gleich ist er wieder weg.“
- **Eis-Portal:** Die Eiswelt hat ihr eigenes Portal-Paar mit der Eisscholle und der Schneeflocke: eine Plattform ganz hinten am Talende (früher gleich hinter der Mündung; seit das Bett vorn liegt, ist sie dort der Heimweg nach dem langen Weg) und ihr Gegenstück im Kreis um das Schneebett, in Richtung des Tors (um dieses Gegenstück macht die Rutschspur einen kleinen Bogen). Anders als auf der Lichtung erwacht es nicht, wenn das Kind in die Nähe kommt, sondern erst, wenn es zum ersten Mal am Schneebett ankommt (höchstens zwei Felder davor): Dann erwachen beide Plattformen mit Klang und Gold, und von da an bringt das Portal vom Talende mit einem Glitzern sofort ans Iglu und wieder zurück. Ein Portal verbindet immer nur Tor und Bett derselben Welt; in eine andere Welt kommt man nur zu Fuß durch das Tor. Folgende Tiere reisen mit, auch der Pinguin, wenn er dem Kind auf der Lichtung folgt. Das Portal wird wie die anderen gespeichert; alte Spielstände behalten es wach.
- **Weltgrenze am Tor:** Jedes Tier gehört zu seiner Welt und zu seinem Bett. Geht das Kind mit Tieren der Lichtung durch das offene Eistor, bleiben sie am Tor: Sobald die Figur das erste Torfeld betritt, lösen sich alle Tiere der Lichtung aus der Kette, auch die hinteren. Sie drehen sich zur Figur, machen ihren normalen Ton, zeigen ein rosa Herz und setzen sich nebeneinander auf feste Warteplätze in der Bucht vor dem Tor, neben dem Weg, sodass Tor, Portal und Klangstein frei bleiben. Über jedem wartenden Tier zeigt ein kleiner Pfeil zum Tor: Dort ist das Kind hingegangen. Eis-Tiere in der Kette folgen weiter und rücken auf. In der Gegenrichtung genauso: Eis-Tiere warten im Kessel vor der Gangmündung. Kommt das Kind zurück, hüpfen die Wartenden vor Freude und reihen sich wieder ein. Kein Ablauf nach Zeit, kein fallender Abschiedston: Sie warten, bis das Kind zurückkommt, und erst beim Schlafen gehen sie heim. Die Leiste unten zeigt die Welt, in der die Figur steht; ist das Eistor offen, steht links ihr Zeichen (grünes Blatt für die Lichtung, Schneeflocke für die Eiswelt). Genau in der Mitte des Gangs klappt die Leiste um, und es klingt eine Glocke: hoch beim Betreten der Eiswelt, tief beim Zurückkehren. Solange das Tor zu ist, sieht und hört man davon nichts.
- **Der Pinguin holt dich ab:** Ein kleiner Pinguin ist durch einen Spalt im Eistor auf die Lichtung gerutscht und kommt nicht mehr heim. Solange das Eistor zu ist, fehlt er im Kessel (einer der fünf Pinguine). Ist die Leiste der Lichtung voll, wohnt also von jeder Art mindestens ein Tier auf der Wiese (ein Ziel über viele Abende, unabhängig vom Alter; die Tiere der Landschaft zählen nicht), und ist die Figur in der Nähe des Betts, taucht er gut zwei Sekunden später 4 bis 6 Felder neben der Figur auf, in einer kleinen Schneewolke, und piept. Das Kind muss ihn nicht suchen: Er watschelt selbst zu ihm, hüpft und zeigt ein Herz. Dann führt er: Er watschelt zwei, drei Felder voraus Richtung Eistor, bleibt stehen, dreht sich um und piept (höchstens alle 4 Sekunden, damit es nicht nervt); kommt die Figur nah, läuft er die nächste Strecke. Läuft das Kind woandershin, ist das kein Fehler: Er watschelt hinterher, überholt es auf der Seite zum Tor und stellt sich wieder vor es, mit Blick zum Tor. Läuft es in ihn hinein, singt er und hüpft ein Feld voraus, oder er tauscht den Platz; er steht nie im Weg. Nach einer Reise mit einer Plattform taucht er wieder neben dem Kind auf. Nachts führt er nicht: Er setzt sich neben das Bett und schläft mit; am Morgen piept er zur Begrüßung und führt weiter. Solange er da ist, steht auf der Tür des Eistors sein Umriss mit einem Goldrahmen, der Rand der Torplatte davor pulsiert golden (bei „weniger Bewegung“ ruhig golden), auf der Leiste der Lichtung hat er einen Gast-Platz mit Schneeflocke, und der Pfeil der Karte zeigt aufs Eistor statt nach Hause. Gespeichert wird davon nichts: Ein alter Spielstand, in dem schon alle Tiere zu Hause sind, bekommt ihn beim nächsten Aufwachen. Bei reduzierter Bewegung erscheint er ohne Schneewolke und watschelt nicht, das Führen bleibt gleich.
- **Das Eistor geht auf:** In der Bucht vor der Tür stellt sich der Pinguin neben die Torplatte, schaut sie an und hüpft still alle zwei Sekunden: Hier drauf! Tritt das Kind auf die Platte (Klirren) und bleibt einen kurzen Moment stehen (0,4 Sekunden), geht das Tor für immer auf und wird sofort gespeichert. Nur Stehen zählt: Wer drüberläuft oder den Pfeil gedrückt hält, öffnet nichts (erst nach dem Loslassen zählt der Moment), und bis dahin laufen die Pfeile wie immer. Steht das Kind schon auf der Platte, wenn der Pinguin ankommt, geht es gleich auf. Niemand bleibt hängen: Bleibt das Kind acht Sekunden in der Bucht, ohne auf die Platte zu treten, hüpft der Pinguin selbst darauf, schaut es an und winkt (Herz); und wer gegen die Tür läuft, öffnet sie auch. Die Figur bleibt stehen wie bei jeder Begegnung, und das Ritual dauert etwa drei Sekunden, ohne Kamerafahrt: Der Pinguin watschelt vor die Tür und hüpft zweimal mit seinem Ton; die Eiszapfen am Torbogen leuchten nacheinander eisblau und spielen die Eis-Melodie, die das Kind vom Klangstein kennt, und sein Umriss auf der Tür füllt sich mit seinen Farben; dann schwingen die Türflügel nach innen auf, mit einem tiefen, weichen Rumms und einem hellen Akkord; ein kalter Atemzug weht Schneeflocken auf die Lichtung, und im verschneiten Gang glänzt die Rutschspur; zuletzt rutscht der Pinguin auf dem Bauch durch den Gang, dreht sich um, hüpft und zeigt ein rosa Herz. Während des Rituals lässt jede Pfeiltaste die Figur nur freundlich hüpfen; danach gibt der nächste Pfeil sie frei. Der Pinguin wartet hinter der Gangmündung. Betritt das Kind die Eiswelt (in der Mitte des Gangs), rutscht er voraus zum Schneebett (schneller, als das Kind läuft; läuft es in ihn hinein, rutscht er weiter oder tauscht den Platz) und zieht dort als erstes Tier ein, mit einer Funkenwolke in Eisblau; geht das Kind zurück, wartet er, wo er ist. Am Tag seiner Ankunft bleibt es windstill. Erst wenn er eingezogen ist und das Kind am Schneebett ankommt, erwacht das Eis-Portal. Nach dem Neuladen ist das Tor offen; wartet der Pinguin noch, steht er wieder hinter der Mündung, und wer im Schneebett geschlafen hat, wacht dort auf. Bei reduzierter Bewegung steht die Tür sofort offen, es gibt keine Funken und keinen Schnee in der Luft, der Pinguin rutscht nicht, sondern steht danach hinter dem Tor; alle Töne bleiben. Der Klangstein vor dem Tor erzählt jetzt die zweite Fassung der Eis-Geschichte.
- **Portal-Plattform:** Eisscholle mit Schneekante, Eisspitzen in den Ecken; Bild: Schneeflocke.

### Sandwelt

- **Aussehen:** Dünen in sanften Stufen, Kakteen, Palmen an einer kleinen Oase, Sandsteinfelsen, warmes Licht.
- **Besonderes:** Fußspuren im Sand, die langsam verwehen (reine Zierde; der Ringpuffer der Fußspuren im Schnee, `mitwachsen-tracks.ts`, ist dafür schon da).
- **Tiere (Ideen):** Kamel, Erdmännchen, Eidechse, Wüstenfuchs, Schildkröte aus der Oase.
- **Portal-Plattform:** Sandsteinstufe, Mini-Pyramiden mit glühender Spitze; Bild: Stufenpyramide.

### Wasserwelt

- **Aussehen:** Viele kleine Inseln und Strände, verbunden durch Stege, Brücken und Trittsteine; Seerosen, Boote am Ufer, ein Leuchtturm.
- **Besonderes:** Wasser bleibt nicht begehbar, die Wege führen darüber. Wellen und Glitzern, leises Plätschern.
- **Tiere (Ideen):** Fisch (springt aus dem Wasser), Krebs, Seestern, Möwe, Otter.
- **Portal-Plattform:** Brunnenrand mit Wellensteinen, Muscheln in den Ecken; Bild: Wassertropfen.

### Lavaberge

- **Aussehen:** Dunkle Felsen und Berge, dazwischen glühende Lavaflüsse, die warm leuchten, auch nachts. Höher als die anderen Welten, mit viel zum Klettern.
- **Besonderes:** Ganz ungefährlich: Die Figur kommt nicht in die Lava, die Lava leuchtet nur. Kein Feuer, kein Rauch, der Angst macht.
- **Tiere (Ideen):** Bergziege, Salamander, Murmeltier, Adler, Steinbock.
- **Portal-Plattform:** Glutstein: kühler Basalt mit Glutrissen vom Rand zur Mitte, runde Glutsteine; Bild: freundliche Flamme. Um das Gold liegt nur dunkler Basalt, sonst verschwimmt es mit der Glut.

### Wald

- **Aussehen:** Dichter, aber lichter Wald mit Eichen, Birken, Tannen und Herbstbäumen, Beerenbüsche, Farne, Pilze, kleine Teiche.
- **Tiere (Ideen):** Reh, Wildschwein, Eule, Dachs, Specht.
- **Portal-Plattform:** Baumstumpf mit Jahresringen, Moos und Farn in den Ecken; Bild: Blatt.

### Wolkenwelt

- **Aussehen:** Weiße Wolkeninseln in verschiedenen Höhen, dazwischen nur Himmel. Am Tor ein Regenbogen.
- **Besonderes:** Wenn man hineinkann, braucht es Wolkenbrücken zwischen den Inseln. Niemand fällt hinunter.
- **Tiere (Ideen):** Wolkenschaf, Vögel, Schmetterlinge, ein kleiner Drache (freundlich).
- **Portal-Plattform:** Wolkenkissen, Wolkenbällchen mit bunten Knöpfen; Bild: Regenbogen über einer Wolke.

### Pilzwald

- **Aussehen:** Lila Moos, Riesenpilze mit roten, blauen und orangen Hüten, viele kleine Pilze.
- **Tiere (Ideen):** Schnecke, Glühwürmchen, Igel, Maus.
- **Portal-Plattform:** Pilzteller mit lila Moos, Mini-Pilze in den Ecken; Bild: Fliegenpilz.

### Höhlenwelt

- **Aussehen:** Dunkle Steinblöcke, leuchtende Kristalle und Pilze als Lichtquellen, unterirdische Seen. Nie ganz dunkel: Es bleibt immer genug Licht, damit nichts unheimlich wirkt.
- **Tiere (Ideen):** Fledermaus, Maulwurf, Glühwürmchen, Höhlenmolch.
- **Portal-Plattform:** Kristallnest aus dunklem Stein, Kristallsäulen in den Ecken; Bild: Kristall-Raute (das Thema `hoehle` gibt es schon).

## Tiere

**Die Geschichte:** Die Tiere haben sich verlaufen und finden nicht mehr nach Hause. Verlorene Tiere tragen ein kleines Fragezeichen über dem Kopf. Das Kind findet sie, sie freuen sich (Ton, Hüpfer, Herz) und laufen mit ihm nach Hause auf die Wiese ums Bett. Dort fressen und trinken sie, wohnen und sind glücklich. Es geht ums Helfen, nicht ums Sammeln oder Einsperren.


1. Jedes Tier hat eine **Heimat-Gegend** und wandert dort langsam umher.
2. Steht die Figur direkt neben einem Tier, **bleibt es stehen** und schaut sie an.
3. **Aktion neben einem Tier:** Es hüpft und **singt seinen eigenen Ton** (alle aus derselben Pentatonik, klingt immer zusammen). Beim ersten Mal gilt es als **gefunden** und bekommt ein Herz. Danach **folgt** es der Figur im Gänsemarsch, bis es auf der Wiese ums Bett ankommt oder die Figur schläft. Über folgenden Tieren schwebt ein kleines Herz.
4. **Hineinlaufen in ein Tier** genügt (aus dem ersten Spieltest: die Leertaste war zu viel): Es singt, bekommt beim ersten Mal ein Herz und folgt. Läuft die Figur in ein Tier, das schon folgt, tauschen beide sofort den Platz. So kann die Figur immer umdrehen und bleibt nie eingeklemmt. Tiere auf der Wiese ums Bett machen Platz: Sie hüpfen zur Seite, und die Figur läuft weiter, auch wenn schon viele Tiere zu Hause sind. Ins Bett geht es genauso: hineinlaufen.
5. **Aktion neben einem folgenden Tier:** Es singt noch einmal, sonst ändert sich nichts.
6. **Zu Hause ankommen:** Kommt die Figur nah an die Wiese ums Bett (zwei Felder genügen), ziehen alle folgenden Tiere dieser Welt zugleich ein, auch die hinteren der Kette (Spieltest: Jedes Tier einzeln über den Rand dauerte bei einer langen Kette lange und war für das Kind nicht klar). Jedes ruft kurz nach dem vorigen seinen Ton, freut sich und läuft selbst zu seinem eigenen Platz auf der Wiese. Dort bleibt es, auch nach dem Schlafen, und folgt nicht mehr (erster Spieltest: nach dem Schlafen waren alle Tiere weg). Läuft man hinein, singt es.
7. **Schläft die Figur**, laufen folgende Tiere in ihre Heimat-Gegend zurück.
8. **Tiere der berechneten Landschaft:** Sie zählen für kein Tor, singen aber, folgen und dürfen mit auf die Wiese. Ihre Kennung ergibt sich aus Seed, Stück und Nummer und bleibt dadurch stabil.
9. **Wechselnde Plätze:** Bei jedem Besuch und an jedem neuen Morgen sind die noch verlorenen Tiere woanders auf der Lichtung unterwegs. So gibt es jeden Tag etwas zu suchen.
10. Positionen werden nicht gespeichert, nur „gefunden“ und „zu Hause“. Ein Tier auf der Wiese erscheint nicht mehr in seiner Heimat-Gegend.

## Bett, Nacht und die Wiese

- **Stimmung der Richtungen:** Geht man in Richtung eines Tors, bekommt die Lichtung nah am Felsring eine leise Ahnung seiner Welt (die eigentliche Welt beginnt erst hinter dem Tor): Richtung Eistor Schnee und kühles Licht (dort schneit es statt zu regnen), Richtung Wald Herbstbäume, Richtung Wasser Blütenbäume, Richtung Sand gelbes Gras und warmes Licht, Richtung Lava trockenes Gras, Richtung Höhle Steine und Dämmerlicht, Richtung Pilzwald lila Moos. Dazu Leben in der Luft: Herbstblätter wehen, Funken glimmen, Sporen schweben, Glühwürmchen leuchten, Richtung Wolkenwelt ziehen Wolkenschatten und es ist windig. Überall weht eine leichte Brise, das Gras wiegt sich. Am Bett bleibt alles, wie es ist.
- **Wetter:** Alle paar Minuten wechselt es zwischen Sonne, Wolken und sanftem Regen, nach dem Regen kommt ein Regenbogen. Kein Gewitter, nichts Unheimliches. Jeder Tag beginnt mit Sonne. Die Eiswelt hat ihr eigenes Wetter mit Schneefall und Pustewind (siehe Eiswelt).
- **Unterstand:** Auf der Wiese steht ein Riesenpilz, ein Fliegenpilz mit rotem Hut und weißen Tupfen. Regnet es, laufen die Tiere darunter und drängen sich zusammen; scheint die Sonne wieder, gehen sie zurück an ihre Plätze.
- **Die Wiese wächst:** Jedes Schlafen ist ein neuer Tag. Mit jedem Tag blühen mehr Blumen auf der Lichtung, und Pilze sprießen. So sieht dein Kind, dass Zeit vergeht.
- **Wiese ums Bett:** offen, ohne Zaun, mit Futtertrog (Heu und Möhren) und Wassertrog. Hier wohnen die gefundenen Tiere.
- **Bett:** Ins Bett laufen → die Figur legt sich hin (direkt nach dem Aufwachen noch nicht, damit sie nicht aus Versehen wieder einschläft), der Himmel wird dunkel, Sterne gehen auf, eine leise Melodie spielt, es wird gespeichert.
- **Aufwachen:** Nach dem Einschlafen reagiert das Spiel einige Sekunden nicht auf Tasten, damit wildes Drücken die Runde nicht sofort weiterführt. Danach bringt ein Tastendruck den Morgen.
- **Start einer Runde:** Die Figur schläft im Bett, ein Tastendruck weckt sie. Dieser erste Druck schaltet auch den Ton frei (Autoplay-Regeln).

## Klangsteine und Geschichten

Das Kind kann noch nicht lesen, darum erzählen die Geschichten Klangsteine. Ein **Klangstein** ist ein kleiner Steinblock, über dem eine goldene Note schwebt (Gold heißt auf der ganzen Seite: hier kannst du etwas tun). Einer steht links vorn neben dem Bett, einer vor jedem großen Tor, gegenüber der Portal-Plattform vor dem anderen Turm, und einer im Gletscherkessel links vorn neben dem Schneebett.

- **Hineinlaufen** spielt die Geschichte des Ortes, wie alles andere im Spiel ohne Leertaste. Noch einmal hineinlaufen hält sie an, ein anderer Stein löst den vorigen ab. Nichts spielt von selbst.
- **Zuhören:** Solange die Figur stehen bleibt, sitzt sie am Stein, Noten steigen auf, und Tiere in der Nähe drehen sich zu ihr um und bleiben eine Weile stehen. Geht sie los, läuft die Geschichte weiter. Menü, Schlafen oder ein Wechsel des Tabs halten sie an.
- **Neu oder schon gehört:** Die Note einer noch nie gehörten Geschichte ist größer und pulsiert sanft; danach schwebt sie ruhig. So sieht das Kind ohne Text, wo es etwas Neues gibt. Was gehört ist, wird gespeichert.
- **Erst Musik, später die Stimme:** Jeder Ort hat eine kurze Melodie, die zu seiner Welt passt (am Bett ein Schlaflied, Eis hell und klirrend, Lava tief und brummend, in der Höhle mit Echo …), erzeugt im Browser wie alle Töne. Spricht der Vater einen Text ein, spielt die Melodie als Vorspiel und danach die Aufnahme. Fehlt eine Aufnahme, bleibt es bei der Melodie; so können die Texte nach und nach dazukommen.
- **Aufnahmen einbauen:** Datei als `public/games/mitwachsen/stimme/<id>.m4a` ablegen (AAC, mono, etwa 30 bis 40 Sekunden, auf gleiche Lautstärke gebracht) und in `src/data/games/mitwachsen-stories.ts` bei `voice` eintragen. Ein Test prüft, dass jede eingetragene Datei da ist. Geladen wird sie erst, wenn das Kind in den Stein läuft; die Startseite lädt nichts davon.
- **Die Texte** stehen in `src/data/games/mitwachsen-story-texts.ts` (das Spiel lädt sie nicht, es spielt nur Melodie und Aufnahme) und hier wortgleich zum Vorlesen und Einsprechen; ein Test hält beide gleich. Wer einen Text ändert, ändert beide Stellen. Sie sind in der Du-Form geschrieben, ohne Angst und ohne Druck. Mehrere sagen bewusst „wenn du ein bisschen größer bist“: Diese Tore gehen in späteren Altersstufen auf, das passt zu Mitwachsen. Das Eistor öffnet schon jetzt der Pinguin; seine Geschichte hat darum zwei Fassungen.

**Am Bett** (`bett`)

> Guten Morgen! Du bist auf der Lichtung aufgewacht, und da steht dein Bett. Gestern haben die Tiere Verstecken gespielt. Dabei sind sie so weit weggelaufen, dass sie den Weg nach Hause nicht mehr finden. Jetzt sitzen sie irgendwo und warten, dass jemand kommt. Wenn du eins siehst, lauf einfach zu ihm hin. Es freut sich so sehr, dass es mit dir mitkommt. Und hier bei deinem Bett gibt es Futter und frisches Wasser für alle.

**Tor zur Eiswelt** (`eis`, die erste Fassung, „Bis das Tor offen ist“; ist das Tor offen, erzählt der Stein vor dem Tor die zweite)

> Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Dort wohnt ein kleiner Pinguin, der den ganzen Tag auf dem Bauch übers Eis rutscht. Manchmal rutscht er bis ans Tor und schaut zu dir herüber. Noch ist das Tor zu. Aber wenn alle Tiere hier auf der Wiese zu Hause sind, kommt er vielleicht und zeigt dir den Weg.

**Am Schneebett** (`eis-offen`, Klangstein im Gletscherkessel links vorn neben dem Schneebett und, sobald das Tor offen ist, auch der Stein vor dem Eistor; die zweite Fassung der Eis-Geschichte, „Wenn das Tor offen ist“, mit derselben Melodie, die auch beim Öffnen erklingt)

> Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Jetzt ist das Tor offen, und der kleine Pinguin ist wieder zu Hause. Folge einfach seiner glänzenden Rutschspur, dann kommst du zum Iglu mit dem Schneebett. Dort warten das Eisbärkind, die Robbe und all die anderen Eis-Tiere schon auf dich. Und wenn der Pustewind kommt, kuscheln sich alle ins Iglu.

**Tor zur Sandwelt** (`sand`)

> Hinter diesem Tor liegt Sand, so weit du gucken kannst, ganz warm von der Sonne. Dort wohnt ein Kamel, das schon lange unterwegs ist und nicht mehr weiß, wo die Wasserstelle war. Hörst du, wie der Wind über die Sandhügel pfeift? Das Tor bleibt noch ein Weilchen zu. Irgendwann machen wir es auf und helfen dem Kamel beim Suchen.

**Tor zur Wasserwelt** (`wasser`)

> Hinter diesem Tor ist überall Wasser, mit kleinen Inseln dazwischen. Die Fische spielen dort gern Fangen, und eine Robbe klatscht dazu mit den Flossen. Wenn du ganz leise bist, kannst du die Wellen hören. Das Tor ist noch zu, aber die Robbe wartet schon auf dich.

**Tor zu den Lavabergen** (`lava`)

> Hinter diesem Tor sind hohe Berge, und ganz oben dampft es ein bisschen, so wie bei einem Kochtopf. Das sieht wilder aus, als es ist. Dort leben Salamander mit leuchtend orangen Punkten, die sich gern auf die warmen Steine legen und blinzeln. Wenn das Tor einmal aufgeht, bleiben wir auf den Wegen, dann kann gar nichts passieren.

**Tor zur Höhlenwelt** (`hoehle`)

> Hinter diesem Tor geht es unter die Erde, in eine große Höhle. Dunkel ist es dort aber nicht, denn an den Wänden wachsen Kristalle, die in allen Farben glitzern. Eine Fledermaus wohnt da. Sie schläft am Tag mit dem Kopf nach unten und wacht erst auf, wenn du ins Bett gehst. Vielleicht weckst du sie später einmal.

**Tor zum Wald** (`wald`)

> Hinter diesem Tor stehen so viele Bäume, dass die Sonne nur in kleinen Flecken bis auf den Boden kommt. Dort wohnen ein Reh und ein Specht, der den ganzen Tag an die Bäume klopft: tock, tock, tock. Das Tor ist noch zu. Aber der Specht klopft schon mal an, damit es bald aufgeht.

**Tor zur Wolkenwelt** (`wolken`)

> Hinter diesem Tor geht es hinauf bis zu den Wolken. Die sind dort so dick und weich, dass man darauf hüpfen kann wie auf einem Trampolin. Ein kleiner Drache fliegt da oben herum. Er ist ganz lieb und hat vor nichts Angst, nur vor Gewitter. Wenn du größer bist, darfst du mit ihm fliegen.

**Tor zum Pilzwald** (`pilze`)

> Hinter diesem Tor wachsen Pilze, so groß wie der bei deinem Bett, und nachts leuchten sie ein bisschen, blau und lila. Dort wohnen Schnecken, die ihr Haus immer mitnehmen und überhaupt keine Eile haben. Das Tor ist noch zu. Aber die Schnecken sagen, sie warten gern.

**Später:** Die Geschichte am Bett wächst mit. Sind alle Tiere der Lichtung zu Hause, erzählt der Stein eine zweite („Schau mal, alle sind wieder da …“) als Abschluss der Stufe ab 3. Die Tiere hinter den Toren in den Texten sind Vorschläge; kommen die Welten, sollen sie dazu passen.

## Welten und Menü

Eine **Welt** besteht aus Seed, Weltname, Figurenname und Fortschritt. Es kann mehrere Welten geben.

**Menü** über ein Zahnrad oben in der Ecke, nur per Maus. Das Spiel pausiert, solange es offen ist.

| Punkt | Wirkung | MVP |
| --- | --- | --- |
| Welt wählen | Kacheln mit Welt- und Figurennamen | ja |
| Neue Welt | mit zufälligem Seed | ja |
| Umbenennen | Weltname und Figurenname | ja |
| Welt-Code kopieren | nur der Seed: dieselbe Landschaft, Fortschritt von vorn. Verschicken ist nicht Teil der Umsetzung. | ja |
| Ton, Vollbild | an/aus | ja |
| Welt aus Code anlegen | Seed eingeben | später |
| Spielstand sichern / laden | Fortschritt als Datei (JSON), Schutz gegen gelöschte Browserdaten | später |
| Löschen | mit Rückfrage im Menü (zweiter Klick) | ja |
| Mini-Vorschau der Welt | auf der Kachel | später |

## Müde werden (Medienzeit)

Die S2k-Leitlinie der Kinder- und Jugendärzte rät für 3 bis 6 Jahre zu „höchstens 30 Minuten an einzelnen Tagen, und nicht ohne Anwesenheit der Eltern“ (unter 3 Jahren gar keine Bildschirmmedien). Das Spiel hilft beim Aufhören, ohne etwas wegzunehmen:

- Nach **15 und 20 Minuten** setzt sich die Figur kurz hin, gähnt, und eine Sprechblase sagt „Uaah … ich werde langsam müde.“ Bilder (Mond, Zzz) versteht das Kind selbst, den Satz lesen die Eltern vor.
- Ab 20 Minuten wird das Licht langsam golden wie am Abend.
- Nach **25 Minuten** sagt die Figur: „Ich bin müde. Bringst du mich ins Bett?“, danach alle paar Minuten wieder. Das Gute-Nacht-Bild am Bett ist das Ritual zum Aufhören.
- Gesperrt wird nichts. Wann Schluss ist, entscheiden die Eltern.
- **Wenn niemand spielt:** Nach 20 Sekunden ohne Taste setzt sich die Figur ins Gras und liest in einem Buch, nach 2 Minuten nickt sie ein. Jede Taste weckt sie. In der Zeit zählt die Spielzeit nicht.
- Ein **Hinweis für Eltern** mit den Empfehlungen und Quellen erscheint beim ersten Öffnen und ist im Menü und über die Bett-Sprechblase wieder zu öffnen.

Später (Mitwachsen): Zeiten im Menü einstellbar, wenn das Kind älter wird.

## Speichern

- **localStorage**, alle Schlüssel mit Präfix `larmic.games.`: ein Index der Welten und je Welt ein eigener Schlüssel, damit eine kaputte Welt nicht alle anderen mitreißt.
- **Format je Welt:** `{ v, game: 'mitwachsen', age, seed, worldName, figureName, openGates[], metAnimals[], homeAnimals[], portals[], position, visits, day, explored, heard[], packs }`; `packs` ist der Zustand der Welt-Pakete, jedes Paket liest seinen Eintrag selbst (Eis-Welt: wie weit jeder Schneehaufen gewachsen ist); ältere Spielstände ohne ihn laden mit lauter Haufen; `portals` sind die wachen Portale, die der Tore und das Eis-Portal (`eiskessel`). `age` ist die Altersstufe der Welt. Das Versionsfeld `v` hat eine getestete `migrate()`. Version 5 (Gletschertal): Was im alten kleinen Kessel erkundet war, liegt einmal wieder im Nebel, weil das Tal jetzt anders aussieht; die Figur wacht im neuen Schneebett auf, Eis-Tiere zu Hause stehen auf der mitgewanderten Schneewiese, wache Portale bleiben wach.
- **Zeitpunkte:** sofort bei jedem wichtigen Ereignis (Tier gefunden, Tor offen, Tier im Garten, schlafen, Welt gewechselt, Schneemann um eine Kugel gewachsen), zusätzlich alle 10 Sekunden die Position und beim Verlassen der Seite (`pagehide`, `visibilitychange`).
- Alle Zugriffe in `try/catch`. Speichert der Browser nicht (privates Fenster), läuft das Spiel trotzdem.
- Schlüssel und `game` bleiben auch bei einer Umbenennung der Reihe gleich oder werden in `migrate()` übernommen.

## Ton

Alles per WebAudio erzeugt; Audiodateien gibt es nur für eingesprochene Geschichten (siehe Klangsteine), und die lädt erst der Klangstein. Kurz, warm, leise, nie schrill: Schritt, Wand („boing“), jedes Tier ein eigener Ton, Freund-Melodie, Tor geht auf, Schlaflied, je Klangstein eine Melodie. Lautstärke und Zahl gleichzeitiger Stimmen sind begrenzt.

## Bewegung reduziert

Bei `prefers-reduced-motion`: Die Kamera springt feldweise mit, ohne Nachgleiten. Brücke und Tor stehen sofort offen. Nacht und Morgen kommen ohne Überblendung. An der Wand gibt es nur den Ton, kein Wackeln. Keine Partikel, Herzen stehen still. Töne und Wirkungen bleiben.

## Einbau in die Seite

Das Spiel lief zuerst auf larmic.de unter `/spiele/mitwachsen/` und hat jetzt eine eigene Seite: mitwachsen-spiele.de. Spielstände von larmic.de ziehen nicht mit (andere Domain, eigener Browser-Speicher).

- **`/`** ist die Seite für Eltern: für wen, warum es das Spiel gibt, worauf geachtet ist, ein Standbild, „Spiel starten“. Alle Texte stehen in `src/data/landing.ts`, die Eckdaten (Alter, Steuerung …) im Frontmatter von `src/content/games/mitwachsen.md`.
- **`/spielen/`** ist das Spiel selbst, ohne Zurück-Button; der Weg zur Startseite liegt im Menü für Eltern. `noindex`, nicht in der Sitemap.
- Dazu Datenschutz und eine 404-Seite. Impressum und Kontakt liegen auf larmic.de, das Impressum dort gilt auch für mitwachsen-spiele.de.

Fest:

- **Kein Seitenwechsel ohne Neuladen:** Die Seite nutzt keinen `ClientRouter`, jede Seite lädt neu. Tastatur-Listener greifen nur, solange die Spiel-Komponente im DOM und die Seite sichtbar ist. In `disconnectedCallback` werden Takt, Speichern und AudioContext gestoppt.
- **Ohne JavaScript:** Standbild und kurzer Text für Eltern.
- **Keine externen Ressourcen:** Töne per WebAudio, Schriften lokal, Kopieren über die Clipboard-API.
- **Datenschutz:** Spielstände liegen nur im localStorage dieses Browsers und werden nicht übertragen. Ein Absatz in der Datenschutzerklärung; nach unserem Verständnis braucht es dafür keinen Einwilligungs-Banner (vor Veröffentlichung prüfen).
- **Adressen:** Ändert sich eine Adresse, kommt die alte in die Redirects in `astro.config.mjs` und in `LEGACY` in `scripts/verify-dist.ts`.

### Aufbau im Code

Reine, getestete Logik getrennt von der Komponente, die zeichnet und Eingaben liest.

| Ort | Inhalt |
| --- | --- |
| `src/lib/games/` | Generischer Code ohne Node: Seed-Zufall, Rauschen, Stücke, Projektion von vorn. Bekommt Gegenden als Parameter und kennt keine Tiere. |
| `src/data/games/mitwachsen.ts` | Gegenden, Tiere mit Ton, Tore, Lage ums Zuhause. Importiert nur aus `src/lib/games/` und `textures.ts`. |
| `src/scripts/games/mitwachsen-state.ts` | Reine Zustandsmaschine mit Tests |
| `src/scripts/games/mitwachsen-save.ts` | Speichern und `migrate()` mit Tests |
| `src/scripts/games/larmic-mitwachsen.ts` | Web Component: Canvas, Eingabe, WebAudio |

**Architekturregel:** Browser-Code darf aus `src/lib` nur `textures.ts` (reine Daten) und `src/lib/games/**` nutzen. `cube.ts`, `render.ts`, `blocks.ts` und `icon.ts` bleiben Build-Code: Sie zeichnen die Würfel der Seiten und ziehen Node-Code nach sich. `src/data/games/**` darf nur browser-taugliche Module aus `src/lib` importieren.

## Stufen

1. **Konzept** (dieses Dokument).
2. **MVP ohne Texte**, damals auf larmic.de unter `/spiele/mitwachsen/`, über alle Gates und mit Deploy. Bis Stufe 2,5 nur über die direkte Adresse erreichbar.
   - Enthalten: Ansicht von vorn mit mitlaufender Kamera, endlose Welt aus dem Seed, Zuhause mit Bett, Nacht und Garten, Heimweg-Pfeil, Klettern, Tiere treffen und folgen lassen. Gegenden: Zuhause, Blumenwiese hinter dem Gartentor, Teich hinter der Brücke, jeweils mit Bildtafel und Tor-Regel. Welten-Menü (MVP-Punkte), Speichern.
   - Nicht enthalten: Wald, Strand, Geschichten, Tor-Texte, Spielstand-Datei, Welt aus Code.
   - Dazu `docs/specs/mitwachsen.md` mit Ereignissen (`move`, `action`, `tick`, `sleep`, `wake`), Regeln und Invarianten. Jede Regel hat einen Test, z. B.: gleicher Seed ergibt gleiche Stücke, ein Tor öffnet genau dann, wenn alle Tiere seiner Gegend gefunden sind, jede Gegend ist vom Zuhause erreichbar, die Figur kann nicht eingeklemmt werden.
2,5. **MVP auf der Seite einbauen:** Seite für Eltern, Fallback ohne JavaScript, Datenschutz-Absatz.
3. **Geschichten** schreiben und nach und nach einbauen, dazu Tor-Texte und weitere Gegenden (Wald, Strand).

Gespielt wird direkt auf der Seite: Sobald eine Stufe spielbar ist, spielt der Vater sie mit seinem Sohn.

## Ideen für später

Nur gesammelt, noch nicht ausgeplant.

- **Welten hinter den Toren:** Alle acht sind oben unter „Die Welten“ beschrieben. Weitere Ideen: Blumenland, Herbstwald, Strand mit Gezeiten.
- **Tiere befreien:** Später sollen die Tiere nicht nur entdeckt, sondern befreit werden. Daran hängt auch, wie sich die großen Tore öffnen (Vorschläge unten unter „Tore öffnen“). Die Geschichte dazu fehlt noch: Wovon werden die Tiere befreit, und warum? (Für ein kleines Kind freundlich, ohne Bösewicht, der Angst macht.)
- **Portale:** Als Plattformen umgesetzt (siehe „Portale als Plattform“ und Spec). Noch offen: Der Heimweg-Pfeil zeigt auf die Plattform, wenn der Weg darüber kürzer ist.
- **Gemeinsame Welt:** Für ein höheres Alter: Man schickt anderen einen Link und spielt zu zweit in derselben Welt, z. B. Elternteil und Kind oder Kind und Freund. Braucht mehr als GitHub Pages (Verbindung zwischen zwei Browsern oder ein kleiner Dienst) und eine eigene Datenschutzprüfung.

### Portale als Plattform (Notiz vom 17.11.2026, umgesetzt am 17.11.2026)

**Umgesetzt** wie unten abgestimmt (Regeln und Tests: Spec, Regel 9a). Abweichungen und Entscheidungen bei der Umsetzung:

- „Zwei Felder heran“ zählt vom Rand der Plattform (Abstand zur Mitte höchstens drei Felder, auch schräg).
- Die Plattform am Tor steht eine Reihe weiter vor dem Tor als das alte Portal (Mitte drei Reihen vor der Torreihe), damit sie ringsum frei ist und man auch von der Torseite aufsteigen kann; Felsen des unregelmäßigen Felsrands weichen dafür. Ein Feld weiter steht kein Baum, dessen Krone sie verdeckte.
- Die Ecken bleiben fest, auch beim schlafenden leeren Sockel am Bett. Damit man das sieht, trägt er in jeder Ecke einen grauen Eckstein, bei allen Welten gleich (verrät nichts).
- Liegen zwei Gegenstücke nach dem Runden zu nah (selten, etwa 1 von 300 Welten), nimmt eines die nächste andere Rundung; so berühren sie sich nie.
- Das Erwachen kommt in vier Helligkeitsstufen statt einer Welle von der Mitte nach außen; das Reisen nutzt den bisherigen Ton und die Funken (kein Schrumpfen der Figur). Das Nachtlicht der wachen Plattformen am Bett ist noch nicht umgesetzt.

Die heutigen Portale (drei Felder breit, Säulen und Krone, man läuft von vorn hinein) wirken nicht schön. Besser:

- **Eine flache Plattform**, die man **von allen Seiten** betreten kann, z. B. ein runder oder achteckiger Sockel im Material der Welt, mit leuchtendem Zeichen in der Mitte. Keine Vorder- und Rückseite, kein Rahmen, durch den man genau hindurch muss.
- **Aktivierung durch Nähertreten:** Kommt die Figur nah heran (z. B. ein, zwei Felder), erwacht die Plattform: Leuchten, Funken, Ton. Man muss sie dafür nicht betreten.
- **Danach auch zu Hause aktiv:** Mit der Aktivierung erscheint (oder erwacht) das Gegenstück im Startgebiet am Bett, wie heute. Von da an kann man hin- und herwechseln, folgende Tiere reisen mit.
- **Abgestimmt (17.11.2026):**
  - Gereist wird erst, wenn die Figur die **Mitte** betritt. Der Rand der Plattform ist nur Sockel.
  - **Zurückreisen** geht nur durch Raus und wieder Rein: Wer auf der Mitte ankommt, reist nicht sofort zurück, sondern muss die Mitte erst verlassen und dann wieder betreten.
  - Die **Gegenstücke am Bett** stehen dort, wo heute die Portale stehen (Ring um das Bett). Der Ring wächst dafür von Radius 8 auf **Radius 9**, damit sich die Plattformen nicht berühren.
  - **Aufwachen** auch schräg: Abstand 2 Felder in jede Richtung, aber nur, wenn das Feld schon aufgedeckt ist (kein Leuchten im Nebel).
  - **Keine Sperrzeit** nach der Ankunft: Raus und wieder Rein genügt.
  - **Schlafende Gegenstücke** am Bett sind ein **leerer Sockel**, der nicht verrät, zu welcher Welt er gehört. Erst beim Erwachen bekommt er Material, Deko und Bild seiner Welt.
- **Beispiele:** Voxel-Entwürfe für alle acht Welten (Vorlage der Umsetzung: `src/data/games/mitwachsen-portals.ts`) stehen im Artefakt „Portal-Plattformen“ (https://claude.ai/artifact/46NLTpHryPctPEyfJwUX5r), dort auch zum Ausprobieren.
- **Runde 2 (19.11.2026, umgesetzt):** Die festen Ecken waren für Kinder schwer: Die Figur blieb hängen, ohne dass man sah, warum. Jetzt sind alle neun Felder begehbar, die Zierde steht nur klein in der äußersten Spitze. Feineres Raster: 1 Voxel = 1/8 Feld (vorher 1/3), so groß wie ein Pixel der Bodentexturen. Nach der Ankunft goldene Pfeile in den Seitenfeldern; Gold immer mit dunkler Kante.
- **Auflösung im ganzen Spiel:** Vorschlag Stufe B: Alles Gebaute, mit dem das Kind etwas tut, auf 1/8 Feld; das Gelände bleibt aus ganzen Blöcken. Für die Plattformen umgesetzt (19.11.2026). Offen, ob Torhäuser, Bett, Tröge und Klangstein folgen. Stufe C (auch das Gelände fein) wäre viel mehr Flächen und unruhig für 3-Jährige.

### Tore je Welt verschieden (Notiz vom 17.11.2026)

**Umgesetzt am 20.11.2026** (siehe oben, „Jede Welt hat ihren eigenen Zugang“). Die Eingänge zu den Welten wirkten alle gleich (gleiches Torhaus, nur Schmuck und Farbe anders). Jede Welt soll einen ganz eigenen Eingang bekommen, an dem man schon von Weitem erkennt, wohin er führt:

- **Höhle:** ein Bergeingang, dunkle Öffnung im Fels, mit Kristallen am Rand.
- **Eis:** ein Durchgang zwischen Gletschern bzw. ein Bogen aus Eis.
- **Pilzwald:** ein Tor, das zwischen zwei großen Pilzen steht.
- Vorschläge für die übrigen (noch nicht abgestimmt): **Sand** ein Bogen aus Sandstein zwischen Dünen, an einer Oase; **Wasser** ein Steg, der aufs Wasser führt; **Lava** ein Felspass zwischen glühenden Bergen; **Wald** ein Durchgang zwischen zwei riesigen Bäumen, deren Kronen sich oben berühren; **Wolken** eine Wolkentreppe mit Regenbogen.

### Tore öffnen: Man sieht, was zu tun ist (Notiz vom 17.11.2026, für das Eistor umgesetzt am 20.11.2026)

**Für das Eistor umgesetzt** nach dem Konzept „Der Pinguin will nach Hause“ (siehe Eiswelt; Regeln und Tests: Spec, Regeln 8 und 8a, Abschnitt „Der Pinguin holt dich ab“). Anders als unten zuerst gedacht, sammelt das Kind den Pinguin nicht selbst ein: Sind alle Tiere der Lichtung zu Hause, kommt er von allein und führt zum Tor; das Tor zeigt seinen Umriss mit Goldrahmen, der Rand der Torplatte pulsiert golden, und auf der Platte geht es auf. Die anderen sieben Tore bleiben zu.

Das Kind kann nicht lesen, also muss am Tor selbst sichtbar sein, was fehlt. Jedes Tor bekommt eine eigene kleine Aufgabe, die mit dem arbeitet, was das Kind schon kann (Hineinlaufen, Tiere einsammeln, Dinge tragen). Der Klangstein am Tor kann zusätzlich einen Hinweis erzählen.

- **Eis:** Ein Pinguin ist aus der Eiswelt entkommen und läuft irgendwo auf der Lichtung herum. Man sammelt ihn wie die anderen Tiere ein, bringt ihn aber zum großen Tor statt zur Wiese; dann geht das Tor auf. (Passt zur Tor-Geschichte, in der der Pinguin schon vorkommt.)
- **Höhle:** Ein großer Stein liegt im Eingang. Man schiebt ihn weg, indem man hineinläuft.
- **Wasser:** Die Welt ist nur mit einem Boot zu betreten. Das Boot liegt irgendwo im Startgebiet; hat die Figur es einmal gefunden, legt sie es jedes Mal vor sich ins Wasser, wenn sie am Ufer ankommt, und fährt los. (Dann sind auch die Teiche der Lichtung befahrbar.)
- Vorschläge für die übrigen (noch nicht abgestimmt): **Sand** dem Kamel Wasser bringen (Eimer gibt es schon, passt zur Tor-Geschichte); **Pilzwald** Glühwürmchen zum Tor bringen, damit es leuchtet; **Wald** ein verirrtes Tier (z. B. Eichhörnchen) zurückbringen oder Beeren in einen Korb am Tor legen; **Lava** ein Murmeltier oder eine Bergziege nach Hause bringen; **Wolken** eine Wolkenbrücke aus „gesammelten“ Wolken.
- **Gemeinsam für alle:** Was zu tun ist, zeigt das Tor mit Bildern (Umriss des fehlenden Tiers oder Gegenstands, Gold für „hier kannst du etwas tun“). Nichts geht kaputt, nichts muss in einer Zeit geschafft werden. Welches Tor in welcher Altersstufe aufgeht, ist noch offen.

## Offen

- Werden die Berge später eine eigene Gegend?
- Wie viele Tiere laufen in der berechneten Landschaft?
- Aussehen der Figur (Haar- und Pullifarbe).
