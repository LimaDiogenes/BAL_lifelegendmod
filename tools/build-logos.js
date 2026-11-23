'use strict';
// Pack des logos des sponsors, publié à part de l'application (release GitHub « logos-v<N> ») et téléchargé depuis les
// Réglages (src/logoPack.js). Versionné à part : un nouveau pack ne demande pas une nouvelle version de l'application.
//   npm run logos   ->   dist\LifeLegend-sponsor-logos-v<N>.zip, et son SHA-256 à mettre dans src/logoPack.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const LOGOS_VERSION = 1;
const ROOT = path.join(__dirname, '..');
const SPONSORS = path.join(ROOT, 'lifelegend', 'media', 'sponsors');
const DIST = path.join(ROOT, 'dist');
const stage = path.join(DIST, `logos-v${LOGOS_VERSION}`);
const zip = path.join(DIST, `LifeLegend-sponsor-logos-v${LOGOS_VERSION}.zip`);

fs.mkdirSync(DIST, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(SPONSORS)) {
  if (!/\.(svg|png|jpe?g|webp|json)$/i.test(f)) continue;
  fs.copyFileSync(path.join(SPONSORS, f), path.join(stage, f));
  if (!f.endsWith('.json')) n++;
}
fs.rmSync(zip, { force: true });
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${path.join(stage, '*')}' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
console.log(`${zip}\n${n} logos, ${(fs.statSync(zip).size / 1048576).toFixed(1)} Mo\nSHA-256 ${sha}`);
