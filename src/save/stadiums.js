'use strict';
// Vignettes de stade lues dans Sider (stadium-server / livecpk) ou les archives CPK du jeu :
// common/render/thumbnail/stadium/st<id>.png|.dds (ou preview.png / thumbnail.png dans un pack stade Sider).

const fs = require('fs');
const path = require('path');
const { listCpk, readCpkEntry, unwrapWesys } = require('./cpk');
const { siderRoots } = require('./gameDb');
const { decodeDds } = require('./dds');
const { rgbaToPng } = require('./emblems');

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const STADIUM_THUMB_DIR = path.join('common', 'render', 'thumbnail', 'stadium');
const STADIUM_THUMB_RE = /(?:^|\/)common\/render\/thumbnail\/stadium\/st(\d+)(?:_l)?\.(dds|png)$/i;

const stadiumCode = (id) => `st${String(id).padStart(3, '0')}`;

// Analyse map_teams.txt de Sider stadium-server : "teamId, stadiumId, stadiumName, relativePath".
function parseStadiumMap(text) {
  const out = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const teamId = Number(parts[0].trim());
    const stadiumId = Number(parts[1].trim());
    const name = parts[2].trim();
    const relPath = parts.slice(3).join(',').trim().replace(/^["']|["']$/g, '');
    if (!Number.isFinite(teamId) || !Number.isFinite(stadiumId) || !relPath) continue;
    out.push({ teamId, stadiumId, name, relPath });
  }
  return out;
}

function findStadiumServerDir(gameDir) {
  if (!gameDir) return null;
  for (const cand of [
    path.join(gameDir, 'SiderAddons', 'content', 'stadium-server'),
    path.join(gameDir, 'content', 'stadium-server'),
  ]) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) return cand;
    } catch { /* dossier absent */ }
  }
  return null;
}

let cached = null;
function stadiumThumbIndex(gameDir) {
  if (cached?.gameDir === gameDir) return cached.map;
  const map = new Map();
  for (const sub of ['download', 'Data']) {
    let files = [];
    try { files = fs.readdirSync(path.join(gameDir, sub)).filter((f) => f.toLowerCase().endsWith('.cpk')).sort().reverse(); } catch { continue; }
    for (const f of files) {
      const full = path.join(gameDir, sub, f);
      let list = [];
      try { list = listCpk(full); } catch { continue; }
      for (const e of list) {
        const m = STADIUM_THUMB_RE.exec(e.name);
        if (!m) continue;
        const id = Number(m[1]);
        const ext = m[2].toLowerCase();
        // Priorité à l'archive la plus récente, puis au PNG ou format normal avant _l.
        const cur = map.get(id);
        if (!cur || (cur.file === full && ext === 'png' && cur.ext !== 'png')) {
          map.set(id, { file: full, entry: e, ext });
        }
      }
    }
  }
  cached = { gameDir, map };
  return map;
}

function decodeImageBuffer(buf, ext) {
  if (!buf || !buf.length) return null;
  const raw = unwrapWesys(buf);
  if (!raw || !raw.length) return null;
  if (ext === 'png' || (raw.length >= 8 && raw.subarray(0, 8).equals(PNG_MAGIC))) {
    return raw.subarray(0, 8).equals(PNG_MAGIC) ? raw : null;
  }
  try {
    const d = decodeDds(raw);
    if (!d) return null;
    return rgbaToPng(d.width, d.height, d.rgba);
  } catch {
    return null;
  }
}

function tryReadImageCandidates(candidates) {
  for (const { file, ext } of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const png = decodeImageBuffer(fs.readFileSync(file), ext);
      if (png) return png;
    } catch { /* fichier illisible */ }
  }
  return null;
}

function findMapEntry(serverDir, teamId, stadiumName) {
  if (!serverDir) return null;
  const mapFile = path.join(serverDir, 'map_teams.txt');
  if (!fs.existsSync(mapFile)) return null;
  let entries = [];
  try { entries = parseStadiumMap(fs.readFileSync(mapFile, 'utf8')); } catch { return null; }
  if (teamId != null) {
    const byTeam = entries.find((e) => e.teamId === Number(teamId));
    if (byTeam) return byTeam;
  }
  const wantedName = String(stadiumName || '').trim().toLowerCase();
  if (wantedName) {
    const byName = entries.find((e) => e.name.toLowerCase() === wantedName);
    if (byName) return byName;
  }
  return null;
}

function stadiumSlug(stadiumName) {
  return String(stadiumName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'home';
}

// Extrait une fois la vignette du stade du club vers outDir (<slug>.png). Retourne le nom du fichier ou null.
function ensureClubStadium({ gameDir, teamId = null, stadiumName = '', outDir }) {
  if (!gameDir || !outDir || (teamId == null && !stadiumName)) return null;
  const outName = teamId != null ? `club-${teamId}.png` : `name-${stadiumSlug(stadiumName)}.png`;
  const outPath = path.join(outDir, outName);
  if (fs.existsSync(outPath)) return outName;

  try {
    const serverDir = findStadiumServerDir(gameDir);
    const entry = findMapEntry(serverDir, teamId, stadiumName);
    const roots = siderRoots(gameDir);
    const stadiumId = entry?.stadiumId ?? null;
    const code = stadiumId != null ? stadiumCode(stadiumId) : null;

    let png = null;
    if (entry && serverDir) {
      const packDir = path.join(serverDir, entry.relPath);
      const packCandidates = [];
      if (code) {
        packCandidates.push(
          { file: path.join(packDir, STADIUM_THUMB_DIR, `${code}.png`), ext: 'png' },
          { file: path.join(packDir, STADIUM_THUMB_DIR, `${code}.dds`), ext: 'dds' },
          { file: path.join(packDir, STADIUM_THUMB_DIR, `${code}_l.dds`), ext: 'dds' },
        );
      }
      packCandidates.push(
        { file: path.join(packDir, 'preview.png'), ext: 'png' },
        { file: path.join(packDir, 'thumbnail.png'), ext: 'png' },
      );
      png = tryReadImageCandidates(packCandidates);
    }

    if (!png && code) {
      const rootCandidates = [];
      for (const root of roots) {
        rootCandidates.push(
          { file: path.join(root, STADIUM_THUMB_DIR, `${code}.png`), ext: 'png' },
          { file: path.join(root, STADIUM_THUMB_DIR, `${code}.dds`), ext: 'dds' },
          { file: path.join(root, STADIUM_THUMB_DIR, `${code}_l.dds`), ext: 'dds' },
        );
      }
      png = tryReadImageCandidates(rootCandidates);
    }

    if (!png && stadiumId != null) {
      const hit = stadiumThumbIndex(gameDir).get(stadiumId);
      if (hit) {
        png = decodeImageBuffer(readCpkEntry(hit.file, hit.entry), hit.ext);
      }
    }

    if (!png) return null;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, png);
    return outName;
  } catch {
    return null;
  }
}

module.exports = { parseStadiumMap, ensureClubStadium, stadiumCode };
