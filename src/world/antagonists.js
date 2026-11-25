'use strict';
// Les antagonistes (2.0) : ceux que le joueur a mis dans « Antagonistes » (rival, détracteur, critique, ex-coach
// sceptique, ex, ancien coéquipier jaloux) et qui sont sur Kop. Ils piquent après un bon ou un mauvais match, se moquent
// d'un achat de luxe, et de temps en temps le provoquent : une décision (répondre, ignorer, en rire). Sans IA ; jamais
// d'insulte. Ils n'ont ni anniversaire, ni journée en famille, ni messages privés.

const { ANTAGONIST_POSTS, RIVAL_OUTCOME } = require('./texts/antagonists');
const { pickFresh, catalogDisplayName, pushSimpleScene } = require('./lifeScenes');
const { queueLifeDecision } = require('./lifeHub');
const { circlePersonHandle } = require('./persona');
const { matchDates } = require('./lifeGeo');

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const LANGS = ['fr', 'en', 'pt', 'es', 'it', 'de'];
const fill = (l, t, vars) => String(t[l] || t.en || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
const LUXURY = new Set(['car', 'home', 'watch', 'jet', 'yacht', 'lifestyle', 'collection']);

/** Antagonists the player put on Kop (with a known hostile personality). */
function rivalsOnKop(state) {
  return (state?.persona?.circle?.rivals || []).filter((p) => p?.name && ANTAGONIST_POSTS[p.kopPersonality]);
}

function rivalAuthor(state, person) {
  const handle = circlePersonHandle(person);
  state.accounts ||= {};
  state.accounts[handle] = { ...(state.accounts[handle] || {}), name: person.name, type: 'rival', role: person.role || '', kopPersonality: person.kopPersonality, verified: false };
  return { handle, name: person.name, type: 'rival', verified: false };
}

function postAs(state, person, text, today, newId) {
  if (!text) return null;
  state.feed ||= [];
  const h = hash(`${text}|${today}|${state.feed.length}`);
  const likes = 20 + (h % 400);
  const post = { id: newId(), author: rivalAuthor(state, person), text, gameDate: today, createdAt: Date.now(), aboutPost: null, replies: [], likes, reposts: Math.round(likes * 0.15), antagonist: true };
  state.feed.push(post);
  return post;
}

function say(state, person, situation, language, seed, vars) {
  const l = LANGS.includes(language) ? language : 'en';
  const list = ANTAGONIST_POSTS[person.kopPersonality]?.[situation];
  if (!list?.length) return '';
  return fill(l, pickFresh(state, `rival:${person.kopPersonality}:${situation}`, list, seed), vars);
}

const handleOf = (state) => (state.profile?.handle ? `@${state.profile.handle}` : (state.snapshot?.player?.name || ''));

/** good / bad / null for his last match. */
function matchSituation(state, r) {
  const me = r?.me;
  if (!me || !(me.minutes > 0)) return null;
  const club = state.snapshot?.club?.name;
  const [hs, as] = Array.isArray(r.score) ? r.score : [0, 0];
  const mine = r.home === club ? hs : as, theirs = r.home === club ? as : hs;
  const contrib = (me.goals || 0) + (me.assists || 0);
  const rating = Number(me.rating) || 0;
  if (contrib > 0 || rating >= 7.5) return 'good';
  if ((rating && rating < 6.2) || (mine < theirs && contrib === 0 && (!rating || rating < 6.6))) return 'bad';
  return null;
}

/** After new results: maybe one antagonist reacts (more often after a bad game); now and then a provocation. */
function tickAntagonists(state, changes, today, { language = 'en', newId }) {
  const rivals = rivalsOnKop(state);
  if (!rivals.length || !isIso(today)) return { post: null, decision: null };
  const out = { post: null, decision: null };
  const r = (changes?.newResults || []).filter((x) => x?.me && x.me.minutes > 0).at(-1);
  const sit = matchSituation(state, r);
  const seed = `${state.careerId || ''}|${today}|${r?.id || ''}|rival`;
  if (sit && hash(seed) % 100 < (sit === 'bad' ? 70 : 45)) {
    const person = pickFresh(state, 'rival:who', rivals, seed);
    out.post = postAs(state, person, say(state, person, sit, language, seed, { H: handleOf(state) }), r.date || today, newId);
  }
  out.decision = maybeProvoke(state, today, { language, newId });
  return out;
}

/** Every 18 to 28 days (never on a match day, one at a time): a provocation and the decision it opens. */
function maybeProvoke(state, today, { language = 'en', newId }) {
  const rivals = rivalsOnKop(state);
  const hub = state.lifeHub;
  if (!rivals.length || !hub?.calibrated || !isIso(today)) return null;
  const rv = (hub.rivalry ||= {});
  if (!rv.nextProvokeOn) { rv.nextProvokeOn = addDays(today, 10 + (hash(`${today}|rv0`) % 11)); return null; }
  if (today < rv.nextProvokeOn || matchDates(state).has(today)) return null;
  if ((state.calendar?.pendingDecisions || []).some((d) => d.kind === 'rival_provocation')) return null;
  const seed = `${state.careerId || ''}|${today}|provoke`;
  const person = pickFresh(state, 'rival:provoker', rivals, seed);
  const post = postAs(state, person, say(state, person, 'provoke', language, seed, { H: handleOf(state) }), today, newId);
  const dec = {
    id: `dec_rival_${newId()}`,
    kind: 'rival_provocation',
    date: today,
    title: person.name,
    personName: person.name,
    quote: post?.text || '',
    choices: [
      { id: 'rival_reply', cost: 0, effects: { media: 3, fans: 1, manager: -2 }, risk: { chance: 0.25, effects: { media: -3, manager: -1 }, memory: `His reply to ${person.name} on Kop turned into a public spat` }, memory: `Answered ${person.name}'s jab on Kop` },
      { id: 'rival_ignore', cost: 0, effects: { manager: 2 }, memory: `Ignored ${person.name}'s jab and let his football talk` },
      { id: 'rival_joke', cost: 0, effects: { fans: 2, media: 1 }, memory: `Laughed off ${person.name}'s jab with a joke` },
    ],
  };
  queueLifeDecision(state, dec);
  rv.nextProvokeOn = addDays(today, 18 + (hash(`${seed}|next`) % 11));
  return dec;
}

/** A luxury purchase: one antagonist may mock it (about one time in three). */
function antagonistFlex(state, asset, today, { language = 'en', newId }) {
  const rivals = rivalsOnKop(state);
  if (!rivals.length || !asset || !isIso(today)) return null;
  if (!LUXURY.has(asset.category) || (Number(asset.price) || 0) < 50000) return null;
  const seed = `${state.careerId || ''}|${today}|${asset.catalogId || asset.id}|flex`;
  if (hash(seed) % 100 >= 35) return null;
  const person = pickFresh(state, 'rival:flexer', rivals, seed);
  const item = catalogDisplayName(asset, language) || asset.name || '';
  return postAs(state, person, say(state, person, 'flex', language, seed, { H: handleOf(state), I: item }), today, newId);
}

/** After his answer to a provocation: a short scene (with its picture). */
function afterProvocation(state, dec, choiceId, today, { language = 'en', newId }) {
  const list = RIVAL_OUTCOME[choiceId];
  if (!list) return null;
  const l = LANGS.includes(language) ? language : 'en';
  const v = pickFresh(state, `rival:outcome:${choiceId}`, list, `${dec.id}|${choiceId}`);
  const vars = { N: dec.personName || dec.title || '', H: handleOf(state) };
  return pushSimpleScene(state, { date: today, refId: dec.id, artId: 'rival_provocation', category: 'media', headline: fill(l, v.h, vars), narrative: fill(l, v.n, vars), newId });
}

module.exports = { tickAntagonists, antagonistFlex, afterProvocation, rivalsOnKop, matchSituation };
