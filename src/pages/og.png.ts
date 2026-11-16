// Vorschaubild für Messenger & Co. (og:image, 1200 × 630): Himmel, Wolken und rechts die kleine Wiese mit Baum und
// Pilz, beim Build mit sharp in ein PNG gerendert.
import sharp from 'sharp';
import { MEADOW, cubeDefs, sceneSvg } from '../lib/voxel/blocks';

const W = 1200;
const H = 630;

export async function GET() {
  const scene = sceneSvg(MEADOW);
  const size = H - 90;
  const sceneBox = `<svg x="${W - size - 90}" y="45" width="${size}" height="${size}" viewBox="${scene.viewBox}">${scene.uses}</svg>`;
  const cloud = (x: number, y: number, w: number) =>
    `<g fill="#ffffff" opacity="0.92"><rect x="${x}" y="${y}" width="${w}" height="28"/><rect x="${x + w * 0.2}" y="${y - 22}" width="${w * 0.5}" height="22"/></g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${cubeDefs()}</defs>
<rect width="${W}" height="${H * 0.36}" fill="#79c7ea"/>
<rect y="${H * 0.36}" width="${W}" height="${H * 0.32}" fill="#8dd0ee"/>
<rect y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="#a6dbf2"/>
${cloud(60, 120, 180)}${cloud(330, 70, 220)}${cloud(150, 430, 140)}${cloud(1080, 560, 90)}
${sceneBox}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
