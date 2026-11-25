'use strict';
// Les textes de src/world/texts/ : chaque entrée existe dans les 6 langues, sans texte vide, avec les mêmes {X}.
// Ce test protège les ajouts de variantes (2.0) : une langue oubliée ou un {X} mal recopié se voit tout de suite.
// (Les textes des posts, texts/posts.js, ont leur propre test : postTexts.test.js.)

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const req = (p) => require(path.join(__dirname, '..', 'src/world/texts', p));

const LANGS = ['fr', 'en', 'pt', 'es', 'it', 'de'];
const holes = (s) => [...String(s).matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]).sort().join(',');

// Parcourt une valeur et vérifie chaque objet { fr, en, … } trouvé.
function checkTree(value, where, problems) {
  if (Array.isArray(value)) { value.forEach((v, i) => checkTree(v, `${where}[${i}]`, problems)); return; }
  if (!value || typeof value !== 'object') return;
  const keys = Object.keys(value);
  if (keys.includes('fr') && keys.includes('en') && typeof value.en === 'string') {
    for (const l of LANGS) {
      if (typeof value[l] !== 'string' || !value[l].trim()) problems.push(`${where}: « ${l} » manque`);
      else if (holes(value[l]) !== holes(value.fr)) problems.push(`${where}: {…} différents en ${l} (${holes(value[l])} / fr ${holes(value.fr)})`);
    }
    return;
  }
  for (const k of keys) checkTree(value[k], `${where}.${k}`, problems);
}

test('scènes, Kop et messages : 6 langues partout, mêmes {X}', () => {
  const problems = [];
  for (const [file, mod] of [['scenes', req('scenes.js')], ['messages', req('messages.js')], ['club', req('club.js')], ['interviews', req('interviews.js')], ['antagonists', req('antagonists.js')]]) {
    for (const [name, v] of Object.entries(mod)) checkTree(v, `${file}.${name}`, problems);
  }
  const kop = req('kop.js');
  checkTree(kop.CIRCLE_MORE('@me'), 'kop.CIRCLE_MORE', problems);
  checkTree(kop.BRAND_MORE('@me', '#ad', 'Brand'), 'kop.BRAND_MORE', problems);
  checkTree(kop.SIGNED_MORE('@me', '#ad', 'Brand'), 'kop.SIGNED_MORE', problems);
  assert.deepStrictEqual(problems, []);
});

test('noms du catalogue : les mêmes articles dans chaque langue', () => {
  const { CATALOG_NAMES } = req('catalog.js');
  const base = Object.keys(CATALOG_NAMES.en).sort();
  for (const l of LANGS) {
    const missing = base.filter((k) => !CATALOG_NAMES[l]?.[k]);
    assert.deepStrictEqual(missing, [], `catalogue ${l}`);
  }
});
