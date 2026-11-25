'use strict';
// Où vivent les proches et quand il peut rentrer (2.0) : pas d'aller-retour à la maison pour une journée (il faut 4 jours
// sans match d'affilée), les proches qui vivent loin viennent le voir ou écrivent de loin, et rien du système ne tombe un
// jour de match (ses propres événements, oui).

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const req = (p) => require(path.join(__dirname, '..', p));

const { canTravelHome, freeRunAround, nextFreeDay } = req('src/world/lifeGeo.js');
const { seedPersonaEvents } = req('src/world/personaEvents.js');
const { collectObligationDecisions, collectDueDecisions } = req('src/world/calendarEvents.js');
const { buildSceneAndReactions } = req('src/world/lifeScenes.js');
const { deliverFollowUps } = req('src/world/eventAftermath.js');
const { normalizePersona } = req('src/world/persona.js');

// matches every 3 days from 2027-11-01 (busy) and then nothing after 2027-11-20 (a long break)
const fixtures = ['2027-11-01', '2027-11-04', '2027-11-07', '2027-11-10', '2027-11-13', '2027-11-16', '2027-11-19'].map((date, i) => ({ id: `f${i}`, date, home: 'Lyon', away: `Opp${i}`, played: false }));
const career = (extra = {}) => ({
  careerId: 'geo1',
  profile: { handle: 'rui', displayName: 'Rui' },
  snapshot: { gameDate: '2027-11-02', club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures },
  persona: { roots: { hometown: 'Braga' }, circle: { family: [{ name: 'Ana', role: 'Sister', lives: 'hometown', kopPersonality: 'playful' }], friends: [{ name: 'Leo', role: 'Friend', lives: 'city', kopPersonality: 'hype' }] } },
  calendar: { simDate: '2027-11-02', customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [], assets: [], ledger: [], recentEvents: [], scenes: [], obligations: [] },
  feed: [],
  ...extra,
});
let n = 0;
const newId = () => `g${++n}`;

test('un voyage à la maison seulement avec 4 jours sans match d’affilée', () => {
  const st = career();
  assert.strictEqual(freeRunAround(st, '2027-11-04'), 0, 'jour de match');
  assert.strictEqual(freeRunAround(st, '2027-11-05'), 2);
  assert.strictEqual(canTravelHome(st, '2027-11-05'), false);
  assert.strictEqual(canTravelHome(st, '2027-11-24'), true, 'la trêve');
  assert.strictEqual(nextFreeDay(st, '2027-11-07'), '2027-11-08');
});

test('ville natale en pleine série de matchs : la maison vient à lui, pas d’aller-retour', () => {
  const st = career();
  const occupied = new Set(fixtures.map((f) => f.date));
  const [ev] = seedPersonaEvents(st, st.snapshot, '2027-11-02', occupied, newId);
  assert.strictEqual(ev.eventKey, 'persona_roots');
  for (const id of ev.choiceIds) assert.ok(['home_visit', 'home_call', 'home_taste', 'home_kids_remote', 'home_radio'].includes(id), id);
  const st2 = career({ snapshot: { gameDate: '2027-11-21', club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures } });
  const [ev2] = seedPersonaEvents(st2, st2.snapshot, '2027-11-21', new Set(), newId);
  assert.strictEqual(ev2.eventKey, 'persona_hometown', 'pendant la trêve, il peut rentrer');
});

test('les obligations des partenaires et les événements du système ne tombent jamais un jour de match', () => {
  const st = career();
  st.lifeHub.obligations.push({ id: 'ob1', sponsorId: 's1', brand: 'Nike', kind: 'kit_shoot', dueDate: '2027-11-04', status: 'pending' });
  assert.strictEqual(collectObligationDecisions(st, '2027-11-04').filter((d) => d.kind === 'obligation').length, 0);
  assert.strictEqual(st.lifeHub.obligations[0].dueDate, '2027-11-05');
  assert.strictEqual(collectObligationDecisions(st, '2027-11-05').filter((d) => d.kind === 'obligation').length, 1);
  st.calendar.systemEvents.push({ id: 'sx', eventKey: 'charity_gala', date: '2027-11-07', category: 'charity', title: 'charity_gala', systemGenerated: true });
  collectDueDecisions(st, st.snapshot, '2027-11-07', { newId });
  assert.ok(!st.calendar.pendingDecisions.some((d) => d.id === 'dec_sys_sx'));
  assert.strictEqual(st.calendar.systemEvents.find((e) => e.id === 'sx').date, '2027-11-08');
});

test('ses propres événements restent possibles un jour de match', () => {
  const st = career();
  st.calendar.customEvents.push({ id: 'own', date: '2027-11-04', title: 'Team dinner', category: 'family', people: [] });
  assert.ok(collectObligationDecisions(st, '2027-11-04').some((d) => d.id === 'dec_cust_own'));
});

test('« Temps en famille » : une sœur qui vit à Braga vient le voir, il ne « rentre » pas pour la journée', () => {
  for (let i = 0; i < 6; i += 1) {
    const st = career();
    st.persona.circle.friends = []; // seulement Ana
    const sc = buildSceneAndReactions(st, st.snapshot, { kind: 'action', refId: 'inner_circle', date: '2027-11-05', companion: `x${i}` }, { language: 'en', newId });
    assert.ok(!/back in Braga/.test(sc.narrative), sc.narrative);
    assert.ok(/over from Braga/.test(sc.narrative), sc.narrative);
  }
});

test('le lieu est gardé dans le profil et donné à l’IA sans nom de ville', () => {
  const p = normalizePersona({ circle: { family: [{ name: 'Ana', role: 'Sister', lives: 'abroad' }, { name: 'Zé', role: 'Father', lives: 'mars' }] } });
  assert.strictEqual(p.circle.family[0].lives, 'abroad');
  assert.strictEqual(p.circle.family[1].lives, undefined);
});

test('un proche qui vit loin dit qu’il lui manque après 30 jours (60 pour les autres)', () => {
  const st = career();
  st.persona.circle.friends = [{ name: 'Leo', role: 'Friend', lives: 'city', kopPersonality: 'hype' }];
  st.circleTime = { Ana: '2027-10-01', Leo: '2027-10-01' };
  deliverFollowUps(st, '2027-11-05', { language: 'en', newId });
  const writers = (st.dms || []).filter((t) => t.messages.length).map((t) => t.name);
  assert.deepStrictEqual(writers, ['Ana']);
});
