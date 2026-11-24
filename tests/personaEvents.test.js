'use strict';
// Ce que le joueur écrit fait vivre le calendrier (2.0) : événements de passion / ville natale / idole…, retrouvailles
// avec le premier club, choix variés et toujours positifs ; événements à soi avec des proches (choix de l'IA ou de secours).

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { seedPersonaEvents, personaDecision, PERSONA_CHOICES, normalizeAiChoices, fallbackEventChoices, eventChoicesToDecision } = require(path.join(__dirname, '..', 'src/world/personaEvents.js'));

const career = () => ({
  careerId: 'pe1',
  persona: { flavor: { hobby: 'golf', idol: 'Zidane', dream: '' }, roots: { hometown: 'Santos', academy: 'Portuguesa' } },
  calendar: { systemEvents: [], customEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
});
let n = 0;
const newId = () => `e${++n}`;

test('un seul événement de personnage à la fois, jamais un jour de match, puis une pause de 18 à 30 jours', () => {
  const st = career();
  const occupied = new Set(['2027-03-05', '2027-03-06']);
  const first = seedPersonaEvents(st, { fixtures: [] }, '2027-03-01', occupied, newId);
  assert.strictEqual(first.length, 1);
  assert.ok(!['2027-03-05', '2027-03-06'].includes(first[0].date));
  assert.ok(['persona_hobby', 'persona_hometown', 'persona_idol'].includes(first[0].eventKey), 'seulement ce qui est rempli');
  assert.strictEqual(seedPersonaEvents(st, { fixtures: [] }, '2027-03-02', occupied, newId).length, 0);
  assert.ok(st.calendar.nextPersonaEventOn > first[0].date);
});

test('le match contre le premier club amène des retrouvailles la veille', () => {
  const st = career();
  const added = seedPersonaEvents(st, { club: { name: 'Lyon' }, fixtures: [{ date: '2027-03-10', home: 'Lyon', away: 'Portuguesa FC', played: false }] }, '2027-03-01', new Set(['2027-03-10']), newId);
  const ret = added.find((e) => e.eventKey === 'first_club_return');
  assert.ok(ret && ret.date === '2027-03-09');
});

test('des choix positifs, variés d’une fois à l’autre', () => {
  for (const c of Object.values(PERSONA_CHOICES)) assert.ok(Object.values(c.effects).every((v) => v > 0) && c.memory.length >= 3);
  const st = career();
  const sets = new Set();
  for (let i = 0; i < 6; i += 1) {
    st.calendar.systemEvents = [];
    st.calendar.nextPersonaEventOn = null;
    const [ev] = seedPersonaEvents(st, { fixtures: [] }, `2027-0${1 + (i % 9)}-1${i}`, new Set(), newId);
    const dec = personaDecision(ev);
    assert.ok(dec.choices.length >= 3);
    sets.add(dec.choices.map((c) => c.id).join(','));
  }
  assert.ok(sets.size > 1, 'pas toujours les mêmes choix');
});

test('événement avec des proches : choix de l’IA validés, sinon choix de secours traduits', () => {
  assert.strictEqual(normalizeAiChoices({ choices: [{ kind: 'warm', label: 'Dinner with Ana' }] }), null, 'au moins deux');
  const ai = normalizeAiChoices({ choices: [{ kind: 'warm', label: 'Dinner with Ana' }, { kind: 'evil', label: 'x' }, { kind: 'public', label: 'Post a photo' }] });
  assert.deepStrictEqual(ai.map((c) => c.kind), ['warm', 'public']);
  const ev = { id: 'c1', date: '2027-03-03', title: 'Birthday dinner', people: [{ name: 'Ana' }, { name: 'Leo' }] };
  const fb = fallbackEventChoices(ev);
  assert.strictEqual(fb.length, 3);
  assert.ok(fb.every((c) => /^fb_[a-z]+_[01]$/.test(c.id) && c.who === 'Ana & Leo'));
  ev.aiChoices = ai;
  const choices = eventChoicesToDecision(ev);
  assert.ok(choices.every((c) => Object.values(c.effects).every((v) => v > 0)));
});
