'use strict';
// Après un événement à soi (2.0) : ceux qui étaient là écrivent un ou deux jours plus tard (message privé sur Kop), et
// un proche qu'on n'a pas vu depuis longtemps finit par le dire, gentiment. Sans IA ; textes variés, sans répétition.
// Seuls les proches qui ont un compte Kop (pas « Pas sur Kop (privé) ») écrivent.

const { circlePersonHandle } = require('./persona');
const { findDm, addDmMessage } = require('./dms');
const { isFar } = require('./lifeGeo');
const { THANKS, MISS_YOU, FAR_THANKS, FAR_MISS } = require('./texts/messages');

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysApart = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// les antagonistes et les organisations n'écrivent pas de messages privés (2.0)
const circlePeople = (state) => Object.entries(state.persona?.circle || {}).filter(([group]) => group !== 'rivals' && group !== 'orgs').flatMap(([group, list]) => (Array.isArray(list) ? list : []).map((p) => ({ ...p, group }))).filter((p) => p?.name);
const onKop = (p) => Boolean(p?.kopPersonality);

// Un fil privé avec ce proche (créé au premier message), comme ceux des coéquipiers et des supporters.
function circleThread(state, person, newId) {
  const handle = circlePersonHandle(person);
  const known = findDm(state, handle);
  if (known) return known;
  state.accounts ||= {};
  state.accounts[handle] = { ...(state.accounts[handle] || {}), name: person.name, type: 'circle', role: person.role || person.group || '', kopPersonality: person.kopPersonality || 'supportive', verified: false };
  const thread = { id: newId(), handle, name: person.name, type: 'circle', kind: 'circle', unread: false, closed: false, messages: [] };
  state.dms = [...(state.dms || []), thread];
  return thread;
}

function pickLine(state, key, list, seed) {
  const mem = (state.lineMemory ||= {});
  const recent = Array.isArray(mem[key]) ? mem[key] : [];
  const free = list.map((_, i) => i).filter((i) => !recent.includes(i));
  const pool = free.length ? free : list.map((_, i) => i);
  const idx = pool[hash(seed) % pool.length];
  mem[key] = [...recent, idx].slice(-Math.max(1, list.length - 1));
  return list[idx];
}

/** After an own event: remember who was there, and up to 4 of them (on Kop) write in the next 1 or 2 days. */
function queueFollowUps(state, { title, people = [], decisionId = '' }, today) {
  if (!isIso(today)) return [];
  const hub = state.lifeHub || (state.lifeHub = {});
  hub.followUps ||= [];
  state.circleTime ||= {};
  const circle = circlePeople(state);
  const present = people.map((p) => circle.find((c) => c.name === p.name)).filter(Boolean);
  for (const p of present) state.circleTime[p.name] = today;
  const writers = present.filter(onKop).slice(0, 4);
  const queued = writers.map((p, i) => ({ id: `${decisionId}|${p.name}`, name: p.name, title, due: addDays(today, 1 + ((hash(`${decisionId}|${p.name}`) + i) % 2)) }));
  hub.followUps.push(...queued.filter((q) => !hub.followUps.some((f) => f.id === q.id)));
  if (hub.followUps.length > 30) hub.followUps = hub.followUps.slice(-30);
  return queued;
}

/** Sends what is due: thank-you messages, and now and then a gentle "we miss you" from a close one not seen for 60+ days. */
function deliverFollowUps(state, today, { language = 'en', newId }) {
  const hub = state?.lifeHub;
  if (!hub || !isIso(today)) return 0;
  const l = ['fr', 'en', 'pt', 'es', 'it', 'de'].includes(language) ? language : 'en';
  const circle = circlePeople(state);
  let sent = 0;
  for (const f of hub.followUps || []) {
    if (f.sent || f.due > today) continue;
    f.sent = true;
    const person = circle.find((c) => c.name === f.name);
    if (!onKop(person)) continue;
    const far = isFar(person);
    const line = pickLine(state, far ? 'followup:thanks_far' : 'followup:thanks', far ? FAR_THANKS : THANKS, `${f.id}|${today}`);
    addDmMessage(circleThread(state, person, newId), 'them', (line[l] || line.en).replace(/\{E\}/g, f.title || ''), today);
    sent += 1;
  }
  hub.followUps = (hub.followUps || []).filter((f) => !f.sent || daysApart(f.due, today) < 14);
  // un proche (famille, amis) pas vu depuis 60 jours (30 s'il vit loin), au plus une fois par mois
  state.circleTime ||= {};
  if (!hub.missYouOn || daysApart(hub.missYouOn, today) >= 30) {
    const since = hub.lastTickDate || today;
    const lonely = circle.filter((p) => onKop(p) && (p.group === 'family' || p.group === 'friends'))
      .filter((p) => { const gap = isFar(p) ? 30 : 60; const last = state.circleTime?.[p.name]; return last ? daysApart(last, today) >= gap : daysApart(state.circleStartedOn || (state.circleStartedOn = since), today) >= gap; });
    if (lonely.length) {
      const p = lonely[hash(`${today}|miss`) % lonely.length];
      const line = isFar(p) ? pickLine(state, 'followup:miss_far', FAR_MISS, `${p.name}|${today}`) : pickLine(state, 'followup:miss', MISS_YOU, `${p.name}|${today}`);
      addDmMessage(circleThread(state, p, newId), 'them', line[l] || line.en, today);
      state.circleTime[p.name] = today; // il l'a dit ; pas deux fois de suite
      hub.missYouOn = today;
      sent += 1;
    }
  }
  return sent;
}

module.exports = { queueFollowUps, deliverFollowUps };
