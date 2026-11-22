'use strict';
// Vérification des chemins reçus de l'interface ou de la ligne de commande avant de les garder dans les réglages :
// - savePath : vide, ou un fichier existant nommé BL + 8 chiffres (BL00000000…), ou un fichier que le jeu a écrit comme
//   sauvegarde Become a Legend (type « BL » dans son en-tête, pour une copie renommée choisie avec « Parcourir ») ;
// - gameDir : vide (détection automatique), ou un dossier existant.

const fs = require('fs');
const path = require('path');

const SAVE_NAME = /^BL[0-9A-F]{8}$/i;

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function validSavePath(p, { peek = null } = {}) {
  if (typeof p !== 'string' || !p.trim() || !path.isAbsolute(p) || !isFile(p)) return false;
  if (SAVE_NAME.test(path.basename(p))) return true;
  try { return Boolean(peek) && peek(p).fileType === 'BL'; } catch { return false; }
}

const validGameDir = (p) => typeof p === 'string' && Boolean(p.trim()) && path.isAbsolute(p) && isDir(p);

// La mise à jour, nettoyée ; lève une erreur lisible si un chemin changé n'est pas valable. Un chemin inchangé n'est
// pas revérifié (une sauvegarde effacée depuis ne doit pas empêcher d'enregistrer les autres réglages).
function checkSettingsUpdate(update, current = {}, { peek = null } = {}) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) throw new Error('Réglages invalides.');
  const out = { ...update };
  if ('savePath' in out) {
    if (out.savePath == null) out.savePath = '';
    if (typeof out.savePath !== 'string') throw new Error('Ce fichier n’est pas une sauvegarde Become a Legend (BL0000000x).');
    out.savePath = out.savePath.trim();
    if (out.savePath && out.savePath !== current.savePath && !validSavePath(out.savePath, { peek })) {
      throw new Error('Ce fichier n’est pas une sauvegarde Become a Legend (BL0000000x).');
    }
  }
  if ('gameDir' in out) {
    if (out.gameDir == null) out.gameDir = '';
    if (typeof out.gameDir !== 'string') throw new Error('Ce dossier du jeu n’existe pas.');
    out.gameDir = out.gameDir.trim();
    if (out.gameDir && out.gameDir !== current.gameDir && !validGameDir(out.gameDir)) throw new Error('Ce dossier du jeu n’existe pas.');
  }
  return out;
}

// --save=<fichier BL ou dossier save> : le fichier lui-même, ou la sauvegarde BL0000000x la plus récente du dossier.
function resolveSaveArg(p, { peek = null } = {}) {
  if (typeof p !== 'string' || !p.trim()) return null;
  const abs = path.resolve(p.trim());
  if (isDir(abs)) {
    let best = null;
    for (const f of fs.readdirSync(abs)) {
      if (!SAVE_NAME.test(f)) continue;
      const full = path.join(abs, f);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isFile() && (!best || st.mtimeMs > best.mtimeMs)) best = { path: full, mtimeMs: st.mtimeMs };
    }
    return best ? best.path : null;
  }
  return validSavePath(abs, { peek }) ? abs : null;
}

module.exports = { checkSettingsUpdate, validSavePath, validGameDir, resolveSaveArg, SAVE_NAME };
