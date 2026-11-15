'use strict';
// Son chant de supporters (idée proposée le 2026-11-13, retenue pour la 1.1.0) : quand il devient le chouchou d'un club,
// les supporters lui inventent un chant, une fois par club. Le code décide quand (un triplé, son but dans un derby gagné,
// le vote du joueur du mois, trois matchs de suite avec un but) ; l'édition l'écrit, dans la même requête (le blog le
// présente, un supporter le chante sur Kop), puis il reste dans la mémoire du monde.

// Rend { why } quand un chant est dû à cette synchro, sinon null.
function chantDue(state, s, changes, { won_vote = false, derby = null } = {}) {
  const ref = s?.club?.ref;
  if (ref == null || state.chants?.[ref]) return null;
  const club = s.club.name;
  const mine = (changes?.newResults || []).filter((r) => (r.home === club || r.away === club) && r.me);
  const label = (r) => `${r.home} ${r.score[0]}-${r.score[1]} ${r.away}`;
  const hat = mine.find((r) => (r.me.goals || 0) >= 3);
  if (hat) return { why: `his hat-trick in ${label(hat)}` };
  if (derby?.status === 'just_played') {
    const r = mine.find((x) => x.date === derby.date && (x.me.goals || 0) > 0);
    const won = r && (r.home === club ? r.score[0] > r.score[1] : r.score[1] > r.score[0]);
    if (won) return { why: `his goal in the derby win, ${label(r)} (${derby.name})` };
  }
  if (won_vote) return { why: "he has just been elected the fans' player of the month" };
  const last3 = (s.fixtures || []).filter((f) => f.played && f.me).sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
  if (last3.length === 3 && last3.every((f) => (f.me.goals || 0) > 0) && mine.length) return { why: 'he has scored in three matches in a row' };
  return null;
}

// Garde le chant écrit par l'édition ({ title, lines }), s'il tient debout : un titre, 2 à 6 vers courts.
function keepChant(state, s, chant, { why, gameDate }) {
  const title = String(chant?.title || '').trim().slice(0, 80);
  const lines = (Array.isArray(chant?.lines) ? chant.lines : []).map((l) => String(l || '').trim()).filter(Boolean).slice(0, 6).map((l) => l.slice(0, 90));
  if (!title || lines.length < 2) return null;
  state.chants = { ...(state.chants || {}), [s.club.ref]: { club: s.club.name, title, lines, why, gameDate } };
  return state.chants[s.club.ref];
}

module.exports = { chantDue, keepChant };
