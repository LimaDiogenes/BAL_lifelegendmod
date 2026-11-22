'use strict';
// Le seul chemin d'écriture d'une sauvegarde Become a Legend (Influence, mise à l'écart, Ma vie, réorientation d'offre) :
// 1. jeu fermé, verrou partagé avec le Mod Studio (saveLock.js) ;
// 2. le fichier d'origine, déchiffré puis rechiffré sans rien changer, doit redonner le même fichier à l'octet près ;
//    sinon LifeLegend ne saurait pas le réécrire sans l'abîmer : rien n'est écrit ;
// 3. les données modifiées gardent leur taille (joinSave réutilise l'en-tête d'origine) ;
// 4. copie de sécurité : la toute première copie de chaque sauvegarde est gardée pour toujours, puis les 10 dernières ;
// 5. écriture dans un fichier temporaire vidé sur le disque (fsync), renommé à la place de la sauvegarde, puis relecture.

const fs = require('fs');
const path = require('path');
const { splitSave, joinSave, decryptSave } = require('./pesCrypt');
const { assertStandard } = require('./layout');
const { withSaveLock } = require('./saveLock');

const KEEP_BACKUPS = 10;
const FIRST_SUFFIX = '-premiere-copie';

// Sections déchiffrées, seulement si le rechiffrement à vide redonne le fichier d'origine à l'octet près.
function openForEdit(original) {
  const parts = splitSave(original);
  if (!joinSave(parts).equals(original)) {
    throw new Error('Cette sauvegarde ne se rechiffre pas à l’identique : LifeLegend ne peut pas l’écrire sans risque. Rien n’a été modifié.');
  }
  return parts;
}

// Fichier rechiffré avec les données modifiées, vérifié : même taille de données, même taille de fichier, relu.
function sealEdit(parts, data, originalLength) {
  if (!Buffer.isBuffer(data) || data.length !== parts.data.length) {
    throw new Error('La modification a changé la taille des données de la sauvegarde : rien n’a été modifié.');
  }
  const out = joinSave({ ...parts, data });
  if (out.length !== originalLength) throw new Error('La modification a changé la taille des données de la sauvegarde : rien n’a été modifié.');
  if (!decryptSave(out).data.equals(data)) throw new Error('Vérification de l’écriture échouée : rien n’a été modifié.');
  return out;
}

// Écrit le fichier et attend qu'il soit vraiment sur le disque.
function writeFileSynced(file, buf) {
  const fd = fs.openSync(file, 'w');
  try {
    fs.writeSync(fd, buf, 0, buf.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Copies de sécurité de cette sauvegarde : <nom>-premiere-copie (jamais effacée) et <nom>-<date>-avant-<tag> (les 10
// dernières par genre d'écriture). La première copie reprend la plus ancienne copie datée si elle existe déjà.
function keepBackup({ backupDir, savePath, original, tag, stamp = new Date().toISOString().replace(/[:.]/g, '-') }) {
  fs.mkdirSync(backupDir, { recursive: true });
  const base = path.basename(savePath);
  const dated = () => fs.readdirSync(backupDir).filter((x) => x.startsWith(`${base}-`) && x.includes('-avant-')).sort();
  const first = path.join(backupDir, `${base}${FIRST_SUFFIX}`);
  if (!fs.existsSync(first)) {
    const oldest = dated()[0];
    if (oldest) fs.copyFileSync(path.join(backupDir, oldest), first);
    else writeFileSynced(first, original);
  }
  const backup = path.join(backupDir, `${base}-${stamp}-avant-${tag}`);
  writeFileSynced(backup, original);
  for (const f of dated().filter((x) => x.endsWith(`-avant-${tag}`)).slice(0, -KEEP_BACKUPS)) fs.rmSync(path.join(backupDir, f));
  return { backup, first };
}

function replaceSynced(savePath, out) {
  const tmp = `${savePath}.legendlife-tmp`;
  writeFileSynced(tmp, out);
  fs.renameSync(tmp, savePath);
}

// edit(data) → { data, ... } ; check(dataRelue, savePath) → true si l'écriture est bien là.
function safeSaveWrite({ savePath, backupDir, tag, gameRunning, edit, check, assertLayout = assertStandard, lock = {} }) {
  if (gameRunning()) throw new Error('Le jeu est ouvert : sauvegarde ta partie, quitte-le, puis recommence.');
  return withSaveLock(savePath, () => {
    const before = fs.statSync(savePath);
    const original = fs.readFileSync(savePath);
    const parts = openForEdit(original);
    // Une sauvegarde agrandie par des modules (FL Mod Studio…) : ses places n'ont pas été vérifiées pour écrire.
    assertLayout(parts.data);
    const result = edit(Buffer.from(parts.data));
    const out = sealEdit(parts, result.data, original.length);
    const { backup } = keepBackup({ backupDir, savePath, original, tag });

    const now = fs.statSync(savePath);
    if (now.mtimeMs !== before.mtimeMs || now.size !== before.size || gameRunning()) throw new Error('La sauvegarde a changé entre-temps (jeu relancé ?) : rien n’a été modifié.');
    replaceSynced(savePath, out);
    if (!check(decryptSave(fs.readFileSync(savePath)).data, savePath)) throw new Error(`Relecture inattendue après écriture. Ta sauvegarde d’origine est ici : ${backup}`);
    return { result, backup };
  }, lock);
}

module.exports = { safeSaveWrite, openForEdit, sealEdit, keepBackup, writeFileSynced, KEEP_BACKUPS, FIRST_SUFFIX };
