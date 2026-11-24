'use strict';
// Obligations des partenaires (2.0) : décisions du calendrier à leur date ; y aller paie, décaler une fois, trois
// absences font partir le partenaire.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { collectObligationDecisions, resolveCalendarDecision } = require(path.join(__dirname, '..', 'src/world/calendarEvents.js'));

function career() {
  return {
    careerId: 'c1',
    snapshot: { gameDate: '2027-09-10', fixtures: [{ date: '2027-09-13' }] },
    profile: { followers: 10000 },
    calendar: { pendingDecisions: [], resolvedDecisionIds: [], customEvents: [], systemEvents: [] },
    lifeHub: {
      calibrated: true, cash: 0, ap: 2, maxAp: 2, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 },
      sponsors: [{ id: 'sp1', brand: 'Acme', category: 'lifestyle', categories: ['lifestyle'], fee: 100000, until: '2029-06-30' }],
      obligations: [], offers: [], biddingWars: [], oneTimeOffers: [], assets: [], ledger: [], recentEvents: [],
    },
  };
}
const ob = (id, dueDate) => ({ id, sponsorId: 'sp1', brand: 'Acme', category: 'lifestyle', kind: 'vip_event', dueDate, rewardCash: 4000, status: 'pending' });
let n = 0;
const newId = () => `x${++n}`;

test('une obligation devient une décision à sa date (pas avant), et y aller paie sans rien coûter', () => {
  const s = career();
  s.lifeHub.obligations.push(ob('o1', '2027-09-12'));
  assert.strictEqual(collectObligationDecisions(s, '2027-09-11').length, 0);
  const [dec] = collectObligationDecisions(s, '2027-09-12');
  assert.ok(dec && dec.kind === 'obligation');
  assert.deepStrictEqual(dec.choices.map((c) => c.id), ['ob_all_in', 'ob_standard', 'ob_reschedule', 'ob_skip']);
  assert.ok(dec.choices.filter((c) => c.id === 'ob_all_in' || c.id === 'ob_standard').every((c) => !c.cost && Object.values(c.effects).every((v) => v > 0)), 'y aller n’est jamais puni');
  assert.strictEqual(collectObligationDecisions(s, '2027-09-12').length, 0, 'pas de doublon');
  resolveCalendarDecision(s, dec.id, 'ob_standard', '2027-09-12', { newId });
  assert.strictEqual(s.lifeHub.obligations[0].status, 'done');
  assert.strictEqual(s.lifeHub.cash, 4000);
});

test('décaler : une seule fois, hors jour de match ; la décision revient à la nouvelle date', () => {
  const s = career();
  s.lifeHub.obligations.push(ob('o1', '2027-09-10'));
  const [dec] = collectObligationDecisions(s, '2027-09-10');
  resolveCalendarDecision(s, dec.id, 'ob_reschedule', '2027-09-10', { newId });
  const o = s.lifeHub.obligations[0];
  assert.strictEqual(o.status, 'pending');
  assert.notStrictEqual(o.dueDate, '2027-09-13', 'pas un jour de match');
  assert.ok(o.dueDate > '2027-09-10');
  assert.strictEqual(s.lastDecisionOutcome.rescheduledTo, o.dueDate);
  const [again] = collectObligationDecisions(s, o.dueDate);
  assert.ok(again && !again.choices.some((c) => c.id === 'ob_reschedule'), 'une seule fois');
});

test('trois absences : le partenaire s’en va', () => {
  const s = career();
  for (const [i, d] of ['2027-09-10', '2027-09-11', '2027-09-12'].entries()) {
    s.lifeHub.obligations.push(ob(`o${i}`, d));
    const [dec] = collectObligationDecisions(s, d);
    resolveCalendarDecision(s, dec.id, 'ob_skip', d, { newId });
  }
  assert.strictEqual(s.lifeHub.sponsors.length, 0);
  assert.strictEqual(s.lastDecisionOutcome.contractEnded, 'Acme');
});
