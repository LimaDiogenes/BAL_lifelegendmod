'use strict';
// Événements à soi (2.0) : pas de doublon quand le calendrier arrive pile au jour ; après le choix, une scène qui nomme
// tous les présents et des réactions ; des messages privés des présents (sur Kop) un ou deux jours après ; un proche
// pas vu depuis longtemps finit par le dire.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { collectDueDecisions, resolveCalendarDecision } = require(path.join(__dirname, '..', 'src/world/calendarEvents.js'));
const { deliverFollowUps } = require(path.join(__dirname, '..', 'src/world/eventAftermath.js'));

const career = () => ({
  careerId: 'ea1',
  profile: { handle: 'rui', displayName: 'Rui', followers: 20000 },
  snapshot: { gameDate: '2027-11-01', club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures: [] },
  persona: { circle: { family: [{ name: 'Ana', role: 'Sister', kopPersonality: 'playful' }, { name: 'Zé', role: 'Father' }], friends: [{ name: 'Leo', role: 'Friend', kopPersonality: 'hype' }, { name: 'Maria', role: 'Friend', kopPersonality: 'supportive' }] } },
  calendar: { simDate: '2027-11-01', customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [], assets: [], ledger: [], recentEvents: [], scenes: [] },
  feed: [],
});
let n = 0;
const newId = () => `id${++n}`;

test('le jour même : une seule décision par événement', () => {
  const st = career();
  st.calendar.customEvents.push({ id: 'e1', date: '2027-11-03', title: 'Family lunch', category: 'family', people: [{ name: 'Ana' }, { name: 'Zé' }, { name: 'Leo' }], aiChoices: [{ id: 'ai_0', kind: 'warm', label: 'With everyone' }, { id: 'ai_1', kind: 'quiet', label: 'Quietly' }] });
  collectDueDecisions(st, st.snapshot, '2027-11-03', { newId });
  collectDueDecisions(st, st.snapshot, '2027-11-03', { newId });
  assert.strictEqual(st.calendar.pendingDecisions.filter((d) => d.id === 'dec_cust_e1').length, 1);
});

test('après le choix : une scène qui nomme tout le monde, des réactions, puis des messages des présents', () => {
  const st = career();
  st.calendar.customEvents.push({ id: 'e2', date: '2027-11-03', title: 'Birthday dinner', category: 'family', people: [{ name: 'Ana' }, { name: 'Zé' }, { name: 'Leo' }, { name: 'Maria' }], aiChoices: [{ id: 'ai_0', kind: 'public', label: 'Post a photo' }, { id: 'ai_1', kind: 'quiet', label: 'Quietly' }] });
  collectDueDecisions(st, st.snapshot, '2027-11-03', { newId });
  resolveCalendarDecision(st, 'dec_cust_e2', 'ai_0', '2027-11-03', { language: 'en', newId });
  const scene = st.lifeHub.scenes[0];
  assert.ok(scene, 'une scène');
  for (const name of ['Ana', 'Zé', 'Leo', 'Maria']) assert.ok(scene.narrative.includes(name), `${name} dans le récit`);
  assert.ok(scene.reactions.some((r) => r.authorName === 'Ana' || r.authorName === 'Leo'), 'des proches réagissent');
  assert.strictEqual(deliverFollowUps(st, '2027-11-03', { language: 'en', newId }), 0, 'pas le jour même');
  deliverFollowUps(st, '2027-11-05', { language: 'en', newId });
  const writers = (st.dms || []).filter((t) => t.messages.length).map((t) => t.name).sort();
  assert.deepStrictEqual(writers, ['Ana', 'Leo', 'Maria'], 'seuls ceux qui sont sur Kop écrivent');
});

test('un proche pas vu depuis 60 jours le dit, une fois par mois au plus', () => {
  const st = career();
  st.circleTime = { Leo: '2027-08-01' };
  st.circleStartedOn = '2027-08-01';
  deliverFollowUps(st, '2027-11-01', { language: 'fr', newId });
  const first = (st.dms || []).filter((t) => t.messages.length).length;
  assert.strictEqual(first, 1);
  deliverFollowUps(st, '2027-11-10', { language: 'fr', newId });
  assert.strictEqual((st.dms || []).reduce((s, t) => s + t.messages.length, 0), 1);
});
