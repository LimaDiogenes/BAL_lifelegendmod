'use strict';
// Écriture sûre des sauvegardes (src/save/safeWrite.js, saveLock.js) et recherche des clubs (influenceWrite.teamOffset).
// Sauvegardes fabriquées ici avec des octets tirés au hasard : aucune vraie sauvegarde ni clé.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { splitSave, joinSave, decryptSave } = require(path.join(ROOT, 'src/save/pesCrypt.js'));
const { safeSaveWrite, openForEdit, sealEdit, keepBackup, FIRST_SUFFIX } = require(path.join(ROOT, 'src/save/safeWrite.js'));
const { acquireSaveLock, lockPath, LOCK_NAME, STALE_MS } = require(path.join(ROOT, 'src/save/saveLock.js'));
const { teamOffset } = require(path.join(ROOT, 'src/save/influenceWrite.js'));

function fakeSave() {
  const fh = Buffer.alloc(208);
  const parts = { desc: crypto.randomBytes(384), logo: crypto.randomBytes(100), data: crypto.randomBytes(4096), serial: crypto.randomBytes(46), tail: crypto.randomBytes(64), fh };
  fh.writeUInt32LE(parts.data.length, 64); fh.writeUInt32LE(parts.logo.length, 68); fh.writeUInt32LE(parts.desc.length, 72); fh.writeUInt32LE(parts.serial.length / 2, 76);
  fh.write('BL', 144, 'latin1'); fh.write('eFootball PES 2021 SEASON UPDATE', 176, 'latin1');
  return joinSave(parts);
}

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'll-safewrite-'));
const DATA_AT = 320 + 208 + 384 + 100; // début de la section des données dans le fichier

function setup() {
  const dir = tmpDir();
  const saveDir = path.join(dir, 'save');
  fs.mkdirSync(saveDir);
  const savePath = path.join(saveDir, 'BL00000001');
  fs.writeFileSync(savePath, fakeSave());
  return { dir, savePath, backupDir: path.join(dir, 'backups') };
}

const flipFirstByte = (d) => { d[0] ^= 0xFF; return { data: d }; };
const opts = (s, extra = {}) => ({ ...s, tag: 'test', gameRunning: () => false, assertLayout: () => {}, edit: flipFirstByte, check: () => true, ...extra });

test('rechiffrement à vide : accepté s’il redonne le fichier, refusé sinon', () => {
  const file = fakeSave();
  assert.ok(openForEdit(file).data.length === 4096);
  // Flux XOR : un octet changé dans les données chiffrées change les données mais pas les empreintes de l'en-tête.
  const bad = Buffer.from(file);
  bad[DATA_AT + 10] ^= 1;
  assert.ok(decryptSave(bad).data, 'le fichier se lit encore');
  assert.throws(() => openForEdit(bad), /ne se rechiffre pas à l’identique/);
});

test('les données modifiées gardent leur taille', () => {
  const file = fakeSave();
  const parts = splitSave(file);
  assert.throws(() => joinSave({ ...parts, data: Buffer.alloc(4000) }), /changé la taille/);
  assert.throws(() => sealEdit(parts, Buffer.alloc(5000), file.length), /changé la taille/);
  const ok = Buffer.from(parts.data); ok[1] ^= 1;
  assert.strictEqual(sealEdit(parts, ok, file.length).length, file.length);
});

test('écriture : données changées, copie gardée, verrou retiré, pas de fichier temporaire', () => {
  const s = setup();
  const before = decryptSave(fs.readFileSync(s.savePath)).data;
  const { backup } = safeSaveWrite(opts(s, { check: (d) => d[0] === (before[0] ^ 0xFF) }));
  const after = decryptSave(fs.readFileSync(s.savePath)).data;
  assert.strictEqual(after[0], before[0] ^ 0xFF);
  assert.ok(after.subarray(1).equals(before.subarray(1)));
  assert.ok(fs.existsSync(backup));
  assert.ok(fs.existsSync(path.join(s.backupDir, `BL00000001${FIRST_SUFFIX}`)));
  assert.ok(!fs.existsSync(lockPath(s.savePath)));
  assert.ok(!fs.existsSync(`${s.savePath}.legendlife-tmp`));
});

test('jeu ouvert ou erreur pendant la modification : rien n’est écrit et le verrou est libéré', () => {
  const s = setup();
  const original = fs.readFileSync(s.savePath);
  assert.throws(() => safeSaveWrite(opts(s, { gameRunning: () => true })), /Le jeu est ouvert/);
  assert.throws(() => safeSaveWrite(opts(s, { edit: () => { throw new Error('boum'); } })), /boum/);
  assert.throws(() => safeSaveWrite(opts(s, { edit: (d) => ({ data: Buffer.concat([d, Buffer.alloc(4)]) }) })), /changé la taille/);
  assert.ok(fs.readFileSync(s.savePath).equals(original));
  assert.ok(!fs.existsSync(lockPath(s.savePath)));
});

test('copies : la première est gardée pour toujours, puis les 10 dernières de chaque genre', () => {
  const dir = tmpDir();
  const savePath = path.join(dir, 'BL00000002');
  const backupDir = path.join(dir, 'backups');
  // Une ancienne copie datée existe déjà : elle devient la première copie.
  fs.mkdirSync(backupDir);
  fs.writeFileSync(path.join(backupDir, 'BL00000002-2020-01-01T00-00-00-000Z-avant-test'), 'tout premier état');
  fs.writeFileSync(path.join(backupDir, 'BL00000009-2020-01-01T00-00-00-000Z-avant-test'), 'autre sauvegarde');
  for (let i = 0; i < 15; i++) keepBackup({ backupDir, savePath, original: Buffer.from(`état ${i}`), tag: 'test', stamp: `2026-01-01T00-00-${String(i).padStart(2, '0')}-000Z` });
  keepBackup({ backupDir, savePath, original: Buffer.from('autre genre'), tag: 'sanction', stamp: '2026-02-01T00-00-00-000Z' });
  const files = fs.readdirSync(backupDir);
  assert.strictEqual(fs.readFileSync(path.join(backupDir, `BL00000002${FIRST_SUFFIX}`), 'utf8'), 'tout premier état');
  assert.strictEqual(files.filter((f) => f.startsWith('BL00000002-') && f.endsWith('-avant-test')).length, 10);
  assert.ok(files.includes('BL00000002-2026-01-01T00-00-14-000Z-avant-test'));
  assert.ok(files.includes('BL00000002-2026-02-01T00-00-00-000Z-avant-sanction'));
  assert.ok(files.includes('BL00000009-2020-01-01T00-00-00-000Z-avant-test'), 'les copies d’une autre sauvegarde ne sont pas touchées');
});

test('verrou partagé avec le Mod Studio : refus s’il écrit, verrou périmé retiré', () => {
  const s = setup();
  const lock = lockPath(s.savePath);
  assert.strictEqual(path.basename(lock), LOCK_NAME);
  assert.strictEqual(path.dirname(lock), path.dirname(s.savePath));
  const now = Date.now();
  const studio = (extra) => fs.writeFileSync(lock, JSON.stringify({ app: 'blue41 PES2021 Mod Studio', pid: 4242, started: new Date(now).toISOString(), ...extra }));

  studio();
  assert.throws(() => acquireSaveLock(s.savePath, { now, alive: () => true }), (e) => e.code === 'SAVE_LOCKED' && /Mod Studio/.test(e.message));
  assert.throws(() => safeSaveWrite(opts(s, { lock: { alive: () => true } })), /Mod Studio/);

  // processus mort : verrou périmé
  let release = acquireSaveLock(s.savePath, { now, alive: () => false });
  const mine = JSON.parse(fs.readFileSync(lock, 'utf8'));
  assert.strictEqual(mine.app, 'LifeLegend');
  assert.strictEqual(mine.pid, process.pid);
  release();
  assert.ok(!fs.existsSync(lock));

  // plus de 2 minutes : périmé même si le processus vit
  studio({ started: new Date(now - STALE_MS - 1000).toISOString() });
  release = acquireSaveLock(s.savePath, { now, alive: () => true });
  release();
  assert.ok(!fs.existsSync(lock));

  // notre propre verrou, libéré deux fois : sans erreur
  release = acquireSaveLock(s.savePath);
  assert.throws(() => acquireSaveLock(s.savePath), (e) => e.code === 'SAVE_LOCKED');
  release(); release();
  assert.ok(!fs.existsSync(lock));
});

test('club après une place vide (ancienne saison) : retrouvé comme dans blReader', () => {
  const STRIDE = 0x690;
  const d = Buffer.alloc(STRIDE * 8);
  const put = (k, id, name) => { d.writeUInt32LE(((id << 14) | k) >>> 0, STRIDE * k + 0x50); d.write(name, STRIDE * k + 0x54, 'latin1'); };
  put(0, 10, 'Premier');
  put(1, 11, '');            // place d'une ancienne saison : nom vide
  put(2, 12, 'Troisieme');
  assert.strictEqual(teamOffset(d, (10 << 14) | 0), 0);
  assert.strictEqual(teamOffset(d, (12 << 14) | 2), STRIDE * 2);
  assert.strictEqual(teamOffset(d, (99 << 14) | 2), -1, 'référence différente à cette place');
  assert.strictEqual(teamOffset(d, (12 << 14) | 7), -1, 'place vide');
  assert.strictEqual(teamOffset(d, (12 << 14) | 40), -1, 'hors des données');
});
