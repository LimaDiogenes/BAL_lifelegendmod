'use strict';
// Interviews personnelles (2.0) : offres construites par l'app, une à la fois, variées ; acceptée = au calendrier un jour
// sans match ; négociation une fois ; le jour venu, trois choix avec le cachet.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { tickMediaOffers, answerMediaOffer, mediaDecision } = require(path.join(__dirname, '..', 'src/world/mediaOffers.js'));
const { collectObligationDecisions, resolveCalendarDecision } = require(path.join(__dirname, '..', 'src/world/calendarEvents.js'));

const career = () => ({
  careerId: 'm1',
  snapshot: { gameDate: '2027-10-01', club: { name: 'Lyon' }, fixtures: [{ date: '2027-10-06' }, { date: '2027-10-07' }] },
  calendar: { customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, stage: 'established', cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [{ id: 's', brand: 'Acme' }], assets: [], ledger: [], recentEvents: [] },
});
let n = 0;
const newId = () => `x${++n}`;

test('une offre à la fois, puis une pause ; jamais un jour de match ; variété des formats', () => {
  const st = career();
  const [o] = tickMediaOffers(st, '2027-10-01', newId);
  assert.ok(o && o.status === 'open');
  assert.ok(!['2027-10-06', '2027-10-07'].includes(o.date));
  assert.strictEqual(tickMediaOffers(st, '2027-10-02', newId).length, 0, 'pause');
  const kinds = new Set([o.kind]);
  let day = '2027-10-01';
  for (let i = 0; i < 12; i += 1) {
    day = st.lifeHub.nextMediaOfferOn;
    for (const x of st.lifeHub.mediaOffers) x.status = 'declined';
    const [next] = tickMediaOffers(st, day, newId);
    if (next) kinds.add(next.kind);
  }
  assert.ok(kinds.size >= 4, `formats variés (${[...kinds]})`);
});

test('accepter : au calendrier ; le jour venu, trois choix payés ; négocier une seule fois', () => {
  const st = career();
  const [o] = tickMediaOffers(st, '2027-10-01', newId);
  o.fee = 20000;
  answerMediaOffer(st, o.id, 'negotiate', '2027-10-01', newId);
  assert.ok(o.negotiated && (o.fee === 26000 || o.fee === 20000));
  assert.throws(() => answerMediaOffer(st, o.id, 'negotiate', '2027-10-01', newId));
  answerMediaOffer(st, o.id, 'accept', '2027-10-01', newId);
  const ev = st.calendar.customEvents.find((e) => e.mediaOfferId === o.id);
  assert.ok(ev && ev.date === o.date);
  const [dec] = collectObligationDecisions(st, o.date);
  assert.strictEqual(dec.kind, 'media_event');
  assert.strictEqual(dec.choices.length, 3);
  assert.ok(dec.choices.some((c) => c.id === 'media_safe'));
  resolveCalendarDecision(st, dec.id, 'media_safe', o.date, { newId });
  assert.strictEqual(st.lifeHub.cash, o.fee);
});

test('sans partenaire, pas de choix « partenaires » ; refuser ne coûte rien', () => {
  const st = career();
  st.lifeHub.sponsors = [];
  for (let i = 0; i < 20; i += 1) {
    const d = mediaDecision({ id: `e${i}`, date: '2027-10-10', title: 'X', mediaKind: 'podcast', fee: 0 }, st);
    assert.ok(!d.choices.some((c) => c.id === 'media_promo'));
  }
  const [o] = tickMediaOffers(st, '2027-10-01', newId);
  const before = JSON.stringify(st.lifeHub.meters);
  answerMediaOffer(st, o.id, 'decline', '2027-10-01', newId);
  assert.strictEqual(JSON.stringify(st.lifeHub.meters), before);
});
