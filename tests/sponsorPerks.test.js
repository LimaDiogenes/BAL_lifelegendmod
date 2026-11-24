'use strict';
// Sponsors 2.0 : gammes réelles, clause « tu roules dans nos voitures » (exceptions : collection, proche, type que la
// marque ne fait pas), voiture rendue trop tôt, cadeaux de partenaires (montre, vols, séjour).

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { brandMakes, modelFor } = require(path.join(__dirname, '..', 'src/world/carLineups.js'));
const { ensureLifeHub, carClauseFor, buyAsset, sellAsset, grantSponsorPerks, pushGiftedSponsorCar } = require(path.join(__dirname, '..', 'src/world/lifeHub.js'));

function career(sponsors) {
  const st = { careerId: 'p1', snapshot: { gameDate: '2027-08-01', season: '2027', player: { name: 'T' } }, profile: { followers: 50000 } };
  const hub = ensureLifeHub(st, st.snapshot);
  Object.assign(hub, { calibrated: true, cash: 5000000, stage: 'established', sponsors });
  return { st, hub };
}
const sp = (brand, cats) => ({ id: `sp_${brand}`, brand, category: cats[0], categories: cats, fee: 100000, until: '2029-06-30' });
let n = 0;
const newId = () => `id${++n}`;

test('gammes : la marque fait ce type ou pas ; collection jamais concernée', () => {
  assert.ok(brandMakes('Ferrari', 'car_supercar'));
  assert.ok(!brandMakes('Ferrari', 'car_minivan'));
  assert.ok(!brandMakes('Toyota', 'car_classic'));
  assert.strictEqual(modelFor('Toyota', 'car_minivan', 0), 'Proace Verso');
});

test('clause : remise chez le sponsor, exceptions sans pénalité, autre marque = confiance en baisse', () => {
  const { st, hub } = career([sp('Toyota', ['automotive'])]);
  assert.deepStrictEqual(carClauseFor(st, 'car_suv'), { brand: 'Toyota', sponsorId: 'sp_Toyota', model: 'RAV4' });
  assert.strictEqual(carClauseFor(st, 'car_supercar'), null, 'Toyota ne fait pas de supercar : pas de clause');
  assert.strictEqual(carClauseFor(st, 'car_classic'), null, 'voiture de collection : pas de clause');
  assert.throws(() => buyAsset(st, { catalogId: 'car_suv' }, '2027-08-02', newId), /Choisis comment acheter/);
  const before = hub.cash;
  buyAsset(st, { catalogId: 'car_suv', carDeal: 'sponsor' }, '2027-08-02', newId);
  const suv = hub.assets.find((a) => a.catalogId === 'car_suv');
  assert.strictEqual(suv.brand, 'Toyota');
  assert.strictEqual(before - hub.cash, suv.price, '−20 % payé');
  const trust = hub.meters.sponsors;
  buyAsset(st, { catalogId: 'car_minivan', carDeal: 'family' }, '2027-08-02', newId);
  assert.strictEqual(hub.meters.sponsors, trust, 'pour un proche : rien');
  buyAsset(st, { catalogId: 'car_sedan', carDeal: 'rival' }, '2027-08-02', newId);
  assert.strictEqual(hub.meters.sponsors, trust - 6, 'autre marque : confiance en baisse');
});

test('voiture offerte rendue dans les 90 jours : un peu de confiance en moins ; plus tard, rien', () => {
  const { st, hub } = career([sp('BMW', ['automotive'])]);
  const car = pushGiftedSponsorCar(st, hub, hub.sponsors[0], 'car_suv', 'annual', '2027-08-01', newId, 'X5');
  assert.strictEqual(car.name, 'BMW X5');
  const t = hub.meters.sponsors;
  sellAsset(st, car.id, '2027-09-01');
  assert.strictEqual(hub.meters.sponsors, t - 2);
  const later = pushGiftedSponsorCar(st, hub, hub.sponsors[0], 'car_suv', 'annual', '2027-08-01', newId, 'X3');
  sellAsset(st, later.id, '2028-02-01');
  assert.strictEqual(hub.meters.sponsors, t - 2);
});

test('cadeaux : une montre par saison ; vols et séjour en choix, jamais en double', () => {
  const { st, hub } = career([sp('Rolex', ['watches']), sp('Emirates', ['airlines']), sp('Accor', ['hospitality'])]);
  const first = grantSponsorPerks(st, hub, st.snapshot, '2027-08-01', newId);
  assert.strictEqual(hub.assets.filter((a) => a.catalogId === 'sponsor_watch').length, 1);
  assert.deepStrictEqual(st.calendar.pendingDecisions.filter((d) => d.kind === 'sponsor_perk').map((d) => d.perkKey).sort(), ['flight', 'hotel']);
  assert.strictEqual(first.length, 3);
  assert.strictEqual(grantSponsorPerks(st, hub, st.snapshot, '2027-09-01', newId).length, 0, 'une fois par saison');
  const perk = st.calendar.pendingDecisions.find((d) => d.kind === 'sponsor_perk');
  assert.ok(perk.choices.every((c) => !c.cost && Object.values(c.effects).every((v) => v >= 0)), 'que du positif');
});
