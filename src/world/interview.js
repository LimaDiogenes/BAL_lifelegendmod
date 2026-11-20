'use strict';
// L'interview exclusive (idée proposée le 2026-11-13, retenue pour la 1.1.0) : environ une fois par mois, un journaliste
// de La Transversale lui demande un entretien par mail, avec quatre questions (écrites par l'édition, dans sa requête). Sa
// réponse devient un long article « L'entretien », ses mots tels quels, et Kop réagit : la requête de la réponse au mail,
// rien de plus.

const { resolveNationalPaper } = require('./nationalPaper');

const days = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const EVERY_DAYS = 30;

// La demande d'entretien de cette synchro, ou null : après trois éditions, pas d'entretien en attente, un mois de jeu
// depuis la dernière demande. Le journaliste : le chroniqueur du journal national.
function interviewDue(state, s) {
  if ((state.editions || []).length < 3 || !s?.gameDate) return null;
  if ((state.mail || []).some((m) => m.interview?.status === 'open')) return null;
  if (state.interviewAt && days(state.interviewAt, s.gameDate) < EVERY_DAYS) return null;
  const journalist = state.writers?.national_desk?.[0]?.name || state.writers?.national_columnist;
  const paper = state.nationalPaper || resolveNationalPaper({ snapshot: s, override: state.nationalPaperOverride });
  return journalist ? { journalist, outlet: paper?.name || 'La Transversale' } : null;
}

// Après l'édition : le mail du journaliste devient la demande d'entretien (ses quatre questions), s'il a été écrit.
function markInterview(state, due, questions, gameDate) {
  const qs = (Array.isArray(questions) ? questions : []).map((q) => String(q || '').trim()).filter(Boolean).slice(0, 5);
  const mail = [...(state.mail || [])].reverse().find((m) => m.role === 'journalist' && m.from === due.journalist && m.messages?.[0]?.gameDate === gameDate);
  if (!mail || qs.length < 3) return null;
  mail.interview = { status: 'open', questions: qs, asked: gameDate };
  state.interviewAt = gameDate;
  return mail;
}

module.exports = { interviewDue, markInterview, EVERY_DAYS };
