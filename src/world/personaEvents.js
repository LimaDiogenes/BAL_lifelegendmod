'use strict';
// Ce que le joueur a écrit fait vivre son calendrier (2.0) : sa passion, sa ville natale, son idole, son rêve, son
// tournant, et le match contre son premier club. Des événements espacés (tous les 18 à 30 jours), jamais sur un jour de
// match, avec des choix tirés au sort parmi un grand nombre (et des souvenirs variés) pour ne pas se répéter.
// Tous les choix sont positifs : ces moments ne punissent jamais.

const { matchDates, canTravelHome } = require('./lifeGeo');

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clean = (v, n = 80) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Chaque choix : effets (jamais négatifs) et plusieurs souvenirs possibles ({x} = la passion, la ville, l'idole…).
const PERSONA_CHOICES = {
  hobby_friends: { effects: { squad: 2, fans: 1 }, memory: ['Spent his day off on {x} with old friends', 'Shared an afternoon of {x} with the people he grew up with', 'Got the old crew together for some {x}'] },
  hobby_solo: { effects: { manager: 2 }, memory: ['Took a quiet day alone with {x} to clear his head', 'Switched off with a solo {x} session', 'Kept his day off simple: just him and {x}'] },
  hobby_charity: { cost: 3000, effects: { fans: 3, media: 2 }, memory: ['Turned his love of {x} into a small charity day', 'Hosted a {x} morning for a local children’s charity', 'Raised money for kids through a {x} event'] },
  hobby_film: { effects: { media: 2, fans: 2 }, followerDelta: 0.004, memory: ['Shared a behind-the-scenes clip of his {x} day', 'Let fans see his {x} side in a short video', 'Posted a candid {x} moment that fans loved'] },
  hobby_teammate: { effects: { squad: 3 }, memory: ['Introduced a teammate to {x}', 'Spent the afternoon on {x} with a couple of teammates', 'Bonded with teammates over {x}'] },
  home_family: { effects: { squad: 1, fans: 1 }, memory: ['Went back to {x} for a long family lunch', 'Spent a slow day at home in {x}', 'Surprised his family with a visit to {x}'] },
  home_kids: { effects: { fans: 3, media: 1 }, memory: ['Played with the kids on his old pitch in {x}', 'Visited his childhood club in {x} and signed shirts for the kids', 'Gave a training session to young players in {x}'] },
  home_quiet: { effects: { manager: 1 }, memory: ['Walked the streets of {x} where it all began', 'Had a quiet coffee in {x}, away from the noise', 'Took a private trip back to {x}'] },
  home_press: { effects: { media: 3 }, memory: ['Gave the local paper in {x} a long interview', 'Talked to {x}’s local radio about where he comes from', 'Opened up to the {x} press about his roots'] },
  home_old_friends: { effects: { squad: 1, fans: 2 }, memory: ['Caught up with childhood friends in {x}', 'Joined his old friends for a kickabout in {x}', 'Spent the evening with the old gang in {x}'] },
  // pas de quoi rentrer (moins de 4 jours sans match) : la maison vient à lui
  home_visit: { effects: { squad: 1, fans: 1 }, memory: ['His family came over from {x} for the day', 'Had the family over from {x} for a long lunch', 'Showed the family from {x} around his new city'] },
  home_call: { effects: { manager: 1, squad: 1 }, memory: ['Spent an hour on a video call with everyone back in {x}', 'Called home to {x} and caught up with everyone', 'A long video call with the family in {x}'] },
  home_taste: { effects: { squad: 2 }, memory: ['Cooked a dish from {x} and sent the photo home', 'Found a restaurant serving food from {x}', 'Made a recipe from {x} for a few teammates'] },
  home_kids_remote: { cost: 1500, effects: { fans: 3, media: 1 }, memory: ['Sent signed shirts to his boyhood club in {x}', 'Sent a video message to the kids at his old club in {x}', 'Paid for new kit for the youngsters back in {x}'] },
  home_radio: { effects: { media: 3 }, memory: ['Gave {x}’s local radio a phone interview about his roots', 'Talked to the {x} local paper by phone', 'Told {x}’s local press, by phone, how much home still means'] },
  idol_meet: { effects: { media: 3, fans: 2 }, memory: ['Met {x}, the player he grew up idolising', 'Finally shook hands with {x}', 'Spent an hour talking football with {x}'] },
  idol_advice: { effects: { manager: 2 }, memory: ['Asked {x} for advice and listened closely', 'Took notes from a long chat with {x}', 'Picked up a few habits from {x}'] },
  idol_photo: { effects: { fans: 3 }, memory: ['Posted a photo with his idol {x}', 'Shared a then-and-now picture with {x}', 'Fans loved his photo with {x}'] },
  idol_thanks: { effects: { media: 1, fans: 1 }, memory: ['Thanked {x} publicly for the inspiration', 'Paid tribute to {x} in an interview', 'Wrote a heartfelt message to {x}'] },
  dream_step: { effects: { manager: 2, media: 1 }, memory: ['Took a real step towards his dream: {x}', 'Spent the day working on his dream ({x})', 'Made a plan for {x} with the people who matter'] },
  dream_share: { effects: { fans: 2, media: 2 }, memory: ['Told fans about his dream: {x}', 'Opened up about {x} in an interview', 'Shared why {x} matters so much to him'] },
  dream_plan: { effects: { manager: 1, squad: 1 }, memory: ['Wrote down the next steps towards {x}', 'Quietly set new goals around {x}', 'Talked {x} through with a mentor'] },
  turn_reflect: { effects: { manager: 1 }, memory: ['Looked back on the day that changed everything: {x}', 'Took a moment to remember {x}', 'Reflected on how far he has come since {x}'] },
  turn_post: { effects: { fans: 2, media: 2 }, memory: ['Shared the story of {x} with his fans', 'Posted about {x}, years later', 'Told the story of {x} in a long post'] },
  turn_visit: { effects: { fans: 2, squad: 1 }, memory: ['Went back to where {x} happened', 'Visited the people who were there for {x}', 'Returned to the place of {x}'] },
  fcr_tribute: { effects: { fans: 4, media: 2 }, memory: ['Paid tribute to {x}, his first club, before facing them', 'Spoke warmly about {x} on the eve of the game', 'Thanked {x}’s fans before playing them'] },
  fcr_focus: { effects: { manager: 3 }, memory: ['Kept his emotions in check before facing {x}', 'Treated the {x} game like any other', 'Prepared quietly for the reunion with {x}'] },
  fcr_visit: { effects: { fans: 2, squad: 1 }, memory: ['Visited {x}’s academy before the game', 'Dropped in on his old coaches at {x}', 'Met the youngsters at {x}, his first club'] },
  fcr_quiet_word: { effects: { squad: 2 }, memory: ['Told his teammates what {x} means to him', 'Shared stories of his {x} years in the dressing room', 'Gave the squad a tour of his {x} memories'] },
};

const PERSONA_EVENT_KINDS = [
  { key: 'persona_hobby', category: 'personal', value: (p) => p?.flavor?.hobby, choices: ['hobby_friends', 'hobby_solo', 'hobby_charity', 'hobby_film', 'hobby_teammate'] },
  { key: 'persona_hometown', category: 'family', value: (p) => p?.roots?.hometown, choices: ['home_family', 'home_kids', 'home_quiet', 'home_press', 'home_old_friends'] },
  { key: 'persona_idol', category: 'media', value: (p) => p?.flavor?.idol, choices: ['idol_meet', 'idol_advice', 'idol_photo', 'idol_thanks'] },
  { key: 'persona_dream', category: 'personal', value: (p) => p?.flavor?.dream, choices: ['dream_step', 'dream_share', 'dream_plan'] },
  { key: 'persona_turning', category: 'personal', value: (p) => p?.flavor?.turningPoint, choices: ['turn_reflect', 'turn_post', 'turn_visit'] },
];

// La ville natale sans voyage possible : un autre titre (« Un peu de … ») et des choix sur place.
const HOMETOWN_NEAR = { key: 'persona_roots', choices: ['home_visit', 'home_call', 'home_taste', 'home_kids_remote', 'home_radio'] };

/** Plans the next persona event (one at a time, 18-30 days apart) and the first-club reunion. */
function seedPersonaEvents(state, snapshot, simDate, occupied, newId) {
  const cal = state.calendar;
  const persona = state.persona || {};
  const added = [];
  if (!cal || !isIso(simDate)) return added;
  // a reunion with his first club: the day before the fixture
  const busy = matchDates(state);
  const firstClub = clean(persona?.roots?.academy, 60).toLowerCase();
  if (firstClub.length >= 3) {
    for (const f of (snapshot?.fixtures || []).filter((x) => !x.played && x.date > simDate && x.date <= addDays(simDate, 14))) {
      const opp = [f.home, f.away].find((t) => t && t !== snapshot?.club?.name) || '';
      if (!opp || !(opp.toLowerCase().includes(firstClub) || firstClub.includes(opp.toLowerCase()))) continue;
      const eve = addDays(f.date, -1);
      if (eve <= simDate || busy.has(eve) || cal.systemEvents.some((e) => e.eventKey === 'first_club_return' && e.date === eve)) continue;
      const ev = { id: newId(), eventKey: 'first_club_return', date: eve, category: 'media', title: opp, systemGenerated: true, choiceIds: ['fcr_tribute', 'fcr_focus', 'fcr_visit', 'fcr_quiet_word'] };
      cal.systemEvents.push(ev);
      added.push(ev);
      occupied.add(eve);
    }
  }
  // the next persona event
  if (cal.systemEvents.some((e) => String(e.eventKey).startsWith('persona_') && e.date >= simDate)) return added;
  if (cal.nextPersonaEventOn && simDate < cal.nextPersonaEventOn) return added;
  const kinds = PERSONA_EVENT_KINDS.filter((k) => clean(k.value(persona)));
  if (!kinds.length) return added;
  const recent = cal.recentPersonaKinds || [];
  const fresh = kinds.filter((k) => !recent.includes(k.key));
  const pool = fresh.length ? fresh : kinds;
  const pick = pool[hash(`${state.careerId || ''}|${simDate}|persona`) % pool.length];
  let date = addDays(simDate, 3 + (hash(`${simDate}|pd`) % 8));
  for (let i = 0; i < 10 && occupied.has(date); i += 1) date = addDays(date, 1);
  // a trip home only with 4+ match-free days in a row; otherwise home comes to him (visit, call, a taste of home)
  const near = pick.key === 'persona_hometown' && !canTravelHome(state, date, busy);
  const eventKey = near ? HOMETOWN_NEAR.key : pick.key;
  const pool3 = near ? HOMETOWN_NEAR.choices : pick.choices;
  // three of the kind's choices, a different set from one time to the next
  const start = hash(`${state.careerId || ''}|${date}|${pick.key}`) % pool3.length;
  const choiceIds = [0, 1, 2].map((i) => pool3[(start + i) % pool3.length]).filter((v, i, a) => a.indexOf(v) === i);
  const ev = { id: newId(), eventKey, date, category: pick.category, title: clean(pick.value(persona)), systemGenerated: true, choiceIds };
  cal.systemEvents.push(ev);
  occupied.add(date);
  added.push(ev);
  cal.recentPersonaKinds = [...recent, pick.key].slice(-Math.max(1, kinds.length - 1));
  cal.nextPersonaEventOn = addDays(date, 18 + (hash(`${date}|next`) % 13));
  return added;
}

/** The decision of a persona event (or the first-club reunion). */
function personaDecision(sys) {
  const ids = sys.choiceIds?.length ? sys.choiceIds : [];
  const choices = ids.filter((id) => PERSONA_CHOICES[id]).map((id) => {
    const c = PERSONA_CHOICES[id];
    const mem = c.memory[hash(`${sys.id}|${id}`) % c.memory.length].replace(/\{x\}/g, sys.title || '');
    return { id, cost: c.cost || 0, effects: { ...c.effects }, ...(c.followerDelta ? { followerDelta: c.followerDelta } : {}), memory: mem };
  });
  return { id: `dec_sys_${sys.id}`, kind: 'persona_event', eventKey: sys.eventKey, category: sys.category, date: sys.date, title: sys.title, choices };
}

// Choix écrits par l'IA pour un événement avec des proches (2.0) : l'IA écrit les phrases, le code fixe les effets
// d'après une petite liste (jamais négatifs).
const AI_CHOICE_KINDS = {
  warm: { effects: { squad: 1, fans: 1 } },
  generous: { cost: 1500, effects: { fans: 2, media: 1 } },
  quiet: { effects: { manager: 1 } },
  public: { effects: { media: 3, fans: 2 } },
  focused: { effects: { manager: 2 } },
};

// Sans IA (pas de clé, erreur) : trois genres de choix tirés au sort, deux tournures chacun, traduits dans l'app
// (id fb_<genre>_<n>) et qui nomment les proches.
function fallbackEventChoices(ev) {
  const who = (ev.people || []).map((p) => p.name).filter(Boolean);
  const whoText = who.length > 1 ? `${who.slice(0, -1).join(', ')} & ${who.at(-1)}` : who[0] || '';
  const kinds = ['warm', 'generous', 'quiet', 'public', 'focused'];
  const start = hash(`${ev.id}|${ev.date}`) % kinds.length;
  return [0, 1, 2].map((i) => kinds[(start + i) % kinds.length]).map((kind) => ({ id: `fb_${kind}_${hash(`${ev.id}|${kind}`) % 2}`, kind, who: whoText }));
}

/** Normalises what the AI returned: 2-3 choices, each with a known kind and a short label. */
function normalizeAiChoices(raw) {
  const list = Array.isArray(raw?.choices) ? raw.choices : [];
  const out = [];
  for (const c of list) {
    const kind = String(c?.kind || '').toLowerCase();
    const label = clean(c?.label, 70);
    if (!AI_CHOICE_KINDS[kind] || !label || out.some((x) => x.kind === kind)) continue;
    out.push({ id: `ai_${out.length}`, kind, label });
    if (out.length === 3) break;
  }
  return out.length >= 2 ? out : null;
}

function eventChoicesToDecision(ev) {
  return (ev.aiChoices || []).map((c) => {
    const k = AI_CHOICE_KINDS[c.kind] || AI_CHOICE_KINDS.warm;
    return { id: c.id, ...(c.label ? { label: c.label } : {}), ...(c.who ? { who: c.who } : {}), cost: k.cost || 0, effects: { ...k.effects }, memory: `${ev.title} with ${(ev.people || []).map((p) => p.name).join(', ') || 'his circle'}: ${c.label || `${c.kind} time`}` };
  });
}

module.exports = { PERSONA_CHOICES, PERSONA_EVENT_KINDS, AI_CHOICE_KINDS, seedPersonaEvents, personaDecision, fallbackEventChoices, normalizeAiChoices, eventChoicesToDecision };
