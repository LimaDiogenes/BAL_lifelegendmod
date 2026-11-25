'use strict';
// Après un événement à soi (2.0) : ceux qui étaient là écrivent un ou deux jours plus tard (message privé sur Kop), et
// un proche qu'on n'a pas vu depuis longtemps finit par le dire, gentiment. Sans IA ; textes variés, sans répétition.
// Seuls les proches qui ont un compte Kop (pas « Pas sur Kop (privé) ») écrivent.

const { circlePersonHandle } = require('./persona');
const { findDm, addDmMessage } = require('./dms');
const { isFar } = require('./lifeGeo');

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

// Ceux qui vivent loin (ville natale, autre pays) écrivent comme quelqu'un qui est loin (2.0).
const FAR_THANKS = [
  { fr: 'Bien rentré(e). Merci pour « {E} », ça valait le voyage ✈️❤️', en: 'Home safe. Thanks for "{E}", it was worth the trip ✈️❤️', pt: 'Cheguei bem. Obrigado por "{E}", valeu a viagem ✈️❤️', es: 'Ya en casa. Gracias por "{E}", mereció la pena el viaje ✈️❤️', it: 'Arrivato/a a casa. Grazie per "{E}", ne è valsa la pena ✈️❤️', de: 'Gut zu Hause angekommen. Danke für „{E}“, die Reise hat sich gelohnt ✈️❤️' },
  { fr: 'Déjà de retour et tu me manques. La prochaine fois, c’est toi qui viens 😉', en: 'Back already and I miss you. Next time it’s your turn to visit 😉', pt: 'Já voltei e já estou com saudade. Da próxima vez é você que vem 😉', es: 'Ya de vuelta y ya te echo de menos. La próxima vez vienes tú 😉', it: 'Già tornato/a e mi manchi. La prossima volta vieni tu 😉', de: 'Schon zurück und vermisse dich. Nächstes Mal kommst du 😉' },
  { fr: 'J’ai montré les photos de « {E} » à tout le monde ici 📸', en: 'Showed everyone back here the photos from "{E}" 📸', pt: 'Mostrei as fotos de "{E}" pra todo mundo aqui 📸', es: 'Les he enseñado a todos aquí las fotos de "{E}" 📸', it: 'Ho fatto vedere a tutti qui le foto di "{E}" 📸', de: 'Hab allen hier die Fotos von „{E}“ gezeigt 📸' },
  { fr: 'Le voyage retour a été long, mais je referais tout pour « {E} » 😊', en: 'Long trip back, but I’d do it all again for "{E}" 😊', pt: 'A volta foi longa, mas faria tudo de novo por "{E}" 😊', es: 'El viaje de vuelta fue largo, pero lo repetiría todo por "{E}" 😊', it: 'Il viaggio di ritorno è stato lungo, ma rifarei tutto per "{E}" 😊', de: 'Lange Rückreise, aber für „{E}“ würde ich es wieder tun 😊' },
];
const FAR_MISS = [
  { fr: 'On regarde tous tes matchs d’ici, mais ce n’est pas pareil. Viens nous voir à la prochaine pause ✈️', en: 'We watch all your games from here, but it’s not the same. Come and see us at the next break ✈️', pt: 'A gente vê todos os teus jogos daqui, mas não é a mesma coisa. Vem nos ver na próxima pausa ✈️', es: 'Vemos todos tus partidos desde aquí, pero no es lo mismo. Ven a vernos en el próximo parón ✈️', it: 'Guardiamo tutte le tue partite da qui, ma non è la stessa cosa. Vieni a trovarci alla prossima pausa ✈️', de: 'Wir schauen all deine Spiele von hier, aber das ist nicht dasselbe. Komm uns in der nächsten Pause besuchen ✈️' },
  { fr: 'Ici tout le monde demande quand tu reviens 😅', en: 'Everyone here keeps asking when you’re coming home 😅', pt: 'Aqui todo mundo pergunta quando você volta 😅', es: 'Aquí todos preguntan cuándo vuelves 😅', it: 'Qui tutti chiedono quando torni 😅', de: 'Hier fragen alle, wann du nach Hause kommst 😅' },
  { fr: 'J’aimerais tant être au stade. Envoie-moi une photo depuis la pelouse 📸', en: 'Wish I could be at the stadium. Send me a photo from the pitch 📸', pt: 'Queria tanto estar no estádio. Me manda uma foto do gramado 📸', es: 'Ojalá pudiera estar en el estadio. Mándame una foto desde el césped 📸', it: 'Vorrei tanto essere allo stadio. Mandami una foto dal campo 📸', de: 'Ich wäre so gern im Stadion. Schick mir ein Foto vom Rasen 📸' },
  { fr: 'On cherche des billets pour venir te voir jouer. Tu nous dis quel match ? 🎟️', en: 'We’re looking at tickets to come and watch you play. Which game should we pick? 🎟️', pt: 'Estamos vendo passagens pra ir te ver jogar. Qual jogo você indica? 🎟️', es: 'Estamos mirando billetes para ir a verte jugar. ¿Qué partido nos recomiendas? 🎟️', it: 'Stiamo guardando i biglietti per venire a vederti giocare. Quale partita ci consigli? 🎟️', de: 'Wir schauen nach Tickets, um dich spielen zu sehen. Welches Spiel sollen wir nehmen? 🎟️' },
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
