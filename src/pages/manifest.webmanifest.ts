// Web-App-Manifest: macht das Spiel installierbar („Zum Home-Bildschirm“), von der Startseite und vom Spiel aus.
// Inhalte in src/data/pwa.ts, Aufbau in src/lib/pwa/manifest.ts.
import { webManifest } from '../lib/pwa/manifest';
import { APP, APP_ICONS } from '../data/pwa';

export function GET() {
  return new Response(JSON.stringify(webManifest(APP, [...APP_ICONS]), null, 2), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
