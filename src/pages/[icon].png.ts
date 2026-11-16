// PNG-Icons: das apple-touch-icon (180 × 180, mit Himmel als Hintergrund).
import { iconPng } from '../lib/voxel/icon';

const ICONS: Record<string, { size: number; background?: string }> = {
  'apple-touch-icon': { size: 180, background: '#8dd0ee' },
};

export function getStaticPaths() {
  return Object.keys(ICONS).map((icon) => ({ params: { icon } }));
}

export async function GET({ params }: { params: { icon: string } }) {
  const icon = ICONS[params.icon];
  if (!icon) return new Response(null, { status: 404 });
  const { size, background } = icon;
  return new Response(new Uint8Array(await iconPng(size, background)), { headers: { 'Content-Type': 'image/png' } });
}
