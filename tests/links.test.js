'use strict';
// Liens ouverts hors de l'app (main.js : will-navigate, window.open) : seulement https:// et mailto:.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { externalUrl, samePage } = require(path.join(__dirname, '..', 'src', 'links.js'));

test('https et mailto sont ouverts, le reste est bloqué', () => {
  assert.strictEqual(externalUrl('https://github.com/LimaDiogenes/BAL_lifelegendmod/releases'), 'https://github.com/LimaDiogenes/BAL_lifelegendmod/releases');
  assert.strictEqual(externalUrl('mailto:someone@example.com'), 'mailto:someone@example.com');
  for (const bad of ['http://example.com', 'file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-settings:privacy', 'steam://run/1', 'smb://host/share', '', null, 'not a url', 'https://']) {
    assert.strictEqual(externalUrl(bad), null, String(bad));
  }
});

test('la page de l’app peut se recharger, les autres fichiers non', () => {
  const page = 'file:///F:/LifeLegend/resources/app/lifelegend/index.html';
  assert.ok(samePage(`${page}#settings`, page));
  assert.ok(samePage(page.replace('LifeLegend', 'lifelegend'), page));
  assert.ok(!samePage('file:///C:/Users/x/evil.html', page));
  assert.ok(!samePage('https://example.com/index.html', page));
});
