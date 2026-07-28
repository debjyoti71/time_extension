import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediaDir = path.resolve(__dirname, '../media');

const svgFiles = [
  'tracking-engine.svg',
  'dashboard-sections.svg',
  'privacy-architecture.svg'
];

async function convert() {
  for (const file of svgFiles) {
    const svgPath = path.join(mediaDir, file);
    const pngName = file.replace(/\.svg$/, '.png');
    const pngPath = path.join(mediaDir, pngName);

    if (fs.existsSync(svgPath)) {
      await sharp(svgPath, { density: 300 })
        .png()
        .toFile(pngPath);
      console.log(`Converted ${file} -> ${pngName}`);
    }
  }
}

convert().catch(err => {
  console.error('Error converting SVGs to PNGs:', err);
  process.exit(1);
});
