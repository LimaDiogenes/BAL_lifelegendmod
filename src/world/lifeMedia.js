'use strict';
// Stockage local des images personnalisées de « Ma vie » (bannière, biens, sponsors) dans <careerDir>/life-media/.

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 4 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function detectImageExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function sanitizePrefix(prefix) {
  const clean = String(prefix || 'img').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return clean || 'img';
}

function saveLifeImage({ dir, prefix = 'img', dataUrl }) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl));
  if (!m) throw new Error('Image illisible.');
  const declaredExt = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new Error('Image trop lourde (4 Mo au plus).');
  const ext = detectImageExt(buf);
  if (!ext || ext !== declaredExt) throw new Error('Image illisible.');

  fs.mkdirSync(dir, { recursive: true });
  const name = `${sanitizePrefix(prefix)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return name;
}

function removeLifeImage(dir, file) {
  if (!dir || !file || typeof file !== 'string' || path.basename(file) !== file) return false;
  try {
    fs.rmSync(path.join(dir, file), { force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = { saveLifeImage, removeLifeImage, MAX_BYTES };
