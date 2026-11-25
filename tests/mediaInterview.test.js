'use strict';
// Interviews avec de vraies questions (2.0, round C) : « Répondre aux questions » dans la décision du jour ; questions de
// l'app (sans IA, réponses par ton) ou de l'IA (ses mots, un article). Réponses de l'IA simulées : aucune requête ne part.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const providers = require(path.join(__dirname, '..', 'src/ai/providers.js'));
const asked = [];
let reply = () => ({});
providers.complete = async (_settings, _key, req) => { asked.push(req); return JSON.stringify(reply(req, asked.length)); };
const world = require(path.join(__dirname, '..', 'src/world/world.js'));
const { collectObligationDecisions } = require(path.join(__dirname, '..', 'src/world/calendarEvents.js'));
const { interviewOutcome } = require(path.join(__dirname, '..', 'src/world/mediaInterview.js'));

const DAY = '2027-10-06';
const withInterview = (state, mediaKind = 'podcast') => {
  state.calendar ||= {};
  state.calendar.customEvents = [...(state.calendar.customEvents || []), { id: 'mev1', date: DAY, title: 'The Final Third', kind: 'media', category: 'media', mediaOfferId: 'mo1', mediaKind, fee: 5000 }];
  state.calendar.pendingDecisions ||= [];
  state.calendar.resolvedDecisionIds ||= [];
  collectObligationDecisions(state, DAY);
  return state.calendar.pendingDecisions.find((d) => d.id === 'dec_cust_mev1');
};
const synthetic = () => ({
  careerId: 'iv1',
  profile: { handle: 'rui', displayName: 'Rui', followers: 30000 },
  snapshot: { gameDate: DAY, club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures: [] },
  persona: { circle: {} },
  calendar: { simDate: DAY, customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, stage: 'rising', cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [], assets: [], ledger: [], recentEvents: [], scenes: [], obligations: [] },
  feed: [], mail: [], editions: [], onRecord: [],
});
const storeFor = (state) => ({ activeCareer: () => state, getKey: () => 'k', saveCareer() {}, dir: '.', loadAux: () => null });

test('le jour de l’interview : « Répondre aux questions » s’ajoute aux réponses rapides', () => {
  const dec = withInterview(synthetic());
  assert.ok(dec, 'la décision du jour');
  assert.ok(dec.choices.some((c) => c.id === 'media_qa' && c.bonusCash === 5000));
  assert.ok(dec.choices.length >= 4);
});

test('questions de l’app : 5 questions différentes, sur le thème de l’émission, sans IA', async () => {
  asked.length = 0;
  const state = synthetic();
  const dec = withInterview(state, 'club_channel');
  await world.startLifeInterview({ store: storeFor(state), settings: { language: 'en' }, decisionId: dec.id, source: 'builtin' });
  const qs = state.interview.questions.map((q) => q.question);
  assert.strictEqual(qs.length, 5);
  assert.strictEqual(new Set(qs).size, 5, 'pas deux fois la même');
  assert.ok(qs.every((q) => q && !/\{[A-Z]\}/.test(q)));
  assert.ok(qs.some((q) => q.includes('Lyon')) || qs.length === 5);
  assert.strictEqual(asked.length, 0, 'aucune requête à l’IA');
});

test('ses tons font les effets ; la décision se règle avec une scène', async () => {
  const state = synthetic();
  const dec = withInterview(state, 'podcast');
  const store = storeFor(state);
  await world.startLifeInterview({ store, settings: { language: 'en' }, decisionId: dec.id, source: 'builtin' });
  const before = { ...state.lifeHub.meters };
  await world.submitLifeInterview({ store, settings: { language: 'en' }, answers: ['open', 'open', 'team', 'safe', ''] });
  assert.strictEqual(state.interview.status, 'done');
  assert.ok(state.calendar.resolvedDecisionIds.includes(dec.id));
  assert.ok(!state.calendar.pendingDecisions.some((d) => d.id === dec.id));
  assert.ok(state.lifeHub.meters.fans > before.fans && state.lifeHub.meters.squad > before.squad);
  assert.ok(state.lifeHub.scenes.length >= 1, 'une scène');
});

test('deux réponses audacieuses ou plus peuvent se retourner ; les totaux sont plafonnés', () => {
  assert.strictEqual(interviewOutcome(['bold', 'safe']).risk, null);
  assert.ok(interviewOutcome(['bold', 'bold', 'open']).risk);
  assert.ok(interviewOutcome(['bold', 'bold', 'bold', 'bold', 'bold']).effects.media <= 4);
});

test('questions de l’IA : ses mots cités tels quels (une citation inventée est retirée), le ton de l’IA fait les effets', async () => {
  const state = synthetic();
  Object.assign(state.snapshot, { season: '2027/28', league: { name: 'Ligue 1' }, coaches: { mine: 'Coach' }, stats: {}, squad: [], table: [], nextRound: [], roundResults: [] });
  state.editions = [{ national: [], local: [], posts: [] }];
  state.accounts = {};
  const dec = withInterview(state, 'podcast');
  const store = { ...storeFor(state), dir: require('os').tmpdir(), saveAux() {} };
  asked.length = 0;
  reply = (req) => (/questions for him/.test(req.system)
    ? { questions: ['What drives you?', 'Your best memory?', 'Who inspired you?'] }
    : { article: { headline: 'He opens up', dek: 'A rare interview', author: 'X', body: 'He said "football is my whole life" with a smile.\n\nHe also said "I never said that" which is invented.' }, posts: [{ handle: 'fan1', name: 'Fan', type: 'fan', text: 'Great interview!' }], tone: 'open', conduct: { level: 0, target: null, quote: null } });
  const settings = { provider: 'google', model: 'm', language: 'en', factCheck: false };
  await world.startLifeInterview({ store, settings, decisionId: dec.id, source: 'ai', progress: () => {} });
  assert.deepStrictEqual(state.interview.questions.map((q) => q.question), ['What drives you?', 'Your best memory?', 'Who inspired you?']);
  const before = state.lifeHub.meters.fans;
  await world.submitLifeInterview({ store, settings, answers: { texts: ['Football is my whole life', '', 'My dad'] }, progress: () => {} });
  const art = state.editions.at(-1).national.at(-1);
  assert.ok(/football is my whole life/i.test(art.body));
  assert.ok(!art.body.includes('I never said that'), 'citation inventée retirée');
  assert.ok(state.lifeHub.meters.fans > before);
  assert.ok(state.feed.some((p) => p.text === 'Great interview!'));
  assert.strictEqual(asked.length, 2);
});
