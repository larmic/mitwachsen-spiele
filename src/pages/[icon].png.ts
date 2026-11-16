// PNG-Icons: das apple-touch-icon (180 × 180, mit Himmel als Hintergrund) und die Icons der App aus dem Manifest
// (src/data/pwa.ts), alle beim Build gerendert.
import { iconPng } from '../lib/voxel/icon';
import { APP_ICONS, ICON_FILL, SKY_2 } from '../data/pwa';

const ICONS: Record<string, { size: number; background?: string; fill?: number }> = {
  'apple-touch-icon': { size: 180, background: SKY_2 },
  ...Object.fromEntries(
    APP_ICONS.map((i) => [
      i.file.replace(/\.png$/, ''),
      { size: i.size, background: SKY_2, fill: ICON_FILL[i.purpose] },
    ]),
  ),
};

export function getStaticPaths() {
  return Object.keys(ICONS).map((icon) => ({ params: { icon } }));
}

export async function GET({ params }: { params: { icon: string } }) {
  const icon = ICONS[params.icon];
  if (!icon) return new Response(null, { status: 404 });
  const { size, background, fill } = icon;
  return new Response(new Uint8Array(await iconPng(size, background, fill)), {
    headers: { 'Content-Type': 'image/png' },
  });
}
