// Nur im tiefen Lauf (vitest.config.ts, `setupFiles`): Nach jeder Datei vergisst der Worker die gebauten Welten. Die
// Module (Pakete, Modelle) teilt er über alle seine Dateien (`isolate` aus), die Welten nicht: Sie füllten den Speicher.
import { afterAll } from 'vitest';
import { forgetWorlds } from './test-worlds';

afterAll(forgetWorlds);
