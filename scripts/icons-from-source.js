// Generates app icon assets from assets/source-logo*.png using sharp.
// sharp is NOT a project dependency (it must not ship to EAS), so install it
// only when regenerating:  npm i sharp --no-save  &&  node scripts/icons-from-source.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'assets');
const SRC = fs.existsSync(path.join(dir, 'source-logo.png.png'))
  ? path.join(dir, 'source-logo.png.png')
  : path.join(dir, 'source-logo.png');
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function main() {
  if (!fs.existsSync(SRC)) throw new Error('Missing source logo at ' + SRC);

  // 1) Main / iOS icon: full artwork at 1024 (iOS only rounds corners).
  await sharp(SRC).resize(1024, 1024, { fit: 'cover' }).png().toFile(path.join(dir, 'icon.png'));

  // 2) Android adaptive icon: shrink the art into the central safe zone on a
  //    black field so the launcher's circle/squircle mask never clips the
  //    rays or the left checkmark. 0.72 keeps even the leftmost ray inside.
  const inner = Math.round(1024 * 0.72);
  const art = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BLACK })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLACK } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(path.join(dir, 'adaptive-icon.png'));

  // 3) Splash logo: artwork at 512, centered on black by the splash plugin.
  await sharp(SRC).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(dir, 'splash-icon.png'));

  console.log('Wrote icon.png, adaptive-icon.png, splash-icon.png from', path.basename(SRC));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
