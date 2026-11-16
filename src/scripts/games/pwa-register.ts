// Das Spiel als App: meldet den Service Worker an (nur hier, auf der Spielseite – die Startseite lädt kein JavaScript).
// Er speichert das Spiel, damit es auch ohne Netz startet. Eine neue Version wartet, bis das Spiel geschlossen ist;
// nichts wird neu geladen, nichts unterbricht das Kind. Fehler bleiben still, das Spiel läuft auch ohne.
// Als installierte App bittet die Seite still um dauerhaften Speicher (schützt die Spielstände); im Browser-Tab nicht,
// weil manche Browser dort nachfragen würden.
import { SERVICE_WORKER } from '../../data/pwa';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const start = () => {
    navigator.serviceWorker.register(SERVICE_WORKER.url, { scope: SERVICE_WORKER.scope }).catch(() => {});
    const installed =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) navigator.storage?.persist?.().catch(() => {});
  };
  // Erst nach dem Laden: Das Spiel startet zuerst
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}
