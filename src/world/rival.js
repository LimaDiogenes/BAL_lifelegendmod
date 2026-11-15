'use strict';
// Le rival (idée proposée le 2026-11-13, retenue pour la 1.1.0) : un joueur de son championnat, d'un autre club, qui joue
// à la même ligne que lui (gardien, défense, milieu, attaque) avec des chiffres proches. Choisi par le code dans les
// scores du jeu (aucune IA), gardé toute la saison ; le monde les compare : La Transversale (« le duel »), Kop (« lui ou
// toi ? »), le Vestiaire (quand le rival a brillé ou joué contre eux) et Scoreline (l'onglet Rival de sa page).

const LINE_WORDS = { att: 'forward', mid: 'midfielder', def: 'defender', gk: 'goalkeeper' };

// Le championnat du joueur dans les scores, avec tous ses joueurs notés : [[nom, ref, matchs, notés, moyenne, buts,
// passes, ligne]] (src/world/scores.js).
const mainLeague = (scores) => (scores?.comps || []).find((c) => c.main && c.kind === 'league' && Array.isArray(c.players)) || null;
const rowOf = (r) => (r ? { name: r[0], ref: r[1], apps: r[2], rated: r[3], avg: r[4], goals: r[5], assists: r[6], line: r[7] } : null);
const statsOf = (r) => (r ? { apps: r.apps, rated: r.rated, avg: r.avg, goals: r.goals, assists: r.assists } : null);

// Plus c'est petit, plus ils se ressemblent : les buts d'abord pour un attaquant, la note pour les autres.
function distance(me, c) {
  const avg = Math.abs((c.avg || 0) - (me.avg || 0));
  if (me.line === 'att') return Math.abs(c.goals - me.goals) + Math.abs(c.assists - me.assists) * 0.5 + avg * 3;
  if (me.line === 'mid') return avg * 5 + Math.abs(c.goals + c.assists - me.goals - me.assists) * 0.6;
  return avg * 8 + Math.abs(c.rated - me.rated) * 0.1;
}

// Son match le plus récent depuis une date (les compositions des 45 derniers jours sont dans les scores).
function lastMatchOf(scores, name, ref, since, myRef) {
  let best = null;
  (scores.matches || []).forEach((m, i) => {
    const [date, , , , home, away, gh, ga] = m;
    if (gh == null || (since && date <= since) || (home !== ref && away !== ref)) return;
    const lu = scores.details?.[i]?.lu;
    const e = lu && (lu[home === ref ? 0 : 1] || []).find((x) => x[0] === name);
    if (!e || (best && best.date >= date)) return;
    const team = (r) => scores.teams?.[r]?.[0] || '';
    best = { date, home: team(home), away: team(away), score: [gh, ga], minutes: e[2], rating: e[3], goals: e[4], assists: e[5], against_us: home === myRef || away === myRef };
  });
  return best;
}

// Leurs confrontations de la saison dans le championnat : le score, et ce que chacun y a fait.
function headToHead(scores, lgIndex, myRef, myName, rival) {
  const out = [];
  (scores.matches || []).forEach((m, i) => {
    const [date, , ci, , home, away, gh, ga] = m;
    if (ci !== lgIndex || gh == null || ![home, away].includes(myRef) || ![home, away].includes(rival.ref)) return;
    const lu = scores.details?.[i]?.lu || [[], []];
    const line = (side, n) => { const e = (lu[side] || []).find((x) => x[0] === n); return e ? { minutes: e[2], rating: e[3], goals: e[4], assists: e[5] } : null; };
    const team = (r) => scores.teams?.[r]?.[0] || '';
    out.push({ date, home: team(home), away: team(away), score: [gh, ga], him: line(home === myRef ? 0 : 1, myName), rival: line(home === rival.ref ? 0 : 1, rival.name) });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Met à jour state.rival à la synchro. since : la date de l'édition précédente (son dernier match vient d'après).
// Rend le rival, ou null (pas encore assez joué, ou pas de championnat dans les scores).
function updateRival(state, scores, snapshot, { since = null } = {}) {
  const lg = mainLeague(scores);
  const myName = snapshot.player?.name, myRef = snapshot.club?.ref;
  if (!lg || !myName) return state.rival || null;
  const rows = lg.players.map(rowOf);
  const me = rows.find((r) => r.name === myName && r.ref === myRef) || rows.find((r) => r.name === myName) || null;
  const key = `${lg.name}|${snapshot.season || ''}`;
  const prev = state.rival?.key === key ? state.rival : null;
  // Le rival de la saison reste le même tant qu'il joue dans ce championnat, même s'il change de club (pas le sien).
  let pick = prev ? rows.find((r) => r.name === prev.name && r.ref !== myRef) : null;
  if (!pick) {
    if (!me || me.rated < 3) { state.rival = null; return null; }
    const pool = rows.filter((r) => r.name && r.ref !== myRef && r.line === me.line && r.rated >= Math.max(3, Math.floor(me.rated * 0.5)));
    pick = pool.map((r) => ({ r, d: distance(me, r) })).sort((a, b) => a.d - b.d || (b.r.avg || 0) - (a.r.avg || 0))[0]?.r || null;
    if (!pick) { state.rival = null; return null; }
  }
  const lgIndex = scores.comps.indexOf(lg);
  const last = lastMatchOf(scores, pick.name, pick.ref, since, myRef);
  const same = prev && prev.name === pick.name;
  // Ce qui fait parler de lui aujourd'hui : il vient d'être désigné, il a joué contre son club, il a brillé, ou l'un a
  // dépassé l'autre au nombre de buts depuis la dernière édition.
  const sign = (a, b) => Math.sign((a || 0) - (b || 0));
  const moment = !same ? 'new'
    : last?.against_us ? 'against_us'
    : last && (last.goals >= 2 || last.goals + last.assists >= 3 || last.rating >= 8) ? 'big_game'
    : me && prev.me && sign(pick.goals, me.goals) !== 0 && sign(pick.goals, me.goals) !== sign(prev.stats?.goals, prev.me?.goals) ? 'overtaken'
    : null;
  state.rival = {
    key, league: lg.name, name: pick.name, ref: pick.ref, team: scores.teams?.[pick.ref]?.[0] || '', line: pick.line,
    since: same ? prev.since : snapshot.gameDate, stats: statsOf(pick), me: statsOf(me), last, moment,
    h2h: headToHead(scores, lgIndex, myRef, myName, pick),
  };
  return state.rival;
}

// Ce que l'IA sait du rival (FACTS.rival).
function rivalFacts(r) {
  if (!r) return undefined;
  const season = (x) => (x ? { matches: x.apps, rated_matches: x.rated, average_rating: x.avg, goals: x.goals, assists: x.assists } : null);
  return {
    name: r.name, club: r.team, league: r.league, plays_as: LINE_WORDS[r.line] || r.line, rival_since: r.since,
    rival_season: season(r.stats), his_season: season(r.me),
    ...(r.last ? { rival_last_match: { date: r.last.date, match: `${r.last.home} ${r.last.score[0]}-${r.last.score[1]} ${r.last.away}`, minutes: r.last.minutes, rating: r.last.rating, goals: r.last.goals, assists: r.last.assists, against_his_club: r.last.against_us || undefined } } : {}),
    ...(r.h2h?.length ? { head_to_head: r.h2h.map((m) => ({ date: m.date, match: `${m.home} ${m.score[0]}-${m.score[1]} ${m.away}`, him: m.him, rival: m.rival })) } : {}),
    ...(r.moment ? { today: { new: 'just named his rival by the press', against_us: 'the rival just played against his club', big_game: 'the rival just had a big match', overtaken: 'one of them just overtook the other in goals' }[r.moment] } : {}),
  };
}

// Le rival fait-il parler de lui dans cette édition ? Toujours quand il se passe quelque chose, sinon de temps en temps.
const rivalInNews = (r, editions, every) => Boolean(r) && (Boolean(r.moment) || editions % every === 0);

module.exports = { updateRival, rivalFacts, rivalInNews, mainLeague, LINE_WORDS };
