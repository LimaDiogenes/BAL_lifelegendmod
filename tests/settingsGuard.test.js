'use strict';
// Chemins reçus de l'interface ou de la ligne de commande (src/settingsGuard.js) : seuls une vraie sauvegarde BL et un
// dossier existant sont gardés dans les réglages. Fichiers fabriqués dans un dossier temporaire.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkSettingsUpdate, resolveSaveArg, validGameDir } = require(path.join(__dirname, '..', 'src', 'settingsGuard.js'));

function tree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-settings-'));
  const save = path.join(dir, 'save');
  fs.mkdirSync(save);
  fs.writeFileSync(path.join(save, 'BL00000000'), 'a');
  fs.writeFileSync(path.join(save, 'BL00000001'), 'b');
  fs.writeFileSync(path.join(save, 'notes.txt'), 'c');
  fs.writeFileSync(path.join(save, 'copie-de-ma-carriere'), 'd');
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(save, 'BL00000000'), old, old);
  return { dir, save };
}

test('savePath : une sauvegarde BL existante, ou vide ; le reste est refusé', () => {
  const { dir, save } = tree();
  const bl = path.join(save, 'BL00000001');
  assert.strictEqual(checkSettingsUpdate({ savePath: bl }).savePath, bl);
  assert.strictEqual(checkSettingsUpdate({ savePath: '' }).savePath, '');
  assert.strictEqual(checkSettingsUpdate({ savePath: null }).savePath, '');
  for (const bad of [path.join(save, 'notes.txt'), path.join(save, 'BL00000009'), save, 'BL00000001', '\\server\share\BL00000000', 42]) {
    assert.throws(() => checkSettingsUpdate({ savePath: bad }), /pas une sauvegarde Become a Legend/, String(bad));
  }
  // copie renommée : acceptée si son en-tête dit « BL »
  const copy = path.join(save, 'copie-de-ma-carriere');
  assert.throws(() => checkSettingsUpdate({ savePath: copy }, {}, { peek: () => ({ fileType: 'MLE' }) }));
  assert.strictEqual(checkSettingsUpdate({ savePath: copy }, {}, { peek: () => ({ fileType: 'BL' }) }).savePath, copy);
  // inchangé : pas revérifié
  const gone = path.join(dir, 'effacee', 'BL00000000');
  assert.strictEqual(checkSettingsUpdate({ savePath: gone, theme: 'dark' }, { savePath: gone }).savePath, gone);
});

test('gameDir : un dossier existant, ou vide', () => {
  const { dir, save } = tree();
  assert.strictEqual(checkSettingsUpdate({ gameDir: dir }).gameDir, dir);
  assert.strictEqual(checkSettingsUpdate({ gameDir: '' }).gameDir, '');
  assert.throws(() => checkSettingsUpdate({ gameDir: path.join(save, 'BL00000000') }), /dossier du jeu/);
  assert.throws(() => checkSettingsUpdate({ gameDir: path.join(dir, 'absent') }), /dossier du jeu/);
  assert.ok(validGameDir(dir));
  assert.ok(!validGameDir('relative\dir'));
  assert.throws(() => checkSettingsUpdate(null), /Réglages invalides/);
  assert.deepStrictEqual(checkSettingsUpdate({ theme: 'light' }), { theme: 'light' });
});

test('--save= : un fichier BL, ou la sauvegarde la plus récente d’un dossier save', () => {
  const { dir, save } = tree();
  assert.strictEqual(resolveSaveArg(save), path.join(save, 'BL00000001'));
  assert.strictEqual(resolveSaveArg(path.join(save, 'BL00000000')), path.join(save, 'BL00000000'));
  assert.strictEqual(resolveSaveArg(path.join(save, 'notes.txt')), null);
  assert.strictEqual(resolveSaveArg(dir), null, 'dossier sans sauvegarde');
  assert.strictEqual(resolveSaveArg(''), null);
});
