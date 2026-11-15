'use strict';
// Les derbys (idée proposée le 2026-11-13, retenue pour la 1.1.0) : quand son club va jouer un derby (dans les 7 jours)
// ou vient d'en jouer un (depuis 4 jours au plus), tout le monde le vit : La Transversale (l'avant-match du derby, le
// récit qui dit ce qu'il signifie), le blog et Kop (banderoles, chants, fierté de la ville), le Vestiaire. Aucune IA :
// le code reconnaît le derby (une liste des grands derbys, sinon deux clubs qui portent le nom de la même ville).

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// [nom (en anglais : la langue des consignes), côté A, côté B] ; chaque côté reconnaît le nom du club dans le jeu.
const DERBIES = [
  ['the Lorraine derby', /\bnancy\b/, /\bmetz\b/],
  ['Le Classique', /paris saint-germain|\bpsg\b/, /marseille/],
  ['the Rhône derby', /\blyon/, /saint-etienne/],
  ['the Côte d’Azur derby', /\bnice\b/, /monaco/],
  ['the Breton derby', /rennes|\bbrest\b|lorient|guingamp|nantes/, /rennes|\bbrest\b|lorient|guingamp|nantes/],
  ['the derby du Nord', /\blille\b|\blosc\b/, /\blens\b/],
  ['the Corsican derby', /bastia/, /ajaccio/],
  ['the Normandy derby', /\bcaen\b|le havre|\brouen\b|quevilly/, /\bcaen\b|le havre|\brouen\b|quevilly/],
  ['the Alpine derby', /grenoble/, /annecy/],
  ['the Occitanie derby', /montpellier|\bnimes\b|toulouse/, /montpellier|\bnimes\b|toulouse/],
  ['the Merseyside derby', /liverpool/, /everton/],
  ['the North London derby', /arsenal/, /tottenham/],
  ['the Tyne–Wear derby', /newcastle/, /sunderland/],
  ['El Clásico', /real madrid/, /^(?!.*espanyol).*barcelona/],
  ['the Madrid derby', /real madrid/, /atletico/],
  ['the Barcelona derby', /^(?!.*espanyol).*barcelona/, /espanyol/],
  ['the Seville derby', /^(?!.*betis).*sevilla/, /betis/],
  ['the Basque derby', /athletic/, /real sociedad/],
  ['the Derby della Madonnina', /\bac milan\b|^milan$/, /\binter\b|internazionale/],
  ['the Derby della Capitale', /\broma\b/, /lazio/],
  ['the Derby della Mole', /juventus/, /torino/],
  ['the Derby della Lanterna', /genoa/, /sampdoria/],
  ['the Derby d’Italia', /\binter\b|internazionale/, /juventus/],
  ['the Revierderby', /dortmund/, /schalke/],
  ['Der Klassiker', /bayern/, /dortmund/],
  ['the Nordderby', /hamburg/, /werder|bremen/],
  ['the Lisbon derby', /benfica/, /sporting/],
  ['O Clássico', /\bporto\b/, /benfica/],
  ['De Klassieker', /ajax/, /feyenoord/],
  ['the Old Firm', /celtic/, /rangers/],
  ['the Intercontinental derby', /galatasaray/, /fenerbahce/],
  ['the Superclásico', /boca/, /river plate/],
];
// Des mots qui ne disent pas une ville (« United », « City »…) : deux clubs qui les partagent ne font pas un derby.
const NOT_A_CITY = /^(fc|ac|as|sc|cf|afc|cd|ud|sd|rc|ss|us|usl|ea|af|sv|fk|sk|bk|if|club|foot|football|futbol|calcio|sport|sports|sporting|real|atletico|athletic|deportivo|olympique|olympic|racing|stade|union|united|city|town|county|rovers|wanderers|albion|hotspur|inter|internazionale|dynamo|dinamo|spartak|lokomotiv|saint|sankt|san|santa|de|du|des|la|le|les|el|al|del|der|di|da|do|and|the|\d+)$/;
const cityWords = (name) => plain(name).split(/[\s-]+/).filter((w) => w.length >= 4 && !NOT_A_CITY.test(w));

// Le nom du derby entre deux clubs, ou null.
function derbyOf(a, b) {
  if (!a || !b || a === b) return null;
  const [x, y] = [plain(a), plain(b)];
  const known = DERBIES.find(([, p, q]) => (p.test(x) && q.test(y)) || (p.test(y) && q.test(x)));
  if (known) return known[0];
  const shared = cityWords(a).find((w) => cityWords(b).includes(w));
  return shared ? `the ${shared[0].toUpperCase()}${shared.slice(1)} derby` : null;
}

const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5);
// Le derby du moment pour son club, d'après le calendrier de la sauvegarde : à venir (7 jours au plus) ou tout juste
// joué (4 jours au plus) ; avec leurs rencontres de la saison. null sinon.
function derbyFacts(s) {
  const club = s?.club?.name;
  if (!club || !s.fixtures) return null;
  const opp = (f) => (f.home === club ? f.away : f.home);
  const next = s.fixtures.filter((f) => !f.played && f.date >= s.gameDate && days(s.gameDate, f.date) <= 7).sort((p, q) => p.date.localeCompare(q.date))[0];
  const last = s.fixtures.filter((f) => f.played && f.date <= s.gameDate && days(f.date, s.gameDate) <= 4).sort((p, q) => q.date.localeCompare(p.date))[0];
  const pick = next && derbyOf(club, opp(next)) ? { f: next, status: 'upcoming' } : last && derbyOf(club, opp(last)) ? { f: last, status: 'just_played' } : null;
  if (!pick) return null;
  const { f, status } = pick;
  const other = opp(f);
  const earlier = s.fixtures.filter((x) => x.played && x !== f && opp(x) === other).map((x) => ({ date: x.date, competition: x.competition, match: `${x.home} ${x.score[0]}-${x.score[1]} ${x.away}` }));
  return {
    name: derbyOf(club, other), opponent: other, date: f.date, competition: f.competition, venue: f.home === club ? 'home' : 'away', status,
    ...(status === 'upcoming' ? { in_days: days(s.gameDate, f.date) } : { result: `${f.home} ${f.score[0]}-${f.score[1]} ${f.away}` }),
    ...(earlier.length ? { earlier_meetings_this_season: earlier } : {}),
  };
}

module.exports = { derbyOf, derbyFacts };
