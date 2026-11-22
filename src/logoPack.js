'use strict';
// Logos des sponsors en téléchargement séparé (2.0, revue 2026-11-22) : les logos ne sont plus dans l'application ; le
// bouton des Réglages télécharge le pack (une archive .zip publiée avec la version), vérifie son SHA-256, l'extrait dans
// le dossier des données de l'utilisateur et l'application les lit de là. Sans pack, les monogrammes restent.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Adresse du pack publié avec la version (à téléverser dans la release GitHub de la 2.0.0).
const LOGO_PACK_URL = 'https://github.com/LimaDiogenes/BAL_lifelegendmod/releases/download/v2.0.0/LifeLegend-sponsor-logos-2.0.0.zip';
// SHA-256 du pack, affiché par « npm run dist » ; tant qu'il vaut PLACEHOLDER, la vérification est sautée (avertissement).
const LOGO_PACK_SHA256 = 'PLACEHOLDER';
const MAX_PACK_BYTES = 64 * 1024 * 1024;
const LOGO_FILE = /^[a-z0-9_-]+\.(svg|png|jpe?g|webp)$/i;

/** Lit les entrées d'une archive .zip (stockées ou « deflate ») : [{ name, data }]. Rien d'autre n'est accepté. */
function readZip(buf) {
  const eocdMin = 22;
  let eocd = -1;
  for (let i = buf.length - eocdMin; i >= Math.max(0, buf.length - eocdMin - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Archive .zip illisible.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Archive .zip illisible.');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;   // dossier
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Archive .zip illisible.');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compSize);
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) });
    else throw new Error(`Méthode de compression non prise en charge (${method}).`);
    if (data.length !== size) throw new Error('Archive .zip abîmée.');
    out.push({ name, data });
  }
  return out;
}

/** Nom de fichier sûr d'une entrée : seulement le nom (pas de dossier, pas de « .. ») et une extension d'image. */
function safeLogoName(entryName) {
  const parts = entryName.replace(/\\/g, '/').split('/');
  if (parts.some((p) => p === '..') || path.isAbsolute(entryName) || /^[a-z]:/i.test(entryName)) return null;
  const base = parts[parts.length - 1];
  if (base === 'manifest.json') return base;
  return LOGO_FILE.test(base) ? base : null;
}

/** Extrait le pack dans <dir> (remplacé en entier) ; renvoie le nombre de logos. */
function installPack(buf, dir, { sha256 = LOGO_PACK_SHA256, warn = () => {} } = {}) {
  if (buf.length > MAX_PACK_BYTES) throw new Error('Pack de logos trop gros.');
  if (sha256 === 'PLACEHOLDER') warn('SHA-256 du pack de logos non renseigné : vérification sautée.');
  else if (crypto.createHash('sha256').update(buf).digest('hex') !== sha256.toLowerCase()) throw new Error('Le pack de logos téléchargé ne correspond pas (SHA-256).');
  const entries = readZip(buf);
  const tmp = `${dir}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  let logos = 0;
  for (const e of entries) {
    const name = safeLogoName(e.name);
    if (!name) continue;
    fs.writeFileSync(path.join(tmp, name), e.data);
    if (name !== 'manifest.json') logos++;
  }
  if (logos === 0) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('Aucun logo dans ce pack.'); }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  return logos;
}

/** Logos d'un dossier : clé (nom sans extension, minuscules) → chemin complet. */
function listLogos(dir) {
  const map = {};
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = /^([a-z0-9_-]+)\.(svg|png|jpe?g|webp)$/i.exec(f);
      if (m) map[m[1].toLowerCase()] = path.join(dir, f);
    }
  } catch { /* dossier absent */ }
  return map;
}

/** Télécharge le pack (redirections suivies, https seulement), avec la progression 0..1. */
async function downloadPack(url = LOGO_PACK_URL, onProgress = () => {}) {
  if (!/^https:\/\//i.test(url)) throw new Error('Adresse du pack non sûre.');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (total > MAX_PACK_BYTES) throw new Error('Pack de logos trop gros.');
  const chunks = [];
  let done = 0;
  for await (const chunk of res.body) {
    chunks.push(Buffer.from(chunk));
    done += chunk.length;
    if (done > MAX_PACK_BYTES) throw new Error('Pack de logos trop gros.');
    if (total) onProgress(done / total);
  }
  return Buffer.concat(chunks);
}

module.exports = { LOGO_PACK_URL, LOGO_PACK_SHA256, readZip, safeLogoName, installPack, listLogos, downloadPack };
