'use strict';
// Son chant de supporters (1.1.0) : quand il est dû (une fois par club), ce que l'édition doit écrire, ce qui est gardé.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { chantDue, keepChant } = require(path.join(ROOT, 'src/world/chant.js'));
const prompts = require(path.join(ROOT, 'src/ai/prompts.js'));

const s = (fixtures = []) => ({ club: { name: 'AS Nancy Lorraine', ref: 7 }, fixtures });
const res = (date, home, away, score, goals) => ({ date, home, away, score, me: { goals, assists: 0, minutes: 90 } });

test('chant : un triplé, un but dans un derby gagné, le vote des supporters, trois matchs de suite ; une fois par club', () => {
  const hat = res('2026-11-07', 'AS Nancy Lorraine', 'Rodez AF', [4, 1], 3);
  assert.match(chantDue({}, s(), { newResults: [hat] }).why, /hat-trick in AS Nancy Lorraine 4-1 Rodez AF/);
  const derbyWin = res('2026-11-07', 'FC Metz', 'AS Nancy Lorraine', [0, 1], 1);
  assert.match(chantDue({}, s(), { newResults: [derbyWin] }, { derby: { status: 'just_played', date: '2026-11-07', name: 'the Lorraine derby' } }).why, /derby win/);
  assert.strictEqual(chantDue({}, s(), { newResults: [{ ...derbyWin, score: [2, 1] }] }, { derby: { status: 'just_played', date: '2026-11-07', name: 'the Lorraine derby' } }), null, 'derby perdu');
  assert.match(chantDue({}, s(), { newResults: [] }, { won_vote: true }).why, /fans' player of the month/);
  const scored = (date) => ({ date, played: true, me: { goals: 1 } });
  assert.match(chantDue({}, s([scored('2026-10-20'), scored('2026-10-27'), scored('2026-11-03')]), { newResults: [res('2026-11-03', 'AS Nancy Lorraine', 'Pau FC', [1, 0], 1)] }).why, /three matches in a row/);
  assert.strictEqual(chantDue({ chants: { 7: { title: 'Déjà' } } }, s(), { newResults: [hat] }), null, 'déjà un chant pour ce club');
  assert.strictEqual(chantDue({}, s(), { newResults: [res('2026-11-07', 'AS Nancy Lorraine', 'Rodez AF', [1, 0], 1)] }), null);
});

test('chant : l’édition l’écrit dans la même requête ; un chant qui tient debout est gardé', () => {
  assert.match(prompts.editionSystem({ language: 'fr' }, { transversale: true, chant: true }), /"fan_chant": \{"title": string, "lines"/);
  assert.match(prompts.editionSystem({ language: 'fr' }, { transversale: true, chant: true }), /Original words only: never the words or the title of a real song/);
  assert.doesNotMatch(prompts.editionSystem({ language: 'fr' }, { transversale: true }), /FAN CHANT/);
  const state = {};
  assert.strictEqual(keepChant(state, s(), { title: 'Seul', lines: ['un vers'] }, { why: 'x', gameDate: '2026-11-07' }), null, 'deux vers au moins');
  const kept = keepChant(state, s(), { title: ' Allez Ilan ', lines: ['Il court, il court', '', 'Ilan marque toujours', 'Picot chante pour lui'] }, { why: 'x', gameDate: '2026-11-07' });
  assert.deepStrictEqual([kept.title, kept.lines.length, state.chants[7].club], ['Allez Ilan', 3, 'AS Nancy Lorraine']);
});
