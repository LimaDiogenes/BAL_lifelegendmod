'use strict';
// Les retrouvailles avec un ancien club (idée proposée le 2026-11-13, retenue pour la 1.1.0) : quand son club affronte
// un club où il a joué (dans les 7 jours, ou depuis 4 jours au plus), le monde le raconte : La Transversale (« le
// retour »), Kop (un supporter de l'ancien club, un ancien coéquipier encore là-bas), le Vestiaire. Aucune IA : ses anciens
// clubs viennent de ses saisons (state.seasons), ses anciens coéquipiers du groupe Vestiaire de l'époque.

const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5);

// Ses anciens clubs : saisons, matchs, buts, passes, dernier match avec eux. Le club d'avant la carrière (sans chiffres) aussi.
function formerClubs(state, s) {
  const cur = s?.club?.name;
  const map = new Map();
  for (const [key, e] of Object.entries(state?.seasons || {})) {
    if (!e?.club || e.club === cur) continue;
    const m = map.get(e.club) || { club: e.club, ref: Number(String(key).split('|')[1]) || null, seasons: [], matches: 0, goals: 0, assists: 0, last: null };
    m.seasons.push(e.season);
    m.matches += e.stats?.apps || 0; m.goals += e.stats?.goals || 0; m.assists += e.stats?.assists || 0;
    if (e.lastGameDate && (!m.last || e.lastGameDate > m.last)) m.last = e.lastGameDate;
    map.set(e.club, m);
  }
  const before = s?.player?.history?.previousClub;
  if (before && before !== cur && !map.has(before)) map.set(before, { club: before, ref: null, seasons: [], matches: 0, goals: 0, assists: 0, last: null, before_career: true });
  return [...map.values()];
}

// Ses anciens coéquipiers encore dans ce club : ceux du groupe Vestiaire de l'époque qui figurent dans l'effectif du club
// aujourd'hui (scores du jeu), cinq au plus.
function teammatesStillThere(state, ref, squad) {
  const group = (state?.huddles || []).find((g) => g.clubRef === ref && !g.scope);
  if (!group || !Array.isArray(squad)) return [];
  const now = new Set(squad);
  return (group.players || []).filter((p) => now.has(p)).slice(0, 5);
}

// Les retrouvailles du moment : { club, date, status: 'upcoming'|'just_played', in_days|result, his_time_there, ... }, ou null.
function reunionFacts(state, s, { squadOf = () => null } = {}) {
  const club = s?.club?.name;
  if (!club || !s.fixtures) return null;
  const former = formerClubs(state, s);
  if (!former.length) return null;
  const opp = (f) => (f.home === club ? f.away : f.home);
  const of = (f) => former.find((c) => c.club === opp(f));
  const next = s.fixtures.filter((f) => !f.played && f.date >= s.gameDate && days(s.gameDate, f.date) <= 7 && of(f)).sort((p, q) => p.date.localeCompare(q.date))[0];
  const last = s.fixtures.filter((f) => f.played && f.date <= s.gameDate && days(f.date, s.gameDate) <= 4 && of(f)).sort((p, q) => q.date.localeCompare(p.date))[0];
  const f = next || last;
  if (!f) return null;
  const c = of(f);
  const ref = c.ref ?? (f.home === club ? f.awayRef : f.homeRef);
  const mates = teammatesStillThere(state, ref, squadOf(ref));
  return {
    club: c.club, date: f.date, competition: f.competition, venue: f.home === club ? 'home' : 'away', status: next ? 'upcoming' : 'just_played',
    ...(next ? { in_days: days(s.gameDate, f.date) } : { result: `${f.home} ${f.score[0]}-${f.score[1]} ${f.away}`, ...(f.me ? { his_match: { minutes: f.me.minutes, goals: f.me.goals, assists: f.me.assists, rating: f.me.rating } } : {}) }),
    his_time_there: c.before_career ? 'his club before this career (no numbers in the save)' : { seasons: c.seasons, matches: c.matches, goals: c.goals, assists: c.assists, last_match_there: c.last },
    ...(mates.length ? { former_teammates_still_there: mates } : {}),
  };
}

module.exports = { formerClubs, reunionFacts };
