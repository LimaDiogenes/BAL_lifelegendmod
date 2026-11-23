'use strict';
// Le ton du monde (2.0) : rumeurs inventées activables, consigne envoyée à l'IA.
const test = require('node:test');
const assert = require('node:assert');
const { toneLines } = require('../src/ai/prompts');

test('rumeurs : consigne selon le réglage, jamais sur les personnes protégées', () => {
  const on = toneLines({ market: 50, drama: 25 }, true, true);
  const off = toneLines({ market: 50, drama: 25 }, true, false);
  assert.match(on, /Rumours: .*never about protected people or places/);
  assert.match(off, /Rumours are OFF/);
  assert.match(toneLines({ market: 90, drama: 90 }), /pressure cooker/);
});
