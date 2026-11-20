// Titel und Texte der Geschichten von Mitwachsen, zum Einsprechen der Aufnahmen und zum Vorlesen. Das Spiel lädt sie
// nicht (es spielt nur Melodie und Aufnahme, mitwachsen-stories.ts), so bleibt die Spielseite schlank. Die Texte stehen
// auch in docs/games/mitwachsen.md (Abschnitt „Klangsteine und Geschichten“); ein Test hält beide gleich.

import type { StoryId } from './mitwachsen-stories';

export const STORY_TEXTS: Record<StoryId, { title: string; text: string }> = {
  bett: {
    title: 'Am Bett',
    text: 'Guten Morgen! Du bist auf der Lichtung aufgewacht, und da steht dein Bett. Gestern haben die Tiere Verstecken gespielt. Dabei sind sie so weit weggelaufen, dass sie den Weg nach Hause nicht mehr finden. Jetzt sitzen sie irgendwo und warten, dass jemand kommt. Wenn du eins siehst, lauf einfach zu ihm hin. Es freut sich so sehr, dass es mit dir mitkommt. Und hier bei deinem Bett gibt es Futter und frisches Wasser für alle.',
  },
  eis: {
    title: 'Tor zur Eiswelt',
    text: 'Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Dort wohnt ein kleiner Pinguin, der den ganzen Tag auf dem Bauch übers Eis rutscht. Manchmal rutscht er bis ans Tor und schaut zu dir herüber. Noch ist das Tor zu. Aber wenn du ein bisschen größer bist, geht es auf, und dann rutscht ihr zusammen.',
  },
  'eis-offen': {
    title: 'Am Schneebett',
    text: 'Hinter diesem Tor ist es so kalt, dass sogar das Wasser zu Eis wird. Jetzt ist das Tor offen, und der kleine Pinguin ist wieder zu Hause. Folge einfach seiner glänzenden Rutschspur, dann kommst du zum Iglu mit dem Schneebett. Dort warten das Eisbärkind, die Robbe und all die anderen Eis-Tiere schon auf dich. Und wenn der Pustewind kommt, kuscheln sich alle ins Iglu.',
  },
  sand: {
    title: 'Tor zur Sandwelt',
    text: 'Hinter diesem Tor liegt Sand, so weit du gucken kannst, ganz warm von der Sonne. Dort wohnt ein Kamel, das schon lange unterwegs ist und nicht mehr weiß, wo die Wasserstelle war. Hörst du, wie der Wind über die Sandhügel pfeift? Das Tor bleibt noch ein Weilchen zu. Irgendwann machen wir es auf und helfen dem Kamel beim Suchen.',
  },
  wasser: {
    title: 'Tor zur Wasserwelt',
    text: 'Hinter diesem Tor ist überall Wasser, mit kleinen Inseln dazwischen. Die Fische spielen dort gern Fangen, und eine Robbe klatscht dazu mit den Flossen. Wenn du ganz leise bist, kannst du die Wellen hören. Das Tor ist noch zu, aber die Robbe wartet schon auf dich.',
  },
  lava: {
    title: 'Tor zu den Lavabergen',
    text: 'Hinter diesem Tor sind hohe Berge, und ganz oben dampft es ein bisschen, so wie bei einem Kochtopf. Das sieht wilder aus, als es ist. Dort leben Salamander mit leuchtend orangen Punkten, die sich gern auf die warmen Steine legen und blinzeln. Wenn das Tor einmal aufgeht, bleiben wir auf den Wegen, dann kann gar nichts passieren.',
  },
  hoehle: {
    title: 'Tor zur Höhlenwelt',
    text: 'Hinter diesem Tor geht es unter die Erde, in eine große Höhle. Dunkel ist es dort aber nicht, denn an den Wänden wachsen Kristalle, die in allen Farben glitzern. Eine Fledermaus wohnt da. Sie schläft am Tag mit dem Kopf nach unten und wacht erst auf, wenn du ins Bett gehst. Vielleicht weckst du sie später einmal.',
  },
  wald: {
    title: 'Tor zum Wald',
    text: 'Hinter diesem Tor stehen so viele Bäume, dass die Sonne nur in kleinen Flecken bis auf den Boden kommt. Dort wohnen ein Reh und ein Specht, der den ganzen Tag an die Bäume klopft: tock, tock, tock. Das Tor ist noch zu. Aber der Specht klopft schon mal an, damit es bald aufgeht.',
  },
  wolken: {
    title: 'Tor zur Wolkenwelt',
    text: 'Hinter diesem Tor geht es hinauf bis zu den Wolken. Die sind dort so dick und weich, dass man darauf hüpfen kann wie auf einem Trampolin. Ein kleiner Drache fliegt da oben herum. Er ist ganz lieb und hat vor nichts Angst, nur vor Gewitter. Wenn du größer bist, darfst du mit ihm fliegen.',
  },
  pilze: {
    title: 'Tor zum Pilzwald',
    text: 'Hinter diesem Tor wachsen Pilze, so groß wie der bei deinem Bett, und nachts leuchten sie ein bisschen, blau und lila. Dort wohnen Schnecken, die ihr Haus immer mitnehmen und überhaupt keine Eile haben. Das Tor ist noch zu. Aber die Schnecken sagen, sie warten gern.',
  },
};
