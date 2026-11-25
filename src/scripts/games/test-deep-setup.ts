// Nur im tiefen Lauf (vitest.config.ts, `setupFiles`): Nach jeder Datei vergisst der Worker die gebauten Welten bis auf
// die zuletzt gebrauchten, wenn der Speicher reicht. Die Module (Pakete, Modelle) teilt er über alle seine Dateien
// (`isolate` aus), die Welten nur so weit: Alle füllten den Speicher. Die Dateien laufen nach Ordnern sortiert
// (`ByFolder` in vitest.config.ts), so findet etwa jede Datei der Grotte die Welten der Seeds 1 bis 20 schon gebaut.
import { afterAll } from 'vitest';
import { forgetWorlds } from './test-worlds';

/**
 * So viele Welten je Sorte bleiben über das Ende einer Datei: die üblichen Seeds 1 bis 20 eines Eigenschafts-Tests samt
 * den gedrehten (26, 30) und etwas Luft
 */
const KEEP = 24;
/** Heap, unter dem der Worker Welten behält (`keepHeap` in vitest.config.ts; 0: Speicher reicht nicht, alle vergessen) */
const HEAP = Number(process.env.MITWACHSEN_KEEP_HEAP) || 0;

afterAll(() => forgetWorlds(process.memoryUsage().heapUsed < HEAP ? KEEP : 0));
