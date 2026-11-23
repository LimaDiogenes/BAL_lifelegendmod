'use strict';
// Le monde réagit à sa vie (2.0) : proches ajoutés / retirés, lieux, biographie, profil ; public ou cercle proche.
const test = require('node:test');
const assert = require('node:assert');
const { diffPersona, diffBio, diffProfile, addHooks, lifeChangesFacts } = require('../src/world/lifeChanges');

test('les changements de sa vie deviennent des sujets, publics ou réservés au cercle proche', () => {
  const before = { circle: { family: [{ role: 'Sister', name: 'Ana', media: false }], friends: [{ role: 'Best friend', name: 'Leo' }] }, roots: { hometown: 'Uberlândia' } };
  const after = { circle: { family: [], friends: [{ role: 'Best friend', name: 'Leo' }, { role: 'Girlfriend', name: 'Bia', media: true }] }, roots: { hometown: 'São Paulo' } };
  const hooks = diffPersona(before, after, '2026-09-10');
  assert.ok(hooks.some((h) => h.kind === 'person_removed' && /Ana/.test(h.text) && h.visibility === 'private'));
  assert.ok(hooks.some((h) => h.kind === 'person_added' && /Bia/.test(h.text) && h.visibility === 'public'));
  assert.ok(hooks.some((h) => h.kind === 'roots' && /São Paulo/.test(h.text)));
  assert.strictEqual(diffBio('He grew up in a small town.', 'He grew up in a small town. He opened a youth academy in 2026.', '2026-09-10').length, 1);
  assert.strictEqual(diffProfile({ location: 'Liverpool' }, { location: 'Liverpool' }, '2026-09-10').length, 0);
  const state = {};
  addHooks(state, hooks);
  const f = lifeChangesFacts(state, '2026-09-12');
  assert.ok(f.public.some((t) => /Bia/.test(t)));
  assert.ok(f.close_circle_only.some((t) => /Ana/.test(t)));
  assert.strictEqual(lifeChangesFacts(state, '2026-10-30'), undefined);   // old news after 14 days
});
