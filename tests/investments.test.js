'use strict';
// Patrimoine 2.0 : placements dont la valeur bouge chaque mois selon le risque, blocage (revendre avant coûte 15 %),
// parts chez un partenaire (suivent sa confiance, −15 % s'il part), nouveaux articles (jets, yachts, collections).

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ensureLifeHub, buyAsset, sellAsset, revalueAssets, partnerStakePrice, ASSET_CATALOG } = require(path.join(__dirname, '..', 'src/world/lifeHub.js'));

function career() {
  const st = { careerId: 'inv1', snapshot: { gameDate: '2027-01-15' }, profile: { followers: 50000 } };
  const hub = ensureLifeHub(st, st.snapshot);
  Object.assign(hub, { calibrated: true, cash: 200000000, stage: 'superstar', sponsors: [{ id: 'sp1', brand: 'Acme', category: 'lifestyle', categories: ['lifestyle'], fee: 200000, until: '2030-06-30' }] });
  return { st, hub };
}
let n = 0;
const newId = () => `i${++n}`;

test('catalogue : jets et yachts à prix réalistes, sans sponsor', () => {
  const big = ASSET_CATALOG.find((a) => a.id === 'big_yacht');
  assert.ok(big && big.price >= 50000000 && big.monthlyCost >= 500000);
  assert.ok(['small_jet', 'medium_jet', 'big_jet', 'small_yacht', 'medium_yacht'].every((id) => ASSET_CATALOG.some((a) => a.id === id && a.category === 'luxury')));
});

test('la valeur bouge chaque mois, de façon stable (même résultat à chaque calcul)', () => {
  const run = () => {
    const { st, hub } = career();
    buyAsset(st, { catalogId: 'index_portfolio' }, '2027-01-15', newId);
    revalueAssets(hub, '2027-07-01');
    return hub.assets.find((a) => a.catalogId === 'index_portfolio').resaleValue;
  };
  const v = run();
  assert.notStrictEqual(v, 250000);
  assert.strictEqual(run(), v);
});

test('revendre pendant le blocage coûte 15 %, après seulement 3 %', () => {
  const { st, hub } = career();
  buyAsset(st, { catalogId: 'savings_bonds' }, '2027-01-15', newId);
  const a = hub.assets.find((x) => x.catalogId === 'savings_bonds');
  const before = hub.cash;
  sellAsset(st, a.id, '2027-03-01');
  assert.strictEqual(hub.cash - before, Math.round(a.resaleValue * 0.85));
  buyAsset(st, { catalogId: 'savings_bonds' }, '2027-01-15', newId);
  const b = hub.assets.find((x) => x.catalogId === 'savings_bonds');
  const before2 = hub.cash;
  sellAsset(st, b.id, '2028-02-01');
  assert.strictEqual(hub.cash - before2, Math.round(b.resaleValue * 0.97));
});

test('parts chez un partenaire : une seule par partenaire, −15 % quand il part', () => {
  const { st, hub } = career();
  buyAsset(st, { partnerStake: 'sp1' }, '2027-01-15', newId);
  const stake = hub.assets.find((a) => a.stakeSponsorId === 'sp1');
  assert.strictEqual(stake.price, partnerStakePrice(hub.sponsors[0]));
  assert.throws(() => buyAsset(st, { partnerStake: 'sp1' }, '2027-01-16', newId), /déjà possédé/);
  hub.sponsors = [];
  const v0 = stake.resaleValue;
  revalueAssets(hub, '2027-02-01');
  assert.ok(stake.partnerGone);
  assert.ok(stake.resaleValue < v0 * 0.9);
});
