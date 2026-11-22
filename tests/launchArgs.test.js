'use strict';
// Lancement depuis le Mod Studio (src/launchArgs.js) et réglages de session / clé en mémoire (src/store.js).
// Dossiers temporaires et fausses sauvegardes : aucune donnée réelle.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseLaunchArgs, applyLaunchArgs } = require(path.join(__dirname, '..', 'src', 'launchArgs.js'));
const { Store } = require(path.join(__dirname, '..', 'src', 'store.js'));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'll-launch-'));
const noCrypto = { isEncryptionAvailable: () => false };
const fakeCrypto = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(`enc:${s}`), decryptString: (b) => b.toString().slice(4) };

test('arguments reconnus, valeurs inconnues ignorées', () => {
  assert.deepStrictEqual(parseLaunchArgs(['LifeLegend.exe', '--save=C:\\x\\save', '--game="D:\\Games\\FL"', '--lang=PT', '--theme=dark', '--other=1', '--inspect']),
    { save: 'C:\\x\\save', game: 'D:\\Games\\FL', lang: 'pt', theme: 'dark' });
  assert.deepStrictEqual(parseLaunchArgs(['--lang=xx', '--theme=auto', '--save=', 'save=1']), {});
  assert.deepStrictEqual(parseLaunchArgs(['--lang=fr']), { lang: 'fr' });
});

test('--save et --game valables sont gardés, --lang et --theme valent pour la session', () => {
  const dir = tmp();
  const saveDir = path.join(dir, 'save');
  fs.mkdirSync(saveDir);
  fs.writeFileSync(path.join(saveDir, 'BL00000002'), 'x');
  const store = new Store(path.join(dir, 'data'), noCrypto);
  const r = applyLaunchArgs(store, { save: saveDir, game: dir, lang: 'de', theme: 'light' });
  assert.deepStrictEqual(r, { applied: ['save', 'game', 'lang', 'theme'], rejected: [] });
  const s = store.getSettings();
  assert.strictEqual(s.savePath, path.join(saveDir, 'BL00000002'));
  assert.strictEqual(s.gameDir, dir);
  assert.strictEqual(s.language, 'de');
  assert.strictEqual(s.theme, 'light');
  // la session n'est pas écrite sur le disque
  const disk = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'settings.json'), 'utf8'));
  assert.notStrictEqual(disk.language, 'de');
  assert.notStrictEqual(disk.theme, 'light');
  assert.strictEqual(new Store(path.join(dir, 'data'), noCrypto).getSettings().language, 'en');
  // un autre réglage enregistré ne fige pas la session ; la langue choisie par le joueur la remplace
  store.saveSettings({ autoSync: false });
  assert.notStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'settings.json'), 'utf8')).language, 'de');
  assert.strictEqual(store.getSettings().language, 'de');
  store.saveSettings({ language: 'es' });
  assert.strictEqual(store.getSettings().language, 'es');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'settings.json'), 'utf8')).language, 'es');
});

test('chemins refusés : rien n’est gardé', () => {
  const dir = tmp();
  const store = new Store(path.join(dir, 'data'), noCrypto);
  const r = applyLaunchArgs(store, { save: path.join(dir, 'absent', 'BL00000000'), game: path.join(dir, 'absent') });
  assert.deepStrictEqual(r, { applied: [], rejected: ['save', 'game'] });
  assert.strictEqual(store.getSettings().savePath, '');
});

test('clé d’IA sans chiffrement Windows : en mémoire seulement, jamais en clair sur le disque', () => {
  const dir = tmp();
  const store = new Store(dir, noCrypto);
  store.saveSettings({ provider: 'groq', apiKey: 'gsk_test_secret' });
  assert.strictEqual(store.getKey('groq'), 'gsk_test_secret');
  assert.ok(!fs.readFileSync(path.join(dir, 'settings.json'), 'utf8').includes('gsk_test_secret'));
  const pub = store.publicSettings();
  assert.deepStrictEqual(pub.savedKeys, ['groq']);
  assert.deepStrictEqual(pub.sessionKeys, ['groq']);
  assert.strictEqual(pub.keyEncryption, false);
  assert.strictEqual(new Store(dir, noCrypto).getKey('groq'), '', 'perdue à la fermeture');
  // avec chiffrement : écrite chiffrée
  const enc = new Store(tmp(), fakeCrypto);
  enc.saveSettings({ provider: 'groq', apiKey: 'gsk_test_secret' });
  assert.strictEqual(enc.getKey('groq'), 'gsk_test_secret');
  assert.ok(!fs.readFileSync(path.join(enc.dir, 'settings.json'), 'utf8').includes('gsk_test_secret'));
  assert.strictEqual(enc.publicSettings().keyEncryption, true);
});

test('--from-studio : la vérification des mises à jour est masquée pour cette session seulement', () => {
  assert.deepStrictEqual(parseLaunchArgs(['LifeLegend.exe', '--from-studio']), { fromStudio: true });
  const store = new Store(path.join(tmp(), 'data'), noCrypto);
  assert.strictEqual(store.publicSettings().launchedByStudio, false);
  applyLaunchArgs(store, { fromStudio: true });
  assert.strictEqual(store.publicSettings().launchedByStudio, true);
  assert.ok(!('launchedByStudio' in store.storedSettings()));
});
