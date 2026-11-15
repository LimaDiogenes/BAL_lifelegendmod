'use strict';
// L'interview exclusive (1.1.0) : quand la demande arrive, et le mail qui devient la demande d'entretien.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { interviewDue, markInterview } = require(path.join(ROOT, 'src/world/interview.js'));
const prompts = require(path.join(ROOT, 'src/ai/prompts.js'));

const base = () => ({ editions: [{}, {}, {}], mail: [], writers: { national_desk: [{ name: 'Marc Lhermitte' }] } });
const s = (gameDate) => ({ gameDate });

test('interview : après trois éditions, une fois par mois de jeu, jamais deux en attente', () => {
  assert.deepStrictEqual(interviewDue(base(), s('2026-11-01')), { journalist: 'Marc Lhermitte', outlet: 'La Transversale' });
  assert.strictEqual(interviewDue({ ...base(), editions: [{}, {}] }, s('2026-11-01')), null, 'trop tôt dans la carrière');
  assert.strictEqual(interviewDue({ ...base(), interviewAt: '2026-10-15' }, s('2026-11-01')), null, 'moins d’un mois');
  assert.ok(interviewDue({ ...base(), interviewAt: '2026-10-01' }, s('2026-11-01')));
  assert.strictEqual(interviewDue({ ...base(), mail: [{ interview: { status: 'open' } }] }, s('2026-11-01')), null, 'une demande attend déjà sa réponse');
});

test('interview : le mail du journaliste devient la demande, avec ses questions', () => {
  const state = { ...base(), mail: [{ id: 'm1', role: 'journalist', from: 'Marc Lhermitte', messages: [{ gameDate: '2026-11-01' }] }] };
  assert.strictEqual(markInterview(state, { journalist: 'Marc Lhermitte' }, ['Q1 ?', 'Q2 ?'], '2026-11-01'), null, 'au moins trois questions');
  const m = markInterview(state, { journalist: 'Marc Lhermitte' }, ['Q1 ?', 'Q2 ?', 'Q3 ?', 'Q4 ?'], '2026-11-01');
  assert.deepStrictEqual([m.id, m.interview.status, m.interview.questions.length, state.interviewAt], ['m1', 'open', 4, '2026-11-01']);
  const sys = prompts.editionSystem({ language: 'fr' }, { transversale: true, interview: true });
  assert.match(sys, /"interview_questions": \[string, string, string, string\]/);
  assert.match(sys, /INTERVIEW: CHANGES\.interview_request asks for an exclusive interview/);
  assert.doesNotMatch(prompts.editionSystem({ language: 'fr' }, { transversale: true }), /INTERVIEW:/);
});

test('vérification des faits : une réponse coupée garde ses corrections complètes', () => {
  const { salvageCorrections } = require(path.join(ROOT, 'src/ai/factcheck.js'));
  const cut = '{"corrections": [ {"item": "national.0", "field": "body", "find": "8 buts", "replace": "9 buts", "reason": "total {x}"}, {"item": "posts.2", "field": "text", "find": "3-1", "replace": "2-1", "reason": "score"}, {"item": "posts.4", "field": "te';
  assert.deepStrictEqual(salvageCorrections(cut).map((c) => c.replace), ['9 buts', '2-1']);
  assert.strictEqual(salvageCorrections('pas de réponse'), null);
  assert.match(prompts.editionSystem({ language: 'fr' }, { transversale: true, interview: true }), /Keep one form of address from the first line to the last question/);
});
