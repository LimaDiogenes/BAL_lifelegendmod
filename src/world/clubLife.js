'use strict';
// Le club vit sur les réseaux (2.0, round B) : son compte officiel poste presque tous les jours (entraînement, compte à
// rebours, jour de match, le joueur à l'honneur, les supporters, le club dans la ville), et son service communication
// demande souvent de petites choses (1 à 2 fois par semaine : une vidéo, une photo, une story…) en décision rapide à
// 3 choix. Les grandes demandes (Club TV, Q&R avec les supporters : 1 à 2 par mois) passent par Mail (mediaOffers.js).
// Dire non de temps en temps ne coûte rien ; trop souvent, le club le remarque (−1 coach). Aucune requête IA.

const { CLUB_POSTS, CLUB_ASKS, CLUB_ASK_POSTS } = require('./texts/club');
const { clubAuthor } = require('./clubPosts');
const { pickFresh, pushSimpleScene } = require('./lifeScenes');
const { queueLifeDecision } = require('./lifeHub');
const { matchDates } = require('./lifeGeo');

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysApart = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const LANGS = ['fr', 'en', 'pt', 'es', 'it', 'de'];
const fill = (l, t, vars) => String(t[l] || t.en || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));

const PASS_WINDOW = 45; // jours
// Réglage « Vie du club » (2.0) : low / normal / high
const LEVELS = {
  low: { postSkip: 45, askEvery: [6, 4], bigEvery: [24, 11] },
  normal: { postSkip: 70, askEvery: [3, 3], bigEvery: [14, 11] },
  high: { postSkip: 90, askEvery: [2, 2], bigEvery: [10, 7] },
};
const levelOf = (l) => LEVELS[l] || LEVELS.normal;
const PASSES_NOTICED = 2; // à partir du 3e refus en 45 jours, le coach le remarque

function clubState(state) {
  const hub = state.lifeHub || (state.lifeHub = {});
  return (hub.clubLife ||= { passes: [] });
}

function nextClubFixture(state, today) {
  const club = state.snapshot?.club?.name || '';
  const list = (state.snapshot?.fixtures || []).filter((f) => f?.date && !f.played && f.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const f = list[0];
  if (!f) return null;
  return { date: f.date, opponent: f.home === club ? f.away : f.home || f.away || '' };
}

function pushClubPost(state, text, today, newId) {
  if (!text || !state.snapshot?.club?.name) return null;
  state.feed ||= [];
  const fol = Math.max(400, Number(state.profile?.followers) || 4200);
  const h = hash(`${text}|${today}|${state.feed.length}`);
  const likes = Math.max(40, Math.round((300 + (h % 1500)) * Math.min(6, Math.max(0.6, Math.sqrt(fol / 20000)))));
  const post = { id: newId(), author: clubAuthor(state.snapshot.club), text, gameDate: today, createdAt: Date.now(), aboutPost: null, replies: [], likes, reposts: Math.max(4, Math.round(likes * 0.12)), official: true, clubLife: true };
  state.feed.push(post);
  return post;
}

/** One club post on most days (always on match day), never two the same day. */
function tickClubPosts(state, today, { language = 'en', newId, level = 'normal' }) {
  const cl = clubState(state);
  if (!isIso(today) || cl.lastPostOn === today) return null;
  cl.lastPostOn = today;
  const l = LANGS.includes(language) ? language : 'en';
  const nf = nextClubFixture(state, today);
  const days = nf ? daysApart(today, nf.date) : 99;
  const seed = `${state.careerId || ''}|${today}|clubpost`;
  let cat;
  if (days === 0) cat = 'matchday';
  else if (days >= 1 && days <= 3 && hash(seed) % 2 === 0) cat = 'countdown';
  else {
    if (hash(`${seed}|skip`) % 100 >= levelOf(level).postSkip) return null; // about 5 days a week (normal)
    const pool = ['training', 'training', 'feature', 'fans', 'community'];
    cat = pool[hash(`${seed}|cat`) % pool.length];
  }
  const handle = state.profile?.handle ? `@${state.profile.handle}` : (state.snapshot?.player?.name || '');
  const vars = { C: state.snapshot?.club?.name || '', H: handle, O: nf?.opponent || '', N: days };
  return pushClubPost(state, fill(l, pickFresh(state, `club:${cat}`, CLUB_POSTS[cat], seed), vars), today, newId);
}

/** A small ask from the club's media team every 3 to 5 days (never on a match day, one open at a time). */
function tickClubAsks(state, today, { language = 'en', newId, level = 'normal' }) {
  const hub = state.lifeHub;
  if (!hub?.calibrated || !isIso(today) || !state.snapshot?.club?.name) return null;
  const cl = clubState(state);
  if (cl.nextAskOn && today < cl.nextAskOn) return null;
  if (matchDates(state).has(today)) return null;
  if ((state.calendar?.pendingDecisions || []).some((d) => d.kind === 'club_ask')) return null;
  const l = LANGS.includes(language) ? language : 'en';
  const seed = `${state.careerId || ''}|${today}|clubask`;
  const key = pickFresh(state, 'club:ask', Object.keys(CLUB_ASKS), seed);
  cl.passes = (cl.passes || []).filter((d) => daysApart(d, today) < PASS_WINDOW);
  const noticed = cl.passes.length >= PASSES_NOTICED;
  const dec = {
    id: `dec_club_${newId()}`,
    kind: 'club_ask',
    askKey: key,
    date: today,
    title: fill(l, CLUB_ASKS[key], {}),
    choices: [
      { id: 'club_full', cost: 0, effects: { fans: 2, media: 1, manager: 1 }, memory: `Did the club's ${key.replace(/_/g, ' ')} properly` },
      { id: 'club_quick', cost: 0, effects: { fans: 1 }, memory: `Did the club's ${key.replace(/_/g, ' ')} quickly` },
      { id: 'club_pass', cost: 0, effects: noticed ? { manager: -1 } : {}, memory: `Passed on the club's ${key.replace(/_/g, ' ')}` },
    ],
  };
  queueLifeDecision(state, dec);
  const [base, spread] = levelOf(level).askEvery;
  cl.nextAskOn = addDays(today, base + (hash(`${seed}|next`) % spread));
  return dec;
}

/** After his answer: the club posts the result (tagging him), or remembers the pass. */
function afterClubAsk(state, dec, choiceId, today, { language = 'en', newId }) {
  const cl = clubState(state);
  if (choiceId === 'club_pass') { cl.passes = [...(cl.passes || []), today].slice(-10); return null; }
  const l = LANGS.includes(language) ? language : 'en';
  const list = CLUB_ASK_POSTS[choiceId === 'club_full' ? 'full' : 'quick'];
  const handle = state.profile?.handle ? `@${state.profile.handle}` : (state.snapshot?.player?.name || '');
  const post = pushClubPost(state, fill(l, pickFresh(state, `club:askpost:${choiceId}`, list, `${dec.id}|${today}`), { H: handle, C: state.snapshot?.club?.name || '' }), today, newId);
  if (post) pushSimpleScene(state, { date: today, refId: dec.id, artId: 'club_ask', category: 'media', headline: dec.title, narrative: post.text, reactions: [{ channel: 'kop', from: `@${post.author.handle}`, authorName: post.author.name, text: post.text }], newId });
  return post;
}

/** A declined big ask (Mail) counts as a pass too. */
function noteClubPass(state, today) {
  const cl = clubState(state);
  cl.passes = [...(cl.passes || []), today].slice(-10);
}

/** Everything the club does on a given day. */
function tickClubLife(state, today, { language = 'en', newId, level = 'normal' }) {
  const { tickClubMediaAsks } = require('./mediaOffers');
  const out = { post: null, ask: null, big: [] };
  try { out.post = tickClubPosts(state, today, { language, newId, level }); } catch { /* jamais bloquant */ }
  try { out.ask = tickClubAsks(state, today, { language, newId, level }); } catch { /* idem */ }
  try { out.big = tickClubMediaAsks(state, today, newId, levelOf(level).bigEvery); } catch { /* idem */ }
  return out;
}

module.exports = { LEVELS, tickClubLife, tickClubPosts, tickClubAsks, afterClubAsk, noteClubPass, PASSES_NOTICED };
