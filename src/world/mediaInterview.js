'use strict';
// Les interviews avec de vraies questions (2.0, round C). Le jour d'une interview acceptée (agent ou club), en plus des
// trois réponses rapides, « Répondre aux questions » ouvre un écran de questions. Il choisit d'où elles viennent :
// - questions de l'app (sans IA) : 5 questions tirées d'une grande banque selon l'émission ; il répond par un ton ;
// - questions de l'IA : l'IA écrit les questions, il répond librement, l'IA en tire un portrait pour le journal (world.js).
// Dans les deux cas, ses tons font les effets, puis la décision du jour se règle comme les autres (scène, Kop, souvenirs).

const { INTERVIEW_QUESTIONS, INTERVIEW_THEMES } = require('./texts/interviews');
const { pickFresh } = require('./lifeScenes');

const LANGS = ['fr', 'en', 'pt', 'es', 'it', 'de'];
const fill = (l, t, vars) => String(t[l] || t.en || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));

// Ce que chaque ton rapporte, par réponse (les totaux sont plafonnés).
const TONES = {
  open: { fans: 1, media: 1 },
  safe: { manager: 1 },
  bold: { media: 2 },
  team: { squad: 1 },
};
const CAP = 4;
const QUESTION_COUNT = 5;

/** The pending interview decision (agent or club) with this id. */
function interviewDecision(state, decisionId) {
  return (state.calendar?.pendingDecisions || []).find((d) => d.id === decisionId && d.kind === 'media_event') || null;
}

/** Five questions from the built-in bank, themed by the kind of show, without repeats. */
function builtinInterviewQuestions(state, dec, language = 'en') {
  const l = LANGS.includes(language) ? language : 'en';
  const themes = INTERVIEW_THEMES[dec.mediaKind] || ['general'];
  const order = [themes[0], themes[1] || 'general', themes[0], 'general', themes[2] || themes[1] || themes[0]];
  const out = [];
  order.slice(0, QUESTION_COUNT).forEach((theme, i) => {
    const list = INTERVIEW_QUESTIONS[theme] || INTERVIEW_QUESTIONS.general;
    let q = pickFresh(state, `iv:${theme}`, list, `${dec.id}|${i}`);
    for (let k = 0; k < list.length && out.some((x) => x.en === q.en); k += 1) q = list[(list.indexOf(q) + 1) % list.length];
    out.push(q);
  });
  const vars = { C: state.snapshot?.club?.name || '', O: dec.title || '' };
  return out.map((q) => ({ question: fill(l, q, vars), en: q.en }));
}

/** Opens (or reopens) the interview for this decision. `questions` = strings (AI) or built-in objects. */
function startInterview(state, decisionId, source, questions) {
  const dec = interviewDecision(state, decisionId);
  if (!dec) throw new Error('Élément introuvable.');
  state.interview = {
    id: `iv_${decisionId}`,
    decisionId,
    source: source === 'ai' ? 'ai' : 'builtin',
    outlet: dec.title || '',
    mediaKind: dec.mediaKind || 'podcast',
    date: dec.date || '',
    questions: questions.map((q) => (typeof q === 'string' ? { question: q } : q)).filter((q) => q.question),
    status: 'open',
  };
  return state.interview;
}

/** Effects from his tones (one per question; '' or 'skip' = no answer). Two bold answers or more can backfire. */
function interviewOutcome(tones = []) {
  const effects = {};
  const count = { open: 0, safe: 0, bold: 0, team: 0 };
  for (const t of tones) {
    if (!TONES[t]) continue;
    count[t] += 1;
    for (const [k, v] of Object.entries(TONES[t])) effects[k] = Math.max(-CAP, Math.min(CAP, (effects[k] || 0) + v));
  }
  const answered = Object.values(count).reduce((a, b) => a + b, 0);
  const dominant = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return {
    effects,
    answered,
    dominant: answered ? dominant[0] : '',
    risk: count.bold >= 2 ? { chance: 0.15 + 0.1 * (count.bold - 2), effects: { media: -3, manager: -1 }, followUp: 'fu_viral_quote' } : null,
  };
}

const KIND_EN = { podcast: 'podcast', tv_show: 'TV show', club_channel: 'club channel interview', magazine_cover: 'magazine interview', documentary: 'documentary', charity_stream: 'charity live stream' };

/** Turns the answers into the decision's "Answer questions" choice, ready for resolveCalendarDecision. */
function prepareInterviewChoice(state, tones) {
  const iv = state.interview;
  if (!iv || iv.status !== 'open') throw new Error('Élément introuvable.');
  const dec = interviewDecision(state, iv.decisionId);
  if (!dec) throw new Error('Élément introuvable.');
  const out = interviewOutcome(tones);
  const choice = dec.choices.find((c) => c.id === 'media_qa');
  if (!choice) throw new Error('Élément introuvable.');
  choice.effects = out.effects;
  if (out.risk) choice.risk = { ...out.risk, memory: `A bold answer he gave on ${dec.title} went viral for the wrong reasons` };
  else delete choice.risk;
  const style = { open: 'opened up', safe: 'kept it professional', bold: 'did not hold back', team: 'talked up the group' }[out.dominant] || 'answered a few questions';
  choice.memory = `Gave ${dec.title} a full ${KIND_EN[dec.mediaKind] || 'interview'} and ${style}`;
  iv.tones = tones;
  iv.outcome = out;
  return { dec, choice, outcome: out };
}

module.exports = { TONES, interviewDecision, builtinInterviewQuestions, startInterview, interviewOutcome, prepareInterviewChoice };
