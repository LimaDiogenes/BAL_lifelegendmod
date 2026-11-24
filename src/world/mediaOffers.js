'use strict';
// Interviews personnelles (2.0) : podcasts, plateaux télé, chaîne du club, couvertures, documentaires, lives caritatifs.
// L'app les construit elle-même (aucune requête IA), l'agent les envoie par mail, le joueur accepte, demande plus ou
// refuse ; acceptée, l'interview arrive dans le calendrier un jour sans match, avec des choix le jour venu. C'est là que
// les sujets perso (sponsors compris) ont leur place, pas en conférence d'après-match.

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const STAGES = { rookie: 0, rising: 1, established: 2, superstar: 3 };

const MEDIA_KINDS = {
  podcast: { minStage: 'rookie', fee: [3000, 8000, 20000, 45000], outlets: ['The Final Third', 'Box to Box Talk', 'Half-Time Thoughts', 'The Dressing Room Pod', 'Off the Ball', 'Studs Up', 'Number Nine', 'Extra Time Sessions', 'The Long Ball', 'Touchline Tales'] },
  tv_show: { minStage: 'rising', fee: [0, 15000, 40000, 90000], outlets: ['Sunday Late', 'Prime Talk', 'The Evening Couch', 'Matchnight Live', 'Studio 7', 'Late Kick-Off', 'The Big Sit-Down', 'City Tonight'] },
  club_channel: { minStage: 'rookie', fee: [0, 0, 0, 0], outlets: ['{club} TV', '{club} Inside', '{club} Matchday Live', '{club} Academy Stories'] },
  magazine_cover: { minStage: 'rising', fee: [0, 12000, 35000, 80000], outlets: ['Pitch Magazine', 'Golden Boot Monthly', 'Style & Studs', 'Northern Pitch', 'FWD Magazine', 'Icon Sport', 'Turf Review'] },
  documentary: { minStage: 'established', fee: [0, 0, 60000, 150000], outlets: ['A Season Inside', 'Behind the Badge', 'The Making of a Star', 'Ninety Plus', 'Road to the Top'] },
  charity_stream: { minStage: 'rookie', fee: [0, 0, 0, 0], outlets: ['Goals for Good', 'Play It Forward', 'Kick for Kids', 'Stream for Hope', 'One Ball One World'] },
};
const KIND_EN = { podcast: 'podcast', tv_show: 'TV show', club_channel: 'club channel interview', magazine_cover: 'magazine cover', documentary: 'documentary', charity_stream: 'charity live stream' };

// Choix du jour : jamais négatifs, sauf le choix « audacieux » qui peut se retourner (comme les autres décisions risquées).
const MEDIA_CHOICES = {
  media_open: { effects: { fans: 3, media: 3 }, followerDelta: 0.006, memory: ['Opened up about his life on {o}', 'Talked family and roots on {o}', 'Let people see the man behind the player on {o}'] },
  media_safe: { effects: { media: 2, manager: 2 }, memory: ['Kept it about football on {o}', 'Gave a calm, professional {k} to {o}', 'Stayed on message on {o}, all football'] },
  media_promo: { effects: { sponsors: 4, media: 1 }, memory: ['Mentioned his partners on {o}', 'Found the right moment to talk about his partners on {o}', 'Gave his partners a nod on {o}'] },
  media_bold: { effects: { media: 5, fans: 2 }, risk: { chance: 0.25, effects: { media: -4, manager: -2 }, followUp: 'fu_viral_quote' }, memory: ['Said something bold on {o}', 'Made headlines with a bold line on {o}', 'Did not hold back on {o}'] },
  media_give: { effects: { fans: 5, media: 2 }, memory: ['Raised money for kids on {o}', 'Played and chatted for a good cause on {o}', 'Helped {o} beat its fundraising goal'] },
  media_team: { effects: { squad: 3, manager: 1 }, memory: ['Talked up his teammates on {o}', 'Gave the credit to the group on {o}', 'Spoke about the dressing room on {o}'] },
};

function pickOutlet(state, kind, club, seed) {
  const list = MEDIA_KINDS[kind].outlets.map((o) => o.replace('{club}', club || 'Club'));
  const used = new Set((state.lifeHub?.mediaOffers || []).slice(-8).map((m) => m.outlet));
  const fresh = list.filter((o) => !used.has(o));
  const pool = fresh.length ? fresh : list;
  return pool[hash(seed) % pool.length];
}

function freeDate(state, from, minOff, maxOff) {
  const blocked = new Set();
  for (const snap of [state.snapshot, state.saveSnapshot]) for (const f of snap?.fixtures || []) if (f?.date) blocked.add(f.date);
  for (const e of state.calendar?.customEvents || []) blocked.add(e.date);
  for (const e of state.calendar?.systemEvents || []) blocked.add(e.date);
  for (let i = minOff; i <= maxOff; i += 1) { const d = addDays(from, i); if (!blocked.has(d)) return d; }
  return addDays(from, minOff);
}

/** New offers (at most 2 open, one every 9 to 16 days), and lapsed ones. */
function tickMediaOffers(state, today, newId) {
  const hub = state?.lifeHub;
  if (!hub?.calibrated || !isIso(today)) return [];
  hub.mediaOffers ||= [];
  for (const o of hub.mediaOffers) if (o.status === 'open' && o.expires && today > o.expires) o.status = 'lapsed';
  const open = hub.mediaOffers.filter((o) => o.status === 'open').length;
  if (open >= 2 || (hub.nextMediaOfferOn && today < hub.nextMediaOfferOn)) return [];
  const rank = STAGES[hub.stage] ?? 0;
  const kinds = Object.keys(MEDIA_KINDS).filter((k) => (STAGES[MEDIA_KINDS[k].minStage] ?? 0) <= rank);
  const recent = hub.mediaOffers.slice(-3).map((o) => o.kind);
  const fresh = kinds.filter((k) => !recent.includes(k));
  const pool = fresh.length ? fresh : kinds;
  const seed = `${state.careerId || ''}|${today}|media`;
  const kind = pool[hash(seed) % pool.length];
  const club = state.snapshot?.club?.name || '';
  const offer = {
    id: newId(),
    kind,
    outlet: pickOutlet(state, kind, club, seed),
    date: freeDate(state, today, 5, 14),
    fee: MEDIA_KINDS[kind].fee[rank] || 0,
    on: today,
    expires: addDays(today, 5),
    status: 'open',
    negotiated: false,
    note: hash(`${seed}|note`) % 8,
  };
  hub.mediaOffers.push(offer);
  if (hub.mediaOffers.length > 40) hub.mediaOffers = hub.mediaOffers.slice(-40);
  hub.nextMediaOfferOn = addDays(today, 9 + (hash(`${seed}|next`) % 8));
  return [offer];
}

/** accept: into the calendar; negotiate (once): the outlet may pay 30 % more, or hold firm; decline: no penalty. */
function answerMediaOffer(state, offerId, choice, today, newId) {
  const hub = state?.lifeHub;
  const offer = (hub?.mediaOffers || []).find((o) => o.id === offerId);
  if (!offer) throw new Error('Élément introuvable.');
  if (offer.status !== 'open') throw new Error('Cette proposition n’est plus ouverte.');
  if (choice === 'decline') { offer.status = 'declined'; return offer; }
  if (choice === 'negotiate') {
    if (offer.negotiated || !offer.fee) throw new Error('Cette proposition n’est plus ouverte.');
    offer.negotiated = true;
    if (hash(`${offer.id}|nego`) % 100 < 60) { offer.fee = Math.round((offer.fee * 1.3) / 500) * 500; offer.negotiation = 'up'; } else offer.negotiation = 'firm';
    return offer;
  }
  if (choice !== 'accept') throw new Error('Choix inconnu.');
  offer.status = 'accepted';
  state.calendar ||= {};
  state.calendar.customEvents ||= [];
  state.calendar.customEvents.push({ id: newId(), date: offer.date, title: offer.outlet, kind: 'media', category: 'media', mediaOfferId: offer.id, mediaKind: offer.kind, fee: offer.fee });
  state.calendar.customEvents.sort((a, b) => a.date.localeCompare(b.date));
  return offer;
}

/** The decision on the day: three choices, a different set each time (with partners only if he has some). */
function mediaDecision(ev, state) {
  const hasPartners = (state?.lifeHub?.sponsors || []).length > 0;
  const base = ev.mediaKind === 'charity_stream' ? ['media_give', 'media_safe', 'media_team'] : ['media_open', 'media_safe', 'media_bold', 'media_team', ...(hasPartners ? ['media_promo'] : [])];
  const start = hash(`${ev.id}|${ev.date}`) % base.length;
  const ids = ev.mediaKind === 'charity_stream' ? base : [...new Set(['media_safe', base[start], base[(start + 1) % base.length]])];
  while (ids.length < 3) { const extra = base.find((x) => !ids.includes(x)); if (!extra) break; ids.push(extra); }
  const kindEn = KIND_EN[ev.mediaKind] || 'interview';
  const choices = ids.map((id) => {
    const c = MEDIA_CHOICES[id];
    const memory = c.memory[hash(`${ev.id}|${id}`) % c.memory.length].replace(/\{o\}/g, ev.title).replace(/\{k\}/g, kindEn);
    return {
      id, cost: 0, bonusCash: ev.fee || 0, effects: { ...c.effects },
      ...(c.followerDelta ? { followerDelta: c.followerDelta } : {}),
      ...(c.risk ? { risk: { ...c.risk, memory: `A bold line he dropped on ${ev.title} went viral for the wrong reasons` } } : {}),
      memory,
    };
  });
  return { id: `dec_cust_${ev.id}`, kind: 'media_event', mediaKind: ev.mediaKind, date: ev.date, title: ev.title, fee: ev.fee || 0, choices };
}

module.exports = { MEDIA_KINDS, MEDIA_CHOICES, tickMediaOffers, answerMediaOffer, mediaDecision };
