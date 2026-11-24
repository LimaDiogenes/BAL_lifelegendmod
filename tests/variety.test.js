'use strict';
// Variété (2.0) : une phrase déjà vue n'est pas reprise tant qu'il en reste d'autres dans le même ensemble.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { pickFresh, buildCircleKopReaction, buildBrandProfessionalPost } = require(path.join(__dirname, '..', 'src/world/lifeScenes.js'));

test('pickFresh : pas de répétition avant d’avoir tout utilisé', () => {
  const state = {};
  const list = ['a', 'b', 'c', 'd', 'e'];
  const seen = new Set();
  for (let i = 0; i < 5; i += 1) seen.add(pickFresh(state, 'k', list, `same-seed`));
  assert.strictEqual(seen.size, 5);
});

test('réactions des proches et posts des marques : variées d’un événement à l’autre', () => {
  for (const kopPersonality of ['supportive', 'playful', 'hype', 'protective', 'professional']) {
    const state = {};
    const lines = new Set();
    for (let i = 0; i < 6; i += 1) lines.add(buildCircleKopReaction({ name: 'Ana', kopPersonality }, '@me', 'obligation', 'en', 'seed', state));
    assert.strictEqual(lines.size, 6, kopPersonality);
  }
  const state = {};
  const posts = new Set();
  for (let i = 0; i < 8; i += 1) posts.add(buildBrandProfessionalPost('Acme', '@me', 'vip_event', 'lifestyle', 'pt', 'seed', state));
  assert.ok(posts.size >= 8);
});
