'use strict';
// Verrou d'écriture partagé avec blue41 PES2021 Mod Studio (protocole : docs/save-lock.md).
// Pendant qu'une app écrit une sauvegarde BL, le fichier <dossier de la sauvegarde>\.blue41-save.lock existe, créé en
// exclusif, avec { app, pid, started }. Un verrou dont le processus est mort ou qui a plus de 2 minutes est périmé : il
// est retiré. Sinon l'autre app attend son tour (rien n'est écrit).

const fs = require('fs');
const path = require('path');

const LOCK_NAME = '.blue41-save.lock';
const STALE_MS = 2 * 60 * 1000;
const APP = 'LifeLegend';

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // le processus existe mais appartient à un autre utilisateur
  }
}

const lockPath = (savePath) => path.join(path.dirname(path.resolve(savePath)), LOCK_NAME);

// Contenu du verrou, ou null s'il est illisible (en cours d'écriture par l'autre app, ou abîmé).
function readLock(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function isStale(file, info, { now, alive }) {
  if (info) {
    const started = Date.parse(info.started);
    if (!Number.isFinite(started) || now - started > STALE_MS) return true;
    return !alive(Number(info.pid));
  }
  // Illisible : périmé seulement s'il est vieux (l'autre app est peut-être en train de l'écrire).
  try { return now - fs.statSync(file).mtimeMs > STALE_MS; } catch { return true; }
}

function busyError(info) {
  const err = /studio/i.test(String(info?.app || ''))
    ? new Error('Le Mod Studio (blue41) écrit dans cette sauvegarde en ce moment : rien n’a été modifié. Réessaie quand il a fini.')
    : new Error('Une autre application écrit dans cette sauvegarde en ce moment : rien n’a été modifié. Réessaie dans un instant.');
  err.code = 'SAVE_LOCKED';
  return err;
}

// Prend le verrou : renvoie une fonction qui le libère. Lève SAVE_LOCKED si une autre app écrit.
function acquireSaveLock(savePath, { now = Date.now(), alive = pidAlive, pid = process.pid, app = APP } = {}) {
  const file = lockPath(savePath);
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = fs.openSync(file, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const info = readLock(file);
      if (!isStale(file, info, { now, alive })) throw busyError(info);
      try { fs.rmSync(file, { force: true }); } catch { /* retiré entre-temps par l'autre app */ }
      continue;
    }
    try {
      fs.writeSync(fd, JSON.stringify({ app, pid, started: new Date(now).toISOString() }));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      // Ne retire que notre propre verrou (un verrou repris par une autre app après péremption reste en place).
      const cur = readLock(file);
      if (cur && cur.pid === pid && cur.app === app) {
        try { fs.rmSync(file, { force: true }); } catch { /* déjà retiré */ }
      }
    };
  }
  throw busyError(readLock(file));
}

// Exécute fn() sous le verrou, et le libère quoi qu'il arrive.
function withSaveLock(savePath, fn, opts) {
  const release = acquireSaveLock(savePath, opts);
  try {
    return fn();
  } finally {
    release();
  }
}

module.exports = { acquireSaveLock, withSaveLock, lockPath, pidAlive, LOCK_NAME, STALE_MS };
