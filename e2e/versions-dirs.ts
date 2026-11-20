// Fassungen der Seite für den Browser-Test: 1 ist der Build, 2 leitet e2e/versions.ts daraus ab.
// Eigene Datei ohne Imports, damit der Test-Server (e2e/serve.ts, läuft direkt mit Node) sie lesen kann.
export const VERSIONS: Record<string, string> = { '1': 'dist', '2': '.e2e/v2' };

/** Die per import() nachgeladene 3D-Ansicht (Name mit Hash; Three.js liegt daneben in three.<hash>.js) */
export const CHUNK = /^\/?_astro\/mitwachsen-3d\.[\w-]+\.js$/;
