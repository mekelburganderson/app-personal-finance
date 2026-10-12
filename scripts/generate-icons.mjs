// Gera os ícones do PWA e do app a partir de assets/brand/*.svg.
// Uso: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = [
  ['assets/brand/logo.svg', 'public/icons/icon-192.png', 192],
  ['assets/brand/logo.svg', 'public/icons/icon-512.png', 512],
  ['assets/brand/logo-maskable.svg', 'public/icons/maskable-512.png', 512],
  ['assets/brand/logo-maskable.svg', 'public/icons/apple-touch-icon.png', 180],
  ['assets/brand/logo.svg', 'assets/favicon.png', 48],
  ['assets/brand/logo-maskable.svg', 'assets/icon.png', 1024],
];

mkdirSync('public/icons', { recursive: true });
for (const [src, dest, size] of out) {
  await sharp(src, { density: 600 }).resize(size, size).png().toFile(dest);
  console.log('✓', dest);
}
