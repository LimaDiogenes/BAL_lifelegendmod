'use strict';
// Pression médiatique et degré de drame, calculés sur la situation réelle de la carrière (plus de curseurs) :
// market = combien de monde regarde (taille du club et du championnat, Europe, sélection, notoriété du joueur),
// drama = l'enjeu du moment (course au titre, maintien, coupe, fin de mercato, crise). Chacun de 0 à 100.

const { realClubHandle } = require('./clubAccounts');
const { spotlightLevel } = require('./dramaEngine');

const TOP5 = new Set([17, 18, 19, 20, 50]);                  // Premier League, Serie A, LaLiga, Ligue 1, Bundesliga
const SECOND_TIERS = new Set([79, 80, 81, 82]);              // Championship, LaLiga 2, Ligue 2, Serie B
// Clubs dont chaque geste fait la une (vrais comptes X, en minuscules).
const GIANTS = new Set(['psg_inside', 'realmadrid', 'fcbarcelona', 'fcbayern', 'manutd', 'lfc', 'juventusfc', 'acmilan', 'inter', 'mancity',
  'chelseafc', 'arsenal', 'atleti', 'bvb', 'slbenfica', 'fcporto', 'afcajax', 'om_officiel', 'ol', 'flamengo', 'bocajrsoficial', 'carpoficial',
  'galatasaray', 'fenerbahce', 'celticfc', 'rangersfc', 'spursofficial', 'sscnapoli', 'officialasroma']);
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const isWin = (c) => /^[vw]/i.test(String(c || ''));

function toneContext({ snapshot, state, dramaArcs = [] }) {
  const why = { market: [], drama: [] };
  const club = snapshot.club || {};
  const leagueId = snapshot.league?.id;

  // ---- Pression médiatique ----
  let market = TOP5.has(leagueId) ? 55 : SECOND_TIERS.has(leagueId) ? 30 : 40;
  why.market.push(TOP5.has(leagueId) ? `grand championnat (${snapshot.league.name})` : SECOND_TIERS.has(leagueId) ? `deuxième division (${snapshot.league?.name})` : `championnat : ${snapshot.league?.name || '?'}`);
  const handle = String(realClubHandle(club) || '').toLowerCase();
  if (GIANTS.has(handle)) { market += 25; why.market.push(`club géant (${club.name})`); }
  const comps = new Set((snapshot.fixtures || []).map((f) => f.competition));
  if ([...comps].some((c) => /Champions League|Libertadores/i.test(c))) { market += 15; why.market.push('il joue la Ligue des champions'); }
  else if ([...comps].some((c) => /Europa League/i.test(c))) { market += 8; why.market.push('il joue la Ligue Europa'); }
  if (snapshot.nationalTeam?.inSquad) { market += 10; why.market.push(`international (${snapshot.nationalTeam.name})`); }
  const followers = state?.profile?.followers || 0;
  if (followers >= 1000000) { market += 15; why.market.push('star des réseaux (plus d’un million d’abonnés)'); }
  else if (followers >= 200000) { market += 8; why.market.push('joueur très suivi'); }

  // ---- Enjeu, drame ----
  let drama = 25;
  const table = snapshot.table || [];
  const row = table.find((r) => r.mine);
  if (row && table.length >= 8) {
    const n = table.length, rounds = 2 * (n - 1), left = rounds - row.p;
    const late = left <= Math.max(6, rounds / 4);
    const leader = table[0], safe = table[n - 4];
    if (row.pos <= 2 && late && (leader.pts - row.pts <= 6)) { drama += 30; why.drama.push(`course au titre (${row.pos}e, ${left} journées à jouer)`); }
    else if (row.pos <= 4 && late) { drama += 15; why.drama.push(`lutte pour l’Europe ou la montée (${row.pos}e)`); }
    if (row.pos > n - 3 && row.p >= 6) { drama += late ? 30 : 20; why.drama.push(`zone rouge (${row.pos}e${late ? ', fin de saison' : ''})`); }
    else if (safe && row.pts - safe.pts <= 3 && row.p >= 10) { drama += 12; why.drama.push('maintien pas assuré'); }
    if (left > 0 && left <= 3) { drama += 10; why.drama.push('dernières journées'); }
  }
  const next = snapshot.next;
  if (next && next.competitionId !== leagueId) { drama += 18; why.drama.push(`prochain match en ${next.competition}`); }
  // Mercato : derniers jours de la fenêtre, ou transfert en cours.
  const open = (snapshot.windows || []).find((w) => snapshot.gameDate >= w.open && snapshot.gameDate <= w.close);
  if (open && daysBetween(snapshot.gameDate, open.close) <= 5) { drama += 15; why.drama.push('fin du mercato'); }
  if (state?.agent?.plannedMove || state?.agent?.request) { drama += 10; why.drama.push('son avenir se joue (transfert)'); }
  // Crise : supporters furieux.
  if ((state?.fanMood?.level || 0) >= 3) { drama += 15; why.drama.push('crise : supporters furieux'); }
  else if ((state?.fanMood?.level || 0) === 2) { drama += 6; why.drama.push('supporters en colère'); }

  // Domination / phase faste : la loupe médiatique et les débats de « tall-poppy » font monter la pression.
  const formAllWins = (row?.form || []).length >= 5 && row.form.slice(-5).every(isWin);
  if (row && ((row.l === 0 && (row.p || 0) >= 8) || formAllWins)) {
    drama += 14;
    why.drama.push('série dominante : cible dans le dos');
  }
  const total = snapshot.stats?.total || {};
  const apps = Number(total.apps) || 0;
  const contrib = (Number(total.goals) || 0) + (Number(total.assists) || 0);
  if (apps >= 5 && (contrib / apps >= 1.2 || (Number(total.avgRating) || 0) >= 7.5)) {
    drama += 12;
    why.drama.push('forme exceptionnelle sous haute surveillance');
  }
  if (state?.lifeHub?.stage === 'superstar' || (state?.lifeHub?.sponsors?.length || 0) >= 4) {
    drama += 10;
    why.drama.push('exposition médiatique et commerciale maximale');
  }
  const activeArcs = (Array.isArray(dramaArcs) ? dramaArcs : []).filter((a) => a && a.status === 'active');
  if (activeArcs.length) {
    const maxHeat = Math.max(...activeArcs.map((a) => a.heat || 1));
    drama += Math.min(24, maxHeat * 8);
    why.drama.push('débats médiatiques et pression du projecteur');
  }

  const spotlight = spotlightLevel({
    state,
    snapshot,
    mem: { dramaArcs: activeArcs, pressBehavior: { skips: state?.dramaSnapshot?.pressSkips || 0 } },
  });

  return {
    market: clamp(market),
    drama: clamp(drama),
    spotlight: clamp(spotlight),
    why: { market: why.market.slice(0, 4), drama: why.drama.slice(0, 5) },
  };
}

module.exports = { toneContext };
