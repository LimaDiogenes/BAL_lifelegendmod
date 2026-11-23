'use strict';
// Transfert de profil (2.0) : export d'une carrière, import dans une autre ; options réglages, sponsors, événements.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { buildProfileExport, checkProfileFile, importableSettings, applyProfileImport } = require(path.join(__dirname, '..', 'src/world/profileTransfer.js'));

const career = (over = {}) => ({
  careerId: 'c1',
  snapshot: { gameDate: '2027-08-01' },
  profile: { displayName: 'A. Player', handle: 'aplayer', location: 'Lyon', bio: 'Midfielder.', website: '', bannerColor: '' },
  persona: { preset: 'custom', circle: {} },
  privacy: { fields: {}, overrides: {} },
  bio: { text: 'Born by the sea.', chapter: false },
  playerKind: 'created',
  lifeHub: { sponsors: [{ id: 's1', brand: 'Acme', category: 'lifestyle', categories: ['lifestyle'], fee: 100, until: '2028-06-30' }, { id: 'b', brand: 'Boots', linkedBootDeal: true }] },
  calendar: { customEvents: [{ id: 'e1', date: '2027-09-01', title: 'Wedding', category: 'personal' }] },
  feed: [{ id: 'p1' }],
  ...over,
});

test('export : le profil toujours, les options seulement si cochées, jamais les clés ni les dossiers', () => {
  const settings = { language: 'pt', theme: 'dark', keys: { google: 'secret' }, savePath: 'C:\\x', gameDir: 'D:\\g', sponsorMode: 'custom' };
  const bare = buildProfileExport(career(), settings, { settings: false });
  assert.strictEqual(bare.format, 'lifelegend-profile');
  assert.strictEqual(bare.bio.text, 'Born by the sea.');
  assert.strictEqual(bare.profile.location, 'Lyon');
  assert.ok(!('settings' in bare) && !('sponsors' in bare) && !('customEvents' in bare));
  assert.ok(!('feed' in bare), 'jamais l’historique');
  const full = buildProfileExport(career(), settings, { settings: true, sponsors: true, calendar: true });
  assert.deepStrictEqual(Object.keys(full.settings).sort(), ['language', 'sponsorMode', 'theme']);
  assert.deepStrictEqual(full.sponsors.map((s) => s.brand), ['Acme'], 'pas le deal équipementier lié au jeu');
  assert.strictEqual(full.customEvents.length, 1);
});

test('import : remplace le profil, ajoute sponsors et événements sans doublons, réglages filtrés', () => {
  const file = buildProfileExport(career(), { language: 'pt' }, { settings: true, sponsors: true, calendar: true });
  const target = career({ profile: { displayName: 'Other', handle: 'other', location: '', bio: '' }, bio: null, lifeHub: { sponsors: [] }, calendar: { customEvents: [] } });
  let n = 0;
  const applied = applyProfileImport(target, JSON.parse(JSON.stringify(file)), { sponsors: true, calendar: true }, () => `id${++n}`);
  assert.strictEqual(target.profile.displayName, 'Other', 'le nom du joueur reste celui de la carrière');
  assert.strictEqual(target.profile.location, 'Lyon');
  assert.strictEqual(target.bio.text, 'Born by the sea.');
  assert.strictEqual(applied.sponsors, 1);
  assert.strictEqual(target.lifeHub.sponsors[0].brand, 'Acme');
  // deuxième import : rien en double
  applyProfileImport(target, file, { sponsors: true, calendar: true }, () => `id${++n}`);
  assert.strictEqual(target.lifeHub.sponsors.length, 1);
  assert.strictEqual(target.calendar.customEvents.length, 1);
  // sans les options : profil seulement
  const t2 = career({ lifeHub: { sponsors: [] }, calendar: { customEvents: [] } });
  const a2 = applyProfileImport(t2, file, {}, () => 'x');
  assert.strictEqual(a2.sponsors + a2.events, 0);
  assert.deepStrictEqual(importableSettings({ language: 'es', keys: { a: 1 }, savePath: 'x', unknown: 1, theme: 3 }, { language: 'en', keys: {}, savePath: '', theme: 'auto' }), { language: 'es' });
});

test('un autre fichier est refusé', () => {
  assert.throws(() => checkProfileFile({ hello: 1 }), /n’est pas un profil LifeLegend/);
  assert.throws(() => checkProfileFile({ format: 'lifelegend-profile', version: 99 }), /version plus récente/);
});
