'use strict';
// Après un événement à soi (2.0) : ceux qui étaient là écrivent un ou deux jours plus tard (message privé sur Kop), et
// un proche qu'on n'a pas vu depuis longtemps finit par le dire, gentiment. Sans IA ; textes variés, sans répétition.
// Seuls les proches qui ont un compte Kop (pas « Pas sur Kop (privé) ») écrivent.

const { circlePersonHandle } = require('./persona');
const { findDm, addDmMessage } = require('./dms');

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysApart = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const THANKS = [
  { fr: 'Merci pour « {E} », ça m’a fait vraiment plaisir ❤️', en: 'Thanks for "{E}", it really meant a lot ❤️', pt: 'Obrigado por "{E}", significou muito ❤️', es: 'Gracias por "{E}", significó mucho ❤️', it: 'Grazie per "{E}", mi ha fatto davvero piacere ❤️', de: 'Danke für „{E}“, das hat mir viel bedeutet ❤️' },
  { fr: 'J’ai mis les photos de « {E} » dans l’album 📸', en: 'Put the photos from "{E}" in the album 📸', pt: 'Coloquei as fotos de "{E}" no álbum 📸', es: 'He puesto las fotos de "{E}" en el álbum 📸', it: 'Ho messo le foto di "{E}" nell’album 📸', de: 'Hab die Fotos von „{E}“ ins Album gepackt 📸' },
  { fr: 'On remet ça bientôt ? Dis-moi quand tu es libre 😊', en: 'Shall we do it again soon? Tell me when you’re free 😊', pt: 'Vamos repetir logo? Me fala quando estiver livre 😊', es: '¿Lo repetimos pronto? Dime cuándo estás libre 😊', it: 'Lo rifacciamo presto? Dimmi quando sei libero 😊', de: 'Machen wir das bald wieder? Sag mir, wann du Zeit hast 😊' },
  { fr: 'Encore en train de rire de « {E} » 😂', en: 'Still laughing about "{E}" 😂', pt: 'Ainda rindo de "{E}" 😂', es: 'Todavía me río de "{E}" 😂', it: 'Ancora rido per "{E}" 😂', de: 'Ich lache immer noch über „{E}“ 😂' },
  { fr: 'C’était bon de te voir. Prends soin de toi avant le prochain match 💪', en: 'Good to see you. Look after yourself before the next game 💪', pt: 'Foi bom te ver. Se cuida antes do próximo jogo 💪', es: 'Me alegró verte. Cuídate antes del próximo partido 💪', it: 'È stato bello vederti. Riguardati prima della prossima partita 💪', de: 'Schön, dich gesehen zu haben. Pass vor dem nächsten Spiel auf dich auf 💪' },
  { fr: 'Merci d’avoir pris le temps, je sais que ton agenda est chargé 🙏', en: 'Thanks for making the time, I know your schedule is packed 🙏', pt: 'Valeu por arranjar tempo, sei que sua agenda está cheia 🙏', es: 'Gracias por sacar tiempo, sé que tienes la agenda llena 🙏', it: 'Grazie per aver trovato il tempo, so che la tua agenda è piena 🙏', de: 'Danke, dass du dir Zeit genommen hast, ich weiß, wie voll dein Kalender ist 🙏' },
];
const MISS_YOU = [
  { fr: 'Ça fait un moment… On se voit bientôt ? Tu nous manques ❤️', en: 'It’s been a while… See you soon? We miss you ❤️', pt: 'Faz tempo… A gente se vê logo? Sentimos sua falta ❤️', es: 'Hace tiempo… ¿Nos vemos pronto? Te echamos de menos ❤️', it: 'È passato un po’… Ci vediamo presto? Ci manchi ❤️', de: 'Ist schon eine Weile her… Sehen wir uns bald? Wir vermissen dich ❤️' },
  { fr: 'Je sais que tu es pris, mais garde un peu de temps pour nous 🙂', en: 'I know you’re busy, but keep a little time for us 🙂', pt: 'Sei que você está ocupado, mas guarda um tempinho pra gente 🙂', es: 'Sé que estás liado, pero guárdanos un poco de tiempo 🙂', it: 'So che sei impegnato, ma tienici un po’ di tempo 🙂', de: 'Ich weiß, du hast viel zu tun, aber nimm dir ein bisschen Zeit für uns 🙂' },
  { fr: 'On a regardé ton dernier match ensemble. On aurait aimé que tu sois là 💛', en: 'We watched your last game together. Wish you’d been there 💛', pt: 'A gente viu teu último jogo junto. Queria que você estivesse aqui 💛', es: 'Vimos tu último partido juntos. Ojalá hubieras estado 💛', it: 'Abbiamo visto la tua ultima partita insieme. Avremmo voluto che fossi qui 💛', de: 'Wir haben dein letztes Spiel zusammen geschaut. Schade, dass du nicht da warst 💛' },
];

const circlePeople = (state) => Object.entries(state.persona?.circle || {}).flatMap(([group, list]) => (Array.isArray(list) ? list : []).map((p) => ({ ...p, group }))).filter((p) => p?.name);
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
    const line = pickLine(state, 'followup:thanks', THANKS, `${f.id}|${today}`);
    addDmMessage(circleThread(state, person, newId), 'them', (line[l] || line.en).replace(/\{E\}/g, f.title || ''), today);
    sent += 1;
  }
  hub.followUps = (hub.followUps || []).filter((f) => !f.sent || daysApart(f.due, today) < 14);
  // un proche (famille, amis) pas vu depuis 60 jours, au plus une fois par mois
  state.circleTime ||= {};
  if (!hub.missYouOn || daysApart(hub.missYouOn, today) >= 30) {
    const since = hub.lastTickDate || today;
    const lonely = circle.filter((p) => onKop(p) && (p.group === 'family' || p.group === 'friends'))
      .filter((p) => { const last = state.circleTime?.[p.name]; return last ? daysApart(last, today) >= 60 : daysApart(state.circleStartedOn || (state.circleStartedOn = since), today) >= 60; });
    if (lonely.length) {
      const p = lonely[hash(`${today}|miss`) % lonely.length];
      const line = pickLine(state, 'followup:miss', MISS_YOU, `${p.name}|${today}`);
      addDmMessage(circleThread(state, p, newId), 'them', line[l] || line.en, today);
      state.circleTime[p.name] = today; // il l'a dit ; pas deux fois de suite
      hub.missYouOn = today;
      sent += 1;
    }
  }
  return sent;
}

module.exports = { queueFollowUps, deliverFollowUps };
