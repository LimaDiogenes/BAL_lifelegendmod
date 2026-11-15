'use strict';
// Le joueur du mois de son club, élu par les supporters (idée proposée le 2026-11-13, retenue pour la 1.1.0) : à la
// première synchro d'un mois, les trois meilleurs joueurs du club le mois d'avant (notes du jeu, buts, passes ; au moins la
// moitié des matchs du mois à 45 minutes ou plus) passent au vote, un sondage du compte officiel du club, déjà dépouillé.
// Les voix suivent les performances, un peu sa popularité à lui, et un hasard stable. Aucune IA.

const { postTexts, deName } = require('./postTexts');

const hash = (v) => { let h = 2166136261; for (const c of String(v)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const monthBefore = (iso) => { const [y, m] = String(iso || '').slice(0, 7).split('-').map(Number); return y && m ? (m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`) : null; };
// Pourcentages entiers qui font 100 (plus fort reste).
function percentsOf(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / sum) * 100), out = exact.map(Math.floor);
  [...exact.keys()].sort((a, b) => (exact[b] - out[b]) - (exact[a] - out[a])).slice(0, 100 - out.reduce((a, b) => a + b, 0)).forEach((k) => { out[k]++; });
  return out;
}

// Rend { post: { text, poll }, winner, won, month } la première fois qu'un mois fini peut être voté, sinon null.
// state.fanVote retient le dernier mois traité ; state.fanAwards, ses titres.
function fanVote(state, s, { language = 'fr', handle = null } = {}) {
  const month = monthBefore(s?.gameDate);
  if (!month || !s.club?.name || state.fanVote?.month >= month) return null;
  state.fanVote = { month };
  const games = (s.fixtures || []).filter((f) => f.played && String(f.date).slice(0, 7) === month && Array.isArray(f.clubLineup) && f.clubLineup.length);
  if (games.length < 2) return null;
  const acc = new Map();
  for (const f of games) for (const p of f.clubLineup) {
    if (!p?.name || !(p.minutes >= 45) || !Number.isFinite(p.rating)) continue;
    const a = acc.get(p.name) || { name: p.name, rated: 0, sum: 0, goals: 0, assists: 0 };
    a.rated++; a.sum += p.rating; a.goals += p.goals || 0; a.assists += p.assists || 0;
    acc.set(p.name, a);
  }
  const min = Math.max(2, Math.ceil(games.length / 2));
  const top = [...acc.values()].filter((a) => a.rated >= min).map((a) => ({ ...a, avg: a.sum / a.rated }))
    .sort((a, b) => b.avg - a.avg || (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 3);
  if (top.length < 3) return null;
  const me = s.player?.name;
  const seed = hash(`${state.careerId || ''}|${month}`);
  const weights = top.map((a, k) => Math.exp((a.avg * 2 + a.goals * 1.2 + a.assists * 0.8 + (a.name === me ? 0.4 : 0) + ((seed >>> (k * 5)) % 7) / 4) / 2));
  const percents = percentsOf(weights);
  const w = percents.indexOf(Math.max(...percents));
  const winner = top[w];
  const won = winner.name === me;
  const L = postTexts(language);
  const monthLabel = L.date(`${month}-15`, { month: 'long' });
  const who = won && handle ? `${winner.name} (@${handle})` : winner.name;
  state.fanVote = { month, winner: winner.name, percent: percents[w], won };
  if (won) state.fanAwards = [...(state.fanAwards || []), { month, club: s.club.name, percent: percents[w] }];
  return {
    month, monthLabel, winner: winner.name, percent: percents[w], won,
    post: { text: L.fanVote(monthLabel, who, percents[w], deName), poll: { options: top.map((a) => a.name), percents, votes: 900 + (seed % 5200) } },
  };
}

module.exports = { fanVote, monthBefore };
