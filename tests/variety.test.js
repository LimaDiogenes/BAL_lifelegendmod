'use strict';
// Variété (2.0) : une phrase déjà vue n'est pas reprise tant qu'il en reste d'autres dans le même ensemble.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { pickFresh, buildCircleKopReaction, buildBrandProfessionalPost, renderActionScene } = require(path.join(__dirname, '..', 'src/world/lifeScenes.js'));

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

test('scènes des journées libres : trois versions par action, sans répétition', () => {
  for (const act of ['recovery', 'extra_training', 'team_dinner', 'inner_circle', 'charity_visit', 'media_feature', 'vip_night']) {
    for (const l of ['fr', 'en', 'pt', 'es', 'it', 'de']) {
      const state = {};
      const ctx = { l, player: 'Rui', club: 'Lyon', teammate: 'Leo', inner: { name: 'Ana' }, hometown: 'Santos', seed: 's', state };
      const heads = new Set();
      for (let i = 0; i < 3; i += 1) {
        const sc = renderActionScene(ctx, act, '', '', '@rui');
        assert.ok(sc.headline && sc.narrative && !/[{}]/.test(sc.narrative + sc.headline + (sc.kop || '') + (sc.huddle || '')), `${act} ${l}`);
        heads.add(sc.narrative);
      }
      assert.strictEqual(heads.size, 3, `${act} ${l}`);
    }
  }
});
