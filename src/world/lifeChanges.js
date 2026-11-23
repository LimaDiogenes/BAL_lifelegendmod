'use strict';
// Le monde réagit à sa vie (2.0, demande du joueur) : quand il ajoute ou retire des proches, change de lieux, de
// biographie ou de profil, LifeLegend en garde une trace (« news hooks »). La presse et les supporters reprennent ce qui
// est public ; ce qui est privé (personne non « connue des médias ») n'est évoqué que par son cercle proche (messages,
// vestiaire). Les noms passent toujours par le bouclier de confidentialité avant l'IA.

const MAX_HOOKS = 12;
const HOOK_DAYS = 14;
const GROUP_WORDS = { family: 'family', friends: 'friends', business: 'professional circle', roots: 'roots' };
const ROOT_WORDS = { hometown: 'hometown', childhood: 'childhood neighbourhood', academy: 'youth academy' };

const clean = (s, max = 160) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
const personKey = (p) => clean(p?.name || p?.role).toLowerCase();
const isPublic = (p) => p?.media !== false;

function addDays(iso, n) {
  const d = new Date(`${String(iso || '2026-08-01').slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** People added to / removed from the inner circle, and changed roots. */
function diffPersona(oldP, newP, date) {
  const hooks = [];
  for (const group of Object.keys(GROUP_WORDS)) {
    const before = new Map((oldP?.circle?.[group] || []).filter(personKey).map((p) => [personKey(p), p]));
    const after = new Map((newP?.circle?.[group] || []).filter(personKey).map((p) => [personKey(p), p]));
    for (const [k, p] of after) {
      if (before.has(k)) continue;
      const who = clean([p.role, p.name].filter(Boolean).join(' '));
      hooks.push({ date, kind: 'person_added', visibility: isPublic(p) ? 'public' : 'private', text: `New person in his ${GROUP_WORDS[group]}: ${who}` });
    }
    for (const [k, p] of before) {
      if (after.has(k)) continue;
      const who = clean([p.role, p.name].filter(Boolean).join(' '));
      hooks.push({ date, kind: 'person_removed', visibility: isPublic(p) ? 'public' : 'private', text: `${who} is no longer part of his ${GROUP_WORDS[group]}` });
    }
  }
  for (const [k, word] of Object.entries(ROOT_WORDS)) {
    const a = clean(oldP?.roots?.[k]), b = clean(newP?.roots?.[k]);
    if (b && a !== b) hooks.push({ date, kind: 'roots', visibility: 'public', text: `His ${word} is ${b}${a ? ` (previously said to be ${a})` : ''}` });
  }
  return hooks;
}

/** New sentences in his biography (not in the previous text). */
function diffBio(oldText, newText, date) {
  const sentences = (t) => clean(t, 4000).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 12);
  const old = new Set(sentences(oldText).map((x) => x.toLowerCase()));
  const fresh = sentences(newText).filter((x) => !old.has(x.toLowerCase())).slice(0, 2);
  return fresh.map((x) => ({ date, kind: 'bio', visibility: 'public', text: `New in his biography: ${clean(x, 220)}` }));
}

/** Public profile changes on Kop (location, short bio). */
function diffProfile(old, next, date) {
  const hooks = [];
  if (clean(next?.location) && clean(old?.location) !== clean(next?.location)) hooks.push({ date, kind: 'profile', visibility: 'public', text: `His profile now says he lives in ${clean(next.location, 60)}` });
  if (clean(next?.bio) && clean(old?.bio) !== clean(next?.bio)) hooks.push({ date, kind: 'profile', visibility: 'public', text: `He changed his social-media bio to: "${clean(next.bio, 160)}"` });
  return hooks;
}

function addHooks(state, hooks) {
  if (!hooks.length) return;
  state.newsHooks = [...hooks, ...(state.newsHooks || [])].slice(0, MAX_HOOKS);
}

/** What the AI may use: recent public changes (press, fans) and private ones (close circle only). */
function lifeChangesFacts(state, gameDate) {
  const live = (state?.newsHooks || []).filter((h) => !gameDate || !h.date || (h.date <= gameDate && addDays(h.date, HOOK_DAYS) >= gameDate));
  if (!live.length) return undefined;
  const pub = live.filter((h) => h.visibility === 'public').map((h) => h.text);
  const priv = live.filter((h) => h.visibility !== 'public').map((h) => h.text);
  return { ...(pub.length ? { public: pub } : {}), ...(priv.length ? { close_circle_only: priv } : {}) };
}

module.exports = { diffPersona, diffBio, diffProfile, addHooks, lifeChangesFacts };
