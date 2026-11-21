'use strict';
// Détection et surveillance des sauvegardes Become a Legend (BL00000000, BL00000001…) :
// scan trié par date de modification décroissante, sélection automatique du slot le plus récent (optionnelle),
// et détection multi-slots non bloquante pour la synchronisation automatique.

const fs = require('fs');
const path = require('path');
const { peekSave } = require('./blReader');

const SAVE_ROOTS = [
  ['KONAMI', /PES 2021|eFootball PES/i],
  ['SPGAME', /football ?life/i],
];

const BL_SLOT_RE = /^BL\d{8}$/;

function listCandidateSaveFiles({ documentsDir, extraFiles = [], includeSiblingSlots = false } = {}) {
  const seen = new Set();
  const files = [];
  const push = (file) => {
    if (!file || typeof file !== 'string') return;
    const norm = path.resolve(file);
    const key = process.platform === 'win32' ? norm.toLowerCase() : norm;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  if (documentsDir) {
    const gameDirs = [];
    for (const [name, gameRe] of SAVE_ROOTS) {
      const root = path.join(documentsDir, name);
      try {
        gameDirs.push(...fs.readdirSync(root).filter((d) => gameRe.test(d)).map((d) => path.join(root, d)));
      } catch { /* dossier absent */ }
    }
    for (const g of gameDirs) {
      let profiles = [];
      try { profiles = fs.readdirSync(g); } catch { continue; }
      for (const p of profiles) {
        const saveDir = path.join(g, p, 'save');
        let slots = [];
        try { slots = fs.readdirSync(saveDir).filter((f) => BL_SLOT_RE.test(f)); } catch { continue; }
        for (const slot of slots) push(path.join(saveDir, slot));
      }
    }
  }

  for (const extra of extraFiles || []) {
    if (!extra) continue;
    if (includeSiblingSlots) {
      const dir = path.dirname(extra);
      try {
        for (const f of fs.readdirSync(dir)) {
          if (BL_SLOT_RE.test(f)) push(path.join(dir, f));
        }
      } catch { /* dossier absent */ }
    }
    try {
      if (fs.existsSync(extra) && fs.statSync(extra).isFile()) push(extra);
    } catch { /* fichier absent */ }
  }

  return files;
}

function scanSaveFiles({ documentsDir, extraFiles = [], peek = peekSave } = {}) {
  const found = [];
  const candidates = listCandidateSaveFiles({ documentsDir, extraFiles, includeSiblingSlots: true });
  for (const file of candidates) {
    let stat = null;
    try { stat = fs.statSync(file); } catch { continue; }
    if (!stat.isFile()) continue;
    try {
      found.push({ path: file, modified: stat.mtimeMs, size: stat.size, ...peek(file) });
    } catch (err) {
      found.push({ path: file, modified: stat.mtimeMs, size: stat.size, error: err.message, locked: err.code === 'SAVE_KEY' });
    }
  }
  return found.sort((a, b) => (b.modified || 0) - (a.modified || 0));
}

function pickLatestSave(saves = [], currentSavePath = '') {
  const good = (Array.isArray(saves) ? saves : [])
    .filter((s) => s && s.path && !s.error && !s.locked && (!s.fileType || s.fileType === 'BL'))
    .sort((a, b) => (b.modified || 0) - (a.modified || 0));
  const latest = good[0] || null;
  const samePath = (a, b) => {
    if (!a || !b) return false;
    const na = path.resolve(a);
    const nb = path.resolve(b);
    return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb;
  };
  const switched = Boolean(latest && currentSavePath && !samePath(latest.path, currentSavePath));
  return {
    latest,
    switched,
    previousPath: currentSavePath || null,
  };
}

function snapshotWatchedFiles({ documentsDir, savePath = '', autoLatestSave = false } = {}) {
  const map = new Map();
  const files = autoLatestSave
    ? listCandidateSaveFiles({ documentsDir, extraFiles: savePath ? [savePath] : [], includeSiblingSlots: true })
    : (savePath ? [savePath] : []);
  for (const file of files) {
    try {
      const st = fs.statSync(file);
      if (st.isFile() && st.size > 0) {
        map.set(file, { path: file, mtimeMs: st.mtimeMs, size: st.size });
      }
    } catch { /* fichier absent ou en cours de création */ }
  }
  return map;
}

function detectModifiedSave(prevMap, nextMap) {
  if (!(nextMap instanceof Map)) return null;
  const prev = prevMap instanceof Map ? prevMap : new Map();
  const changed = [];
  for (const [file, cur] of nextMap.entries()) {
    if (!cur || !cur.size) continue;
    const old = prev.get(file);
    if (!old || cur.mtimeMs > old.mtimeMs) {
      changed.push(cur);
    }
  }
  if (!changed.length) return null;
  changed.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return changed[0];
}

function resolveSaveForSync({ store, documentsDir, peek = peekSave } = {}) {
  const s = store.getSettings();
  if (!s.autoLatestSave) {
    return { settings: s, switchedTo: null, latest: null, previousPath: s.savePath || '' };
  }
  const saves = scanSaveFiles({ documentsDir, extraFiles: s.savePath ? [s.savePath] : [], peek });
  const { latest, switched } = pickLatestSave(saves, s.savePath);
  if (latest && (switched || !s.savePath)) {
    store.saveSettings({ savePath: latest.path });
    return {
      settings: store.getSettings(),
      switchedTo: switched ? latest : null,
      latest,
      previousPath: s.savePath || '',
    };
  }
  return { settings: s, switchedTo: null, latest, previousPath: s.savePath || '' };
}

module.exports = {
  SAVE_ROOTS,
  scanSaveFiles,
  pickLatestSave,
  snapshotWatchedFiles,
  detectModifiedSave,
  resolveSaveForSync,
};
