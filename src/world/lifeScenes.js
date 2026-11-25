'use strict';
// Scènes narratives immersives et réactions croisées (Kop & Vestiaire) pour « Ma vie » :
// aucun appel IA supplémentaire, textes localisés en 6 langues et noms lisibles (sans variables internes).

const { activeHuddle, addMessage } = require('./huddle');
const { circlePersonHandle } = require('./persona');
const { isFar, canTravelHome } = require('./lifeGeo');
const { CATALOG_NAMES } = require('./texts/catalog');
const { CIRCLE_MORE, BRAND_MORE, SIGNED_MORE } = require('./texts/kop');
const { TOWN_TRIP, TOWN_VISIT, ABROAD_VISIT, PURCHASE_VARIANTS, DILEMMA_HEADLINES, DILEMMA_TAILS, ACTION_VARIANTS, CAL_NARRATIVES, CAL_KOP, CAL_HUDDLE, CAL_PERSONA_HEAD, CAL_MEDIA_KIND, CAL_FAR_ONE, CAL_FAR_MANY, CAL_AND } = require('./texts/scenes');

const CATALOG_ENGLISH_NAMES = CATALOG_NAMES.en;

function normLang(lang) {
  return CATALOG_NAMES[lang] ? lang : 'en';
}

function humanizeFallback(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(s)) {
    const clean = s.replace(/_/g, ' ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return s;
}

function catalogDisplayName(assetOrId, language = 'en') {
  const l = normLang(language);
  if (assetOrId && typeof assetOrId === 'object') {
    if (assetOrId.custom && assetOrId.name) return String(assetOrId.name);
    const id = assetOrId.catalogId || assetOrId.id || assetOrId.name;
    return CATALOG_NAMES[l]?.[id] || CATALOG_NAMES.en[id] || humanizeFallback(assetOrId.name || id);
  }
  const id = String(assetOrId || '');
  return CATALOG_NAMES[l]?.[id] || CATALOG_NAMES.en[id] || humanizeFallback(id);
}

const hashStr = (s) => {
  let h = 2166136261;
  for (const ch of String(s || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function pickInnerCircle(state, seed) {
  const circle = state?.persona?.circle;
  if (!circle || typeof circle !== 'object') return null;
  const list = [];
  for (const group of ['family', 'friends', 'roots', 'business']) {
    for (const p of Array.isArray(circle[group]) ? circle[group] : []) {
      if (p?.name) list.push({ name: p.name, role: p.role || group, kopPersonality: p.kopPersonality || '', group, lives: p.lives || '' });
    }
  }
  if (!list.length) return null;
  return list[hashStr(seed) % list.length];
}

function pickKopInnerCircle(state, seed) {
  const circle = state?.persona?.circle;
  if (!circle || typeof circle !== 'object') return null;
  const list = [];
  for (const group of ['family', 'friends', 'roots', 'business']) {
    for (const p of Array.isArray(circle[group]) ? circle[group] : []) {
      if (p?.name && p?.kopPersonality) {
        list.push({ name: p.name, role: p.role || group, kopPersonality: p.kopPersonality, group });
      }
    }
  }
  if (!list.length) return null;
  return list[hashStr(seed) % list.length];
}

function brandHandleOf(brand) {
  const slug = String(brand || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 20);
  return slug || 'OfficialPartner';
}

function ensureBrandKopAccount(state, brand, category = '') {
  const cleanBrand = String(brand || 'Partner').trim();
  const handle = brandHandleOf(cleanBrand);
  state.accounts = state.accounts || {};
  state.accounts[handle] = {
    ...(state.accounts[handle] || {}),
    name: cleanBrand,
    type: 'brand',
    brand: cleanBrand,
    ...(category ? { category } : {}),
    verified: true,
  };
  return { handle, name: cleanBrand, type: 'brand', brand: cleanBrand, category, verified: true };
}

function ensureCircleKopAccount(state, person) {
  const handle = circlePersonHandle(person);
  state.accounts = state.accounts || {};
  state.accounts[handle] = {
    ...(state.accounts[handle] || {}),
    name: person.name,
    type: 'circle',
    role: person.role || person.group || '',
    kopPersonality: person.kopPersonality || 'supportive',
    verified: false,
  };
  return {
    handle,
    name: person.name,
    type: 'circle',
    role: person.role || person.group || '',
    kopPersonality: person.kopPersonality || 'supportive',
    verified: false,
  };
}

// Pas de répétition (2.0) : pour chaque ensemble de phrases, on se souvient des dernières utilisées (dans la carrière)
// et on en prend une autre tant qu'il en reste.
function pickFresh(state, key, list, seed) {
  if (!list?.length) return null;
  const mem = state ? (state.lineMemory ||= {}) : {};
  const recent = Array.isArray(mem[key]) ? mem[key] : [];
  const all = list.map((_, i) => i);
  const free = all.filter((i) => !recent.includes(i));
  const pool = free.length ? free : all;
  const idx = pool[hashStr(String(seed)) % pool.length];
  if (state) mem[key] = [...recent, idx].slice(-Math.max(1, Math.min(list.length - 1, 12)));
  return list[idx];
}

function buildBrandProfessionalPost(brand, handleTag, obKind, spCat, language, seed, state = null) {
  const l = normLang(language);
  const tag = `#${brandHandleOf(brand)}`;
  if (obKind === 'deal_signed') {
    return trScene(l, pickFresh(state, 'brand:signed', [{
      fr: `Bienvenue dans la famille ${brand}, ${handleTag}. L'exigence et l'ambition au service de la performance. 🤝✨ ${tag}`,
      en: `Welcome to the ${brand} family, ${handleTag}. Built on precision, ambition, and excellence on and off the pitch. 🤝✨ ${tag}`,
      pt: `Bem-vindo à família ${brand}, ${handleTag}. Excelência, ambição e alta performance dentro e fora de campo. 🤝✨ ${tag}`,
      es: `Bienvenido a la familia ${brand}, ${handleTag}. Excelencia, ambición y rendimiento dentro y fuera del campo. 🤝✨ ${tag}`,
      it: `Benvenuto nella famiglia ${brand}, ${handleTag}. Eccellenza, ambizione e performance dentro e fuori dal campo. 🤝✨ ${tag}`,
      de: `Willkommen in der ${brand}-Familie, ${handleTag}. Präzision, Ehrgeiz und Spitzenleistung auf und neben dem Platz. 🤝✨ ${tag}`,
    }, ...SIGNED_MORE(handleTag, tag, brand)], `${brand}|${seed}`));
  }
  const pool = [
    {
      fr: `Fiers de dévoiler notre nouvelle activation aux côtés de ${handleTag}. Le souci du détail fait toute la différence. ${tag}`,
      en: `Proud to unveil our latest chapter alongside ${handleTag}. Relentless focus and attention to detail in every frame. ${tag}`,
      pt: `Orgulho em revelar nosso novo capítulo ao lado de ${handleTag}. Foco total e atenção a cada detalhe. ${tag}`,
      es: `Orgullosos de presentar nuestro nuevo capítulo junto a ${handleTag}. Enfoque absoluto y cuidado por cada detalle. ${tag}`,
      it: `Orgogliosi di svelare il nostro nuovo capitolo insieme a ${handleTag}. Cura dei dettagli e massima determinazione. ${tag}`,
      de: `Stolz, unser neuestes Kapitel gemeinsam mit ${handleTag} zu präsentieren. Fokus und Präzision bis ins kleinste Detail. ${tag}`,
    },
    {
      fr: `Dans les coulisses avec ${handleTag} aujourd'hui. Une même vision de l'excellence au quotidien. ✨ ${tag}`,
      en: `Behind the scenes with ${handleTag} today. Sharing a commitment to peak standards every single day. ✨ ${tag}`,
      pt: `Nos bastidores com ${handleTag} hoje. O mesmo compromisso com a excelência todos os dias. ✨ ${tag}`,
      es: `Detrás de las cámaras hoy con ${handleTag}. Un mismo compromiso con la excelencia cada día. ✨ ${tag}`,
      it: `Dietro le quinte oggi con ${handleTag}. La stessa visione di eccellenza, ogni singolo giorno. ✨ ${tag}`,
      de: `Heute hinter den Kulissen mit ${handleTag}. Ein gemeinsamer Anspruch an höchste Standards, jeden Tag. ✨ ${tag}`,
    },
    {
      fr: `Quand le talent rencontre l'innovation : ${brand} × ${handleTag}. La campagne continue. ${tag}`,
      en: `Where elite performance meets craftsmanship: ${brand} × ${handleTag}. Setting the pace together. ${tag}`,
      pt: `Onde a alta performance encontra a inovação: ${brand} × ${handleTag}. Ditando o ritmo juntos. ${tag}`,
      es: `Donde el alto rendimiento se une a la innovación: ${brand} × ${handleTag}. Marcando el ritmo juntos. ${tag}`,
      it: `Dove la performance d'élite incontra l'innovazione: ${brand} × ${handleTag}. Insieme per dettare il passo. ${tag}`,
      de: `Wo Spitzenleistung auf Innovation trifft: ${brand} × ${handleTag}. Gemeinsam Maßstäbe setzen. ${tag}`,
    },
    {
      fr: `Un plaisir d'accueillir ${handleTag} avec nos équipes aujourd'hui. Professionnalisme exemplaire du début à la fin. 🤝 ${tag}`,
      en: `A privilege hosting ${handleTag} with our team today. World-class professionalism from start to finish. 🤝 ${tag}`,
      pt: `Um privilégio receber ${handleTag} com nossa equipe hoje. Profissionalismo de classe mundial do início ao fim. 🤝 ${tag}`,
      es: `Un privilegio recibir hoy a ${handleTag} con nuestro equipo. Profesionalidad de primer nivel de principio a fin. 🤝 ${tag}`,
      it: `Un privilegio ospitare ${handleTag} con il nostro team oggi. Professionalità esemplare dall'inizio alla fine. 🤝 ${tag}`,
      de: `Es war uns eine Ehre, ${handleTag} heute bei unserem Team zu begrüßen. Weltklasse-Professionalität von Anfang bis Ende. 🤝 ${tag}`,
    },
  ];
  pool.push(...BRAND_MORE(handleTag, tag, brand));
  return trScene(l, pickFresh(state, 'brand:post', pool, `${brand}|${obKind}|${spCat}|${seed}`));
}

function buildCircleKopReaction(person, handleTag, eventKind, language, seed, state = null) {
  if (!person?.name || !person?.kopPersonality) return null;
  const l = normLang(language);
  const p = person.kopPersonality;
  const templates = {
    supportive: [
      {
        fr: `Tellement fier/fière de voir ${handleTag} continuer d'avancer sans jamais oublier d'où il vient ❤️🙏`,
        en: `Always so proud watching ${handleTag} grow on and off the pitch while staying true to his roots ❤️🙏`,
        pt: `Tanto orgulho de ver ${handleTag} conquistando tudo isso sem nunca esquecer suas raízes ❤️🙏`,
        es: `Qué orgullo ver a ${handleTag} seguir creciendo sin olvidar nunca de dónde viene ❤️🙏`,
        it: `Sempre più orgogliosi di vedere ${handleTag} crescere restando fedele alle proprie radici ❤️🙏`,
        de: `So stolz zu sehen, wie ${handleTag} seinen Weg geht und dabei nie vergisst, woher er kommt ❤️🙏`,
      },
      {
        fr: `Le travail de l'ombre finit toujours par payer. Continue de briller ${handleTag} ✨❤️`,
        en: `Nobody sees all the quiet hours behind the scenes, makes every milestone even sweeter ${handleTag} ✨❤️`,
        pt: `Só quem acompanha de perto sabe o quanto você trabalhou por cada conquista, ${handleTag} ✨❤️`,
        es: `Nadie ve todas las horas de esfuerzo detrás de cada paso. Te lo mereces todo, ${handleTag} ✨❤️`,
        it: `Solo chi c'è da sempre sa quanto lavoro c'è dietro ogni traguardo. Continua così ${handleTag} ✨❤️`,
        de: `Wer dich kennt, weiß, wie viel harte Arbeit dahintersteckt. Weiter so, ${handleTag} ✨❤️`,
      },
    ],
    playful: [
      {
        fr: `Dis donc ${handleTag}, même avec tous ces projecteurs tu restes quand même de corvée de vaisselle au prochain repas 😂❤️`,
        en: `Looking very fancy out there ${handleTag}, just remember you're still on dish duty at the next family dinner 😂❤️`,
        pt: `Muito chique ${handleTag}, mas não esquece que no próximo churrasco a louça ainda é tua 😂❤️`,
        es: `Muy elegante ${handleTag}, pero recuerda que en la próxima cena familiar te sigue tocando fregar los platos 😂❤️`,
        it: `Tutto molto elegante ${handleTag}, ma alla prossima cena di famiglia ti tocca comunque sparecchiare 😂❤️`,
        de: `Sieht sehr schick aus ${handleTag}, aber beim nächsten Familienessen bist trotzdem du mit Abspülen dran 😂❤️`,
      },
      {
        fr: `On valide le style ${handleTag} 👀 Essaie juste de ne pas prendre la grosse tête avant dimanche 😂🙌`,
        en: `Alright we see you ${handleTag} 👀 Try not to let the superstar life get to your head before Sunday 😂🙌`,
        pt: `Olha ele todo estrela ${handleTag} 👀 Vê se não esquece dos amigos agora hein 😂🙌`,
        es: `Míralo qué nivel ${handleTag} 👀 No te olvides de los de siempre ahora eh 😂🙌`,
        it: `Guardatelo che stile ${handleTag} 👀 Vedi di non montarti la testa prima di domenica 😂🙌`,
        de: `Na schau mal einer an ${handleTag} 👀 Heb uns bloß nicht ab bis Sonntag 😂🙌`,
      },
    ],
    hype: [
      {
        fr: `C'est LUI !! ${handleTag} à un autre niveau sur le terrain comme en dehors 🔥🚀`,
        en: `THAT'S HIM!! ${handleTag} operating on a completely different level right now 🔥🚀`,
        pt: `É ELE!! ${handleTag} voando baixo dentro e fora de campo, ninguém segura 🔥🚀`,
        es: `¡¡ES ÉL!! ${handleTag} a otro nivel dentro y fuera de la cancha 🔥🚀`,
        it: `È LUI!! ${handleTag} su un altro pianeta dentro e fuori dal campo 🔥🚀`,
        de: `ER IST ES EINFACH!! ${handleTag} auf und neben dem Platz auf einem ganz anderen Level 🔥🚀`,
      },
    ],
    protective: [
      {
        fr: `Pendant que certains parlent, ${handleTag} trace sa route avec sérieux. Les vrais savent 💯🛡️`,
        en: `While outside noise comes and goes, ${handleTag} just keeps working and delivering. The real ones know 💯🛡️`,
        pt: `Enquanto falam por aí, ${handleTag} segue trabalhando calado e conquistando seu espaço. Os de verdade sabem 💯🛡️`,
        es: `Mientras otros hablan, ${handleTag} sigue trabajando en silencio y demostrando quién es. Los suyos siempre firmes 💯🛡️`,
        it: `Mentre fuori parlano, ${handleTag} continua a lavorare a testa bassa. Chi ti conosce sa quanto vali 💯🛡️`,
        de: `Während andere reden, geht ${handleTag} fokussiert seinen Weg. Die Echten wissen Bescheid 💯🛡️`,
      },
    ],
    professional: [
      {
        fr: `Étape après étape, avec cohérence et exigence. Félicitations ${handleTag} pour cette belle dynamique 🤝`,
        en: `Step by step, built on consistency and high standards. Pleased to see ${handleTag}'s continued momentum 🤝`,
        pt: `Passo a passo, com consistência e planejamento. Parabéns a ${handleTag} por mais um movimento sólido 🤝`,
        es: `Paso a paso, con constancia y criterio. Enhorabuena a ${handleTag} por seguir construyendo con solidez 🤝`,
        it: `Passo dopo passo, con coerenza e professionalità. Complimenti a ${handleTag} per questo percorso 🤝`,
        de: `Schritt für Schritt, mit Konstanz und klarem Anspruch. Glückwunsch an ${handleTag} zu dieser Entwicklung 🤝`,
      },
    ],
  };
  const more = CIRCLE_MORE(handleTag);
  const key = templates[p] || more[p] ? p : 'supportive';
  const list = [...(templates[key] || []), ...(more[key] || [])];
  return trScene(l, pickFresh(state, `circle:${key}`, list, `${person.name}|${eventKind}|${seed}`));
}

// Le lieu dans « {P} passe la journée avec {F}{W} » : rien quand on ne sait pas où vit le proche ou qu'il vit à côté.
function innerTownText(l, inner, hometown, tripOk) {
  if (!inner) return '';
  if (inner.lives === 'abroad') return ` ${trScene(l, ABROAD_VISIT)}`;
  if (inner.lives === 'hometown' && hometown) return ` ${trScene(l, tripOk ? TOWN_TRIP : TOWN_VISIT, { T: hometown })}`;
  return '';
}

function resolveContext(state, snapshot, event, language) {
  const l = normLang(language);
  const player = snapshot?.player?.name || state?.profile?.displayName || (l === 'fr' ? 'Le joueur' : 'The player');
  const club = snapshot?.club?.name || (l === 'fr' ? 'le club' : 'the club');
  const stadium = snapshot?.club?.stadium || '';
  const captain = snapshot?.squadIntel?.captain && !snapshot.squadIntel.captain.me ? snapshot.squadIntel.captain.name : '';
  const group = activeHuddle(state);
  const pool = [...new Set([
    ...(Array.isArray(group?.players) ? group.players : []),
    ...((snapshot?.squad || []).filter((p) => p?.name && !p.me).map((p) => p.name)),
  ])].filter((n) => n && n.toLowerCase() !== player.toLowerCase());
  const seed = `${snapshot?.gameDate || ''}|${event?.kind || ''}|${event?.refId || ''}|${(state?.lifeHub?.scenes || []).length}`;
  const explicitComp = String(event?.companion || '').trim();
  const teammate = explicitComp || captain || (pool.length ? pool[hashStr(seed) % pool.length] : '');
  const inner = pickInnerCircle(state, seed);
  const hometown = state?.persona?.roots?.hometown || '';
  // un proche qui vit loin vient le voir ; un retour à la maison seulement avec 4 jours sans match ou plus (2.0)
  const tripOk = canTravelHome(state, event?.date || snapshot?.gameDate || state?.lifeHub?.lastTickDate || '');
  const innerTown = innerTownText(l, inner, hometown, tripOk);
  const sponsors = (state?.lifeHub?.sponsors || []).filter((s) => s?.brand);
  const pickedSp = sponsors.length ? sponsors[hashStr(seed) % sponsors.length] : null;
  const topSponsor = pickedSp?.brand || '';
  const topSponsorCategory = pickedSp?.categories?.[0] || pickedSp?.category || '';
  const owned = state?.lifeHub?.assets || [];
  const hasChef = owned.some((a) => a.catalogId === 'personal_chef');
  const hasPhysio = owned.some((a) => a.catalogId === 'personal_physio');
  return { l, player, club, stadium, captain, teammate, inner, hometown, innerTown, tripOk, topSponsor, topSponsorCategory, hasChef, hasPhysio, seed };
}

const FAN_PERSONAS = {
  fr: (slug, club) => ({ handle: `${slug}Tribune` || 'SupporterClub', name: club && club !== 'le club' ? `${club} Tribune` : 'Tribune Supporters' }),
  en: (slug, club) => ({ handle: `${slug}FanZone` || 'MatchdayVoice', name: club && club !== 'the club' ? `${club} Fan Zone` : 'Matchday Voice' }),
  pt: (slug, club) => ({ handle: `${slug}Torcida` || 'VozDaArquibancada', name: club && club !== 'the club' ? `Torcida ${club}` : 'Voz da Arquibancada' }),
  es: (slug, club) => ({ handle: `${slug}Grada` || 'VozDeLaGrada', name: club && club !== 'the club' ? `Grada ${club}` : 'Voz de la Grada' }),
  it: (slug, club) => ({ handle: `${slug}Curva` || 'VoceDellaCurva', name: club && club !== 'the club' ? `Curva ${club}` : 'Voce della Curva' }),
  de: (slug, club) => ({ handle: `${slug}Fankurve` || 'KurvenEcho', name: club && club !== 'the club' ? `${club} Fankurve` : 'Kurven Echo' }),
};

function findOrCreateFanAuthor(state, club, language) {
  const myHandle = String(state?.profile?.handle || '').toLowerCase();
  const accounts = state.accounts || {};
  const existing = Object.entries(accounts).filter(([h, v]) => {
    if (!h || h.toLowerCase() === myHandle) return false;
    return v && v.type === 'fan' && (!v.supports || !club || v.supports === club);
  });
  if (existing.length) {
    const pick = existing[hashStr(`${club}|${(state.feed || []).length}`) % existing.length];
    return { handle: pick[0], name: pick[1].name || pick[0], type: 'fan', verified: false };
  }
  const slug = String(club || 'Club').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'Club';
  const gen = (FAN_PERSONAS[normLang(language)] || FAN_PERSONAS.en)(slug, club);
  let handle = gen.handle.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20) || 'MatchdayFan';
  if (handle.toLowerCase() === myHandle) handle = `${handle.slice(0, 17)}Fan`;
  state.accounts = state.accounts || {};
  if (!state.accounts[handle]) {
    state.accounts[handle] = { name: gen.name, type: 'fan', ...(club ? { supports: club } : {}) };
  }
  return { handle, name: state.accounts[handle].name || gen.name, type: 'fan', verified: false };
}

function pushKopReaction(state, { club, gameDate, language, newId, customAuthor = null, replyAuthor = null, replyText = '' }, text) {
  if (!text) return null;
  state.feed = state.feed || [];
  const author = customAuthor || findOrCreateFanAuthor(state, club, language);
  const fol = Math.max(400, Number(state?.profile?.followers) || 4200);
  const scale = Math.min(25, Math.max(0.4, Math.sqrt(fol / 4200))) * (author.type === 'brand' ? 1.8 : 1);
  const h = hashStr(`${text}|${gameDate}|${state.feed.length}`);
  const likes = Math.max(12, Math.round((35 + (h % 140)) * scale));
  const reposts = Math.max(2, Math.round(likes * 0.14));
  const replies = [];
  if (replyAuthor && replyText) {
    const rLikes = Math.max(6, Math.round(likes * 0.25));
    replies.push({
      id: newId(),
      author: replyAuthor,
      text: replyText,
      gameDate: gameDate || '',
      createdAt: Date.now() + 1,
      likes: rLikes,
      reposts: Math.max(1, Math.round(rLikes * 0.1)),
    });
  }
  const post = {
    id: newId(),
    author,
    text,
    gameDate: gameDate || '',
    createdAt: Date.now(),
    aboutPost: null,
    replies,
    likes,
    reposts,
    lifeScene: true,
    ...(author.type === 'brand' ? { official: true } : {}),
  };
  state.feed.push(post);
  return { channel: 'kop', from: `@${author.handle}`, authorName: author.name, text };
}

function pushHuddleReaction(state, { gameDate, teammate, captain }, text, preferredRole = null, reactions = [['😂', 3]]) {
  const group = activeHuddle(state);
  if (!group || !text) return null;
  let from = '';
  let role = null;
  if (preferredRole && Array.isArray(group.staff)) {
    const st = group.staff.find((p) => p.role === preferredRole);
    if (st) { from = st.name; role = st.role; }
  }
  if (!from && Array.isArray(group.players) && group.players.length) {
    from = [teammate, captain].find((n) => n && group.players.some((p) => p.toLowerCase() === n.toLowerCase()));
    if (!from) from = group.players[hashStr(`${text}|${group.messages.length}`) % group.players.length];
    const exact = group.players.find((p) => p.toLowerCase() === from.toLowerCase());
    if (exact) from = exact;
  }
  if (!from && group.coach && preferredRole === 'coach') {
    from = group.coach;
    role = 'coach';
  }
  if (!from) return null;
  addMessage(group, { who: 'them', from, ...(role ? { role } : {}), gameDate: gameDate || '', text, reactions });
  return { channel: 'huddle', from, groupName: group.club || '', text };
}

// ---------- Modèles narratifs localisés (6 langues) ----------

function trScene(lang, table, vars = {}) {
  const str = (table[lang] || table.en || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
  return str.replace(/\s+/g, ' ').trim();
}

const LUX_CAR_IDS = ['car_supercar', 'car_sports', 'car_classic', 'car_electric_gt', 'exotic_supercar', 'luxury_gt'];
function renderPurchaseScene(ctx, asset, handleTag) {
  const base = renderPurchaseSceneBase(ctx, asset, handleTag);
  const { l, player, club } = ctx;
  const cat = asset?.category || 'custom';
  const cid = asset?.catalogId || '';
  const price = Number(asset?.price) || 0;
  const group = cid === 'parents_house' ? 'parents'
    : ['venture', 'collection', 'luxury'].includes(cat) ? cat
      : (LUX_CAR_IDS.includes(cid) || (cat === 'car' && price >= 40000)) ? 'car'
        : (cid === 'luxury_villa' || cid === 'penthouse' || (cat === 'home' && price >= 450000)) ? 'home'
          : ['charity', 'staff', 'investment'].includes(cat) ? cat : null;
  if (!group) return base;
  const vars = { I: catalogDisplayName(asset, l), P: player, C: club, H: handleTag };
  const fill = (t) => (t ? trScene(l, t, vars) : null);
  const variants = PURCHASE_VARIANTS[group].map((v) => ({ headline: fill(v.h), narrative: fill(v.n), kop: fill(v.k), huddle: fill(v.u) }));
  const fresh = ['venture', 'collection', 'luxury', 'parents'].includes(group);
  const options = fresh
    ? variants.map((v) => ({ ...base, ...v }))
    : [base, ...variants.map((v) => ({ ...base, headline: v.headline, narrative: v.narrative, kop: base.kop && v.kop ? v.kop : base.kop, huddle: base.huddle && v.huddle ? v.huddle : base.huddle }))];
  return pickFresh(ctx.state, `buy:${group}`, options, `${ctx.seed}|${cid}`);
}

function renderDilemmaScene(ctx, dilemmaId, choiceId, handleTag) {
  const base = renderDilemmaSceneBase(ctx, dilemmaId, choiceId, handleTag);
  const head = DILEMMA_HEADLINES[dilemmaId];
  const tail = pickFresh(ctx.state, 'dilemma:tail', DILEMMA_TAILS, `${ctx.seed}|${dilemmaId}|${choiceId}`);
  return { ...base, headline: head ? trScene(ctx.l, head) : base.headline, narrative: tail ? trScene(ctx.l, tail, { C: ctx.club }) : base.narrative };
}

function renderPurchaseSceneBase(ctx, asset, handleTag) {
  const { l, player, club, teammate, inner } = ctx;
  const item = catalogDisplayName(asset, l);
  const price = Number(asset?.price) || 0;
  const cat = asset?.category || 'custom';
  const cid = asset?.catalogId || '';

  if (['car_supercar', 'car_sports', 'car_classic', 'car_electric_gt', 'exotic_supercar', 'luxury_gt'].includes(cid) || (cat === 'car' && price >= 40000)) {
    const headline = trScene(l, {
      fr: `Arrivée remarquée : ${item}`,
      en: `Heads turn at the gates: ${item}`,
      pt: `Chegada de cinema ao CT: ${item}`,
      es: `Todas las miradas en el parking: ${item}`,
      it: `Tutti gli sguardi al cancello: ${item}`,
      de: `Aufsehen vor dem Trainingsgelände: ${item}`,
    });
    const narrative = trScene(l, {
      fr: `Dès l'arrivée au parking de ${club}, le bruit du moteur attire tout le monde autour du ${item}. {mate} sort son téléphone en riant pendant que les premiers supporters filment devant les grilles.`,
      en: `Pulling into the ${club} training ground in the ${item} stops conversation immediately. {mate} reaches for a phone laughing while supporters outside the gates record the arrival.`,
      pt: `Ao estacionar o ${item} no CT do ${club}, o ronco do motor paralisa a resenha. {mate} já saca o celular rindo enquanto torcedores filmam do lado de fora do portão.`,
      es: `Nada más aparcar el ${item} en la ciudad deportiva de ${club}, las cámaras y las miradas se giran al instante. {mate} saca el móvil entre risas mientras algunos aficionados graban en la puerta.`,
      it: `Appena la ${item} entra al centro sportivo del ${club}, si girano tutti. {mate} tira fuori il telefono ridendo mentre i tifosi fuori dai cancelli riprendono la scena.`,
      de: `Als der ${item} auf den Parkplatz von ${club} rollt, drehen sich sofort alle Köpfe. {mate} zückt lachend das Handy, während draußen am Tor bereits die ersten Fans filmen.`,
    }, { mate: teammate || (l === 'fr' ? 'Le vestiaire' : 'The squad') });
    const kop = trScene(l, {
      fr: `Vu devant le centre de ${club} ce matin : ${handleTag} vient de sortir le ${item} 👀🔥 Les primes de match travaillent fort !`,
      en: `Spotted outside ${club}'s training ground this morning — ${handleTag} just rolled in with a ${item} 👀🔥`,
      pt: `Flagra na porta do CT do ${club} hoje cedo: ${handleTag} chegou simplesmente de ${item} 👀🔥 A fase tá boa demais!`,
      es: `Cazado esta mañana en la puerta de ${club}: ${handleTag} ha llegado con un ${item} 👀🔥`,
      it: `Avvistato stamattina fuori dal centro del ${club}: ${handleTag} è arrivato con ${item} 👀🔥`,
      de: `Heute Morgen vor dem ${club}-Gelände gesichtet: ${handleTag} kommt einfach im ${item} vorgefahren 👀🔥`,
    });
    const huddle = trScene(l, {
      fr: `Euh chef, personne n'ose garer sa voiture à côté de ton ${item} aujourd'hui 😂 Tu paies un tour après l'entraînement ?`,
      en: `Nobody dares park next to your ${item} today mate 😂 taking the lads for a spin after training?`,
      pt: `Ninguém teve coragem de estacionar perto do teu ${item} hoje 😂 vai pagar uma volta pra rapaziada depois do treino?`,
      es: `Nadie se atreve a aparcar al lado de tu ${item} hoy 😂 ¿nos das una vuelta después del entreno?`,
      it: `Nessuno ha il coraggio di parcheggiare vicino alla tua ${item} oggi 😂 ci offri un giro dopo l'allenamento?`,
      de: `Heute traut sich keiner neben deinem ${item} zu parken 😂 gibt's nach dem Training eine Spritztour?`,
    });
    return { headline, narrative, kop, huddle, hudEmoji: [['😂', 4], ['🔥', 3]] };
  }

  if (cid === 'luxury_villa' || cid === 'penthouse' || (cat === 'home' && price >= 450000)) {
    const headline = trScene(l, {
      fr: `Nouveau repaire : ${item}`,
      en: `Keys to a new chapter: ${item}`,
      pt: `Casa nova no mapa: ${item}`,
      es: `Estrenando hogar: ${item}`,
      it: `Nuova casa: ${item}`,
      de: `Neues Zuhause: ${item}`,
    });
    const narrative = trScene(l, {
      fr: `${player} installe ses affaires dans son nouveau ${item}, un vrai saut de statut pour ${inner ? `accueillir ${inner.name} dans les meilleures conditions` : 'trouver le calme loin de la pression du week-end'}. Dans le vestiaire de ${club}, tout le monde réclame déjà la pendaison de crémaillère.`,
      en: `${player} settles into the ${item}${inner ? `, creating real space to host ${inner.name} away from the matchday noise` : ', building a quiet sanctuary away from the matchday spotlight'}. Back at ${club}, the dressing room is already demanding a housewarming barbecue.`,
      pt: `${player} se muda para ${item}${inner ? `, agora com conforto de sobra para receber ${inner.name} longe do barulho dos estádios` : ', garantindo paz e privacidade entre um jogo e outro'}. No vestiário do ${club}, a resenha já cobra o churrasco de inauguração.`,
      es: `${player} se instala en ${item}${inner ? `, por fin con sitio de sobra para recibir a ${inner.name} lejos del ruido` : ', ganando calma lejos de los focos del fin de semana'}. En el vestuario de ${club} ya reclaman cena de inauguración.`,
      it: `${player} prende casa in ${item}${inner ? `, finalmente con spazio per accogliere ${inner.name} lontano dalla pressione` : ', trovando quiete lontano dai riflettori del weekend'}. Nello spogliatoio del ${club} chiedono già la festa di inaugurazione.`,
      de: `${player} bezieht ${item}${inner ? ` und schafft endlich Raum für Besuche von ${inner.name} abseits des Trubels` : ' – ein ruhiger Rückzugsort abseits des Stadionlärms'}. In der Kabine von ${club} fordern schon alle die Einweihungsparty.`,
    });
    const kop = trScene(l, {
      fr: `Apparemment ${handleTag} vient de poser ses valises dans un ${item} en ville 🏡 Signe qu'il compte s'inscrire dans la durée à ${club} ?`,
      en: `Word around ${club} is ${handleTag} just picked up a ${item} in town 🏡 Looks like someone plans on staying a while!`,
      pt: `Dizem que ${handleTag} acabou de fechar um(a) ${item} na cidade 🏡 Será sinal de vida longa no ${club}?`,
      es: `Cuentan cerca de ${club} que ${handleTag} estrena ${item} en la ciudad 🏡 ¡Parece que viene para quedarse!`,
      it: `Si dice che ${handleTag} abbia appena preso ${item} in città 🏡 Segno che vuole restare a lungo al ${club}?`,
      de: `Man hört rund um ${club}, dass ${handleTag} sich ein(e) ${item} gesichert hat 🏡 Sieht nach längerem Verbleib aus!`,
    });
    const huddle = trScene(l, {
      fr: `Félicitations pour le ${item} ! On ramène les boissons quand pour la crémaillère ? 😄🏠`,
      en: `Congrats on the ${item}! When are we all coming round for dinner? 😄🏠`,
      pt: `Parabéns pelo novo ${item}! Quando vai rolar aquele churrasco pro elenco? 😄🏠`,
      es: `¡Enhorabuena por el ${item}! ¿Cuándo nos invitas a cenar a todos? 😄🏠`,
      it: `Complimenti per ${item}! Quando inviti tutta la squadra a cena? 😄🏠`,
      de: `Glückwunsch zum ${item}! Wann steigt der Mannschaftsabend bei dir? 😄🏠`,
    });
    return { headline, narrative, kop, huddle, hudEmoji: [['🔥', 4], ['👏', 3]] };
  }

  if (cat === 'charity' || cid === 'local_clinic_gift' || cid === 'foundation_launch') {
    const headline = trScene(l, {
      fr: `Un geste qui dépasse le terrain : ${item}`,
      en: `Impact beyond the pitch: ${item}`,
      pt: `Gol de placa fora de campo: ${item}`,
      es: `Un gesto que trasciende el fútbol: ${item}`,
      it: `Un gesto oltre il campo: ${item}`,
      de: `Einsatz über den Platz hinaus: ${item}`,
    });
    const narrative = trScene(l, {
      fr: `L'annonce du projet « ${item} » fait vite le tour de la ville et touche profondément les supporters de ${club}. Au centre d'entraînement, le capitaine et les cadres saluent une initiative qui donne une vraie épaisseur à ta carrière.`,
      en: `News of the ${item} spreads quickly through the city and resonates deeply with ${club} supporters. Inside the dressing room, senior teammates quietly tip their hats to a gesture that reaches far beyond football.`,
      pt: `A iniciativa "${item}" ganha destaque na cidade e emociona a torcida do ${club}. No CT, os líderes do elenco elogiam a postura de quem usa o sucesso para mudar realidades.`,
      es: `La noticia de "${item}" recorre rápido la ciudad y emociona a la afición de ${club}. En el vestuario, los capitanes aplauden un gesto que habla muy bien de ti fuera del campo.`,
      it: `La notizia di "${item}" fa presto il giro della città e conquista i tifosi del ${club}. Nello spogliatoio i compagni applaudono un gesto che va ben oltre i 90 minuti.`,
      de: `Die Nachricht über "${item}" macht schnell die Runde in der Stadt und berührt die Fans von ${club}. Auch in der Kabine zollen dir die Führungsspieler echten Respekt.`,
    });
    const kop = trScene(l, {
      fr: `Immense respect pour ${handleTag} 🙏 Ce geste pour « ${item} » montre l'humain derrière le maillot de ${club}. ❤️👏`,
      en: `Massive respect to ${handleTag} 🙏 Stepping up with the ${item} shows what kind of person wears the ${club} shirt. ❤️👏`,
      pt: `Respeito máximo por ${handleTag} 🙏 A ação "${item}" mostra o tamanho do caráter além da camisa do ${club}. ❤️👏`,
      es: `Enorme respeto por ${handleTag} 🙏 Lo de "${item}" demuestra la clase humana que hay detrás de la camiseta de ${club}. ❤️👏`,
      it: `Rispetto enorme per ${handleTag} 🙏 L'iniziativa "${item}" dimostra che uomo c'è dietro la maglia del ${club}. ❤️👏`,
      de: `Großer Respekt vor ${handleTag} 🙏 Dieses Engagement (${item}) zeigt echte Größe abseits des Rasens. ❤️👏`,
    });
    const huddle = trScene(l, {
      fr: `Chapeau pour ce que tu viens de faire (${item}), ça rend tout le groupe fier 👏❤️`,
      en: `Class act with the ${item} mate — whole dressing room is proud of that 👏❤️`,
      pt: `Atitude gigante com a ação "${item}", o grupo inteiro tira o chapéu pra ti 👏❤️`,
      es: `Gestazo enorme lo de "${item}", todo el vestuario está orgulloso 👏❤️`,
      it: `Gran gesto quello per "${item}", tutto lo spogliatoio ti fa i complimenti 👏❤️`,
      de: `Ganz starkes Zeichen mit "${item}", die ganze Kabine zieht den Hut 👏❤️`,
    });
    return { headline, narrative, kop, huddle, hudEmoji: [['❤️', 5], ['👏', 4]] };
  }

  if (cat === 'staff') {
    const headline = trScene(l, {
      fr: `Équipe resserrée autour de ${item}`,
      en: `Stepping up off the pitch: ${item}`,
      pt: `Estrutura profissional: ${item}`,
      es: `Equipo de apoyo ampliado: ${item}`,
      it: `Staff personale potenziato: ${item}`,
      de: `Profi-Support im Hintergrund: ${item}`,
    });
    const narrative = trScene(l, {
      fr: `Tu intègres un ${item} à ton quotidien entre les matchs de ${club}. Moins d'imprévus, une préparation millimétrée : tes coéquipiers remarquent vite la différence au vestiaire.`,
      en: `Bringing in a ${item} raises your day-to-day standards around ${club}. Between sessions, sharper routines and better recovery quickly catch teammates' attention.`,
      pt: `Ao contratar um ${item}, tua rotina fora do ${club} sobe de patamar. Menos improviso e foco total em cada detalhe — coisa que o elenco logo percebe no dia a dia.`,
      es: `Sumar un ${item} eleva tu día a día en ${club}. Con todo medido al milímetro entre partidos, tus compañeros notan rápido ese salto de exigencia.`,
      it: `Inserire ${item} nella routine quotidiana cambia il ritmo tra una partita e l'altra al ${club}. I compagni notano subito la cura dei dettagli.`,
      de: `Mit dem ${item} hebst du deinen Alltag rund um ${club} auf das nächste Level – professionellere Abläufe, die auch in der Kabine schnell auffallen.`,
    });
    const huddle = (cid === 'personal_chef' || cid === 'personal_physio') ? trScene(l, {
      fr: `Alors comme ça on prend un ${item} ? Faudra nous filer quelques recettes / astuces à la cantine 😄💪`,
      en: `Hear you've got a ${item} now — share some tips with the rest of us at the training ground! 😄💪`,
      pt: `Fiquei sabendo que fechou com ${item}! Vai ter que passar os segredos pra galera no CT 😄💪`,
      es: `¿Así que ahora con ${item}? ¡Tendrás que pasarnos algún truco en el vestuario! 😄💪`,
      it: `Abbiamo saputo del ${item} — passa qualche segreto anche a noi al centro sportivo! 😄💪`,
      de: `Hab gehört, du hast jetzt einen ${item} – rück beim Essen mal ein paar Tipps raus! 😄💪`,
    }) : null;
    const kop = (cid === 'pr_manager' || cid === 'social_team') ? trScene(l, {
      fr: `Ça se sent que ${handleTag} passe un cap côté image et com' cette saison 📈🔥`,
      en: `You can tell ${handleTag} has serious backing behind the scenes now — everything looks sharper this season 📈`,
      pt: `Dá pra notar que ${handleTag} profissionalizou de vez a imagem fora de campo 📈🔥`,
      es: `Se nota que ${handleTag} ha dado un salto enorme cuidando su imagen esta temporada 📈`,
      it: `Si vede che ${handleTag} ha alzato il livello anche fuori dal campo quest'anno 📈`,
      de: `Man merkt sofort, wie professionell ${handleTag} jetzt auch neben dem Platz aufgestellt ist 📈`,
    }) : null;
    return { headline, narrative, kop, huddle, hudEmoji: [['💪', 4], ['😄', 2]] };
  }

  if (cat === 'investment') {
    const headline = trScene(l, {
      fr: `Nouveau placement : ${item}`,
      en: `Building for tomorrow: ${item}`,
      pt: `Visão de futuro: ${item}`,
      es: `Inversión estratégica: ${item}`,
      it: `Investimento per il futuro: ${item}`,
      de: `Langfristiges Investment: ${item}`,
    });
    const narrative = trScene(l, {
      fr: `${player} diversifie son patrimoine avec « ${item} ». Entre deux séances à ${club}, ton nom commence aussi à circuler dans les pages économiques et sportives.`,
      en: `${player} puts earnings to work with ${item}. Away from matchdays at ${club}, smart long-term moves are quietly building security beyond playing boots.`,
      pt: `${player} diversifica os investimentos com "${item}". Enquanto brilha pelo ${club}, constrói uma base sólida para muito além dos gramados.`,
      es: `${player} apuesta a largo plazo con "${item}". Entre entrenamientos con ${club}, construye un patrimonio sólido más allá del césped.`,
      it: `${player} guarda al futuro con "${item}". Tra una gara e l'altra col ${club}, costruisce solidità ben oltre la carriera da calciatore.`,
      de: `${player} investiert vorausschauend in "${item}". Neben dem Alltag bei ${club} wächst so ein solides Fundament für die Zeit nach der Karriere.`,
    });
    const kop = trScene(l, {
      fr: `Pas mal l'initiative de ${handleTag} dans « ${item} » 👀 Un footballeur qui prépare déjà l'avenir, c'est fort.`,
      en: `Smart move by ${handleTag} backing the ${item} 👀 Love seeing players invest smartly for the future.`,
      pt: `Boa jogada do ${handleTag} investindo em "${item}" 👀 Inteligência dentro e fora das quatro linhas.`,
      es: `Muy inteligente ${handleTag} apostando por "${item}" 👀 Pensando en el futuro desde ya.`,
      it: `Ottima mossa di ${handleTag} con "${item}" 👀 Testa sulle spalle dentro e fuori dal campo.`,
      de: `Cleverer Schritt von ${handleTag} mit "${item}" 👀 Stark, wenn Spieler langfristig denken.`,
    });
    return { headline, narrative, kop, huddle: null, hudEmoji: [['👍', 3]] };
  }

  // Generic / custom asset
  const headline = trScene(l, {
    fr: `Nouvelle acquisition : ${item}`,
    en: `New milestone: ${item}`,
    pt: `Nova conquista: ${item}`,
    es: `Nueva adquisición: ${item}`,
    it: `Nuovo acquisto: ${item}`,
    de: `Neuerwerbung: ${item}`,
  });
  const narrative = trScene(l, {
    fr: `${player} marque un nouveau repère personnel avec « ${item} ». Une touche personnelle de plus qui raconte qui tu es en dehors de ${club}.`,
    en: `${player} adds ${item} to life off the pitch — another personal marker shaping your story outside ${club}.`,
    pt: `${player} adiciona "${item}" ao seu patrimônio fora das quatro linhas — mais um capítulo pessoal longe da rotina do ${club}.`,
    es: `${player} suma "${item}" a su historia personal fuera de ${club}.`,
    it: `${player} aggiunge "${item}" alla sua vita fuori dal ${club}.`,
    de: `${player} holt sich "${item}" – ein weiteres persönliches Kapitel abseits von ${club}.`,
  });
  const kop = price >= 25000 ? trScene(l, {
    fr: `${handleTag} s'offre « ${item} » 👀 Toujours stylé même hors des stades !`,
    en: `${handleTag} just picked up ${item} 👀 Moving different off the pitch too!`,
    pt: `${handleTag} garantiu "${item}" 👀 Mandando bem até fora de campo!`,
    es: `${handleTag} estrena "${item}" 👀 Con clase también fuera del césped.`,
    it: `${handleTag} si concede "${item}" 👀 Stile anche fuori dal campo!`,
    de: `${handleTag} gönnt sich "${item}" 👀 Läuft auch neben dem Platz!`,
  }) : null;
  const huddle = price >= 25000 ? trScene(l, {
    fr: `Pas mal « ${item} » ! Tu nous montres ça demain au centre 😉`,
    en: `Nice pick-up with the ${item}! Show us tomorrow at training 😉`,
    pt: `Da hora esse "${item}"! Mostra pra galera amanhã no treino 😉`,
    es: `¡Qué bueno lo de "${item}"! Ya lo enseñarás mañana en el entreno 😉`,
    it: `Bello "${item}"! Ce lo fai vedere domani al campo 😉`,
    de: `Stark mit "${item}"! Zeigst du uns morgen beim Training 😉`,
  }) : null;
  return { headline, narrative, kop, huddle, hudEmoji: [['🔥', 2], ['👍', 2]] };
}

function renderActionScene(ctx, actId, customTitle, focus, handleTag) {
  const base = renderActionSceneBase(ctx, actId, customTitle, focus, handleTag);
  if (actId === 'sponsor_shoot') return base; // déjà varié (scènes de partenaires)
  const key = ACTION_VARIANTS[actId] ? actId : 'custom';
  const { l, player, club, teammate, inner } = ctx;
  const vars = {
    P: player, C: club, H: handleTag,
    M: teammate || (l === 'fr' ? 'le groupe' : 'the squad'),
    F: inner ? inner.name : (l === 'fr' ? 'tes proches' : 'family and close friends'),
    W: ctx.innerTown || '',
    T: customTitle || base.headline || '',
  };
  const fill = (table) => trScene(l, table, vars).replace(/\{([A-Z])\}/g, (_, k) => vars[k] ?? '');
  const options = [base, ...ACTION_VARIANTS[key].map((v) => ({
    ...base,
    headline: v.h ? fill(v.h) : base.headline,
    narrative: v.n ? fill(v.n) : base.narrative,
    kop: base.kop && v.k ? fill(v.k) : base.kop,
    huddle: base.huddle && v.u ? fill(v.u) : base.huddle,
  }))];
  return pickFresh(ctx.state, `act:${key}`, options, `${ctx.seed}|${actId}`);
}

function renderActionSceneBase(ctx, actId, customTitle, focus, handleTag) {
  const { l, player, club, teammate, inner, hometown, topSponsor, hasChef, hasPhysio } = ctx;
  const mate = teammate || (l === 'fr' ? 'le groupe' : 'the squad');
  const sponsorTxt = topSponsor || (l === 'fr' ? 'ton partenaire' : 'your partner');
  const personTxt = inner ? `${inner.name}` : (l === 'fr' ? 'tes proches' : 'family and close friends');
  const townTxt = ctx.innerTown || '';

  if (actId === 'recovery') {
    const headline = trScene(l, { fr: 'Journée récupération & soins', en: 'Recovery & cryo reset', pt: 'Recuperação & crioterapia', es: 'Recuperación y crioterapia', it: 'Recupero e crioterapia', de: 'Regeneration & Kältekammer' });
    const narrative = trScene(l, {
      fr: `Bain glacé, mobilité et silence total pour recharger les jambes avant les prochaines échéances avec ${club}.${hasPhysio ? ' Ton kiné privé ajuste chaque étirement.' : ''}${hasChef ? ' Le chef prépare ensuite un dîner calibré.' : ''}`,
      en: `Ice bath, mobility work, and total quiet to flush the legs before ${club}'s next test.${hasPhysio ? ' Your private physio dials in every recovery block.' : ''}${hasChef ? ' A tailored recovery meal closes the evening.' : ''}`,
      pt: `Banho de gelo, mobilidade e descanso total para deixar as pernas voando para o próximo desafio do ${club}.${hasPhysio ? ' Teu fisioterapeuta particular ajusta cada detalhe.' : ''}${hasChef ? ' O chef fecha o dia com um jantar sob medida.' : ''}`,
      es: `Baño de hielo, movilidad y calma absoluta para recargar las piernas antes del próximo reto con ${club}.${hasPhysio ? ' Tu fisioterapeuta privado cuida cada detalle.' : ''}${hasChef ? ' Una cena medida cierra el día.' : ''}`,
      it: `Ghiaccio, mobilità e riposo per ricaricare le gambe in vista del prossimo impegno col ${club}.${hasPhysio ? ' Il tuo fisioterapista privato calibra ogni seduta.' : ''}${hasChef ? ' Poi cena su misura preparata dallo chef.' : ''}`,
      de: `Eisbad, Mobility und volle Ruhe vor der nächsten Aufgabe mit ${club}.${hasPhysio ? ' Dein privater Physio stimmt jede Einheit exakt ab.' : ''}${hasChef ? ' Danach wartet ein maßgeschneidertes Menü.' : ''}`,
    });
    const huddle = (hasPhysio || hasChef) ? trScene(l, {
      fr: `Séance récup validée aujourd'hui — on va avoir besoin de tes jambes ce week-end 💪`,
      en: `Smart recovery session today — going to need those fresh legs this weekend 💪`,
      pt: `Trabalho sério de recuperação hoje — vamos precisar desse gás no fim de semana 💪`,
      es: `Buena sesión de recuperación hoy — vamos a necesitar esas piernas el fin de semana 💪`,
      it: `Ottimo lavoro di recupero oggi — ci serviranno gambe fresche nel weekend 💪`,
      de: `Starke Regeneration heute – am Wochenende brauchen wir deine frischen Beine 💪`,
    }) : null;
    return { headline, narrative, kop: null, huddle, huddleRole: hasPhysio ? 'physio' : null, hudEmoji: [['💪', 3]] };
  }

  if (actId === 'extra_training') {
    const headline = trScene(l, { fr: `Séance supplémentaire avec ${mate}`, en: `Extra finishing after training`, pt: `Treino extra após o expediente`, es: `Sesión extra tras el entrenamiento`, it: `Allenamento extra dopo la seduta`, de: `Extraschicht auf dem Platz` });
    const narrative = trScene(l, {
      fr: `Une heure après le départ du reste du groupe, ${player} et ${mate} restent seuls face au gardien à enchaîner frappes enroulées et coups francs sous la bruine. Le staff technique prend bonne note de cet engagement.`,
      en: `Long after the rest of the squad heads inside, ${player} stays out with ${mate} hitting free kicks and first-time finishes under fading light. The ${club} coaching staff watches quietly from the touchline.`,
      pt: `Muito depois de o elenco ir para o vestiário, ${player} e ${mate} ficam no gramado batendo faltas e finalizações. A comissão do ${club} acompanha tudo de longe com aprovação.`,
      es: `Cuando todos ya están en la ducha, ${player} se queda con ${mate} ensayando faltas y remates al borde del área. El cuerpo técnico de ${club} toma buena nota desde la banda.`,
      it: `Quando tutti rientrano negli spogliatoi, ${player} resta con ${mate} a provare punizioni e tiri al volo. Lo staff del ${club} osserva e apprezza.`,
      de: `Lange nach Trainingsende bleibt ${player} mit ${mate} draußen und feilt an Freistößen und Abschlüssen. Das Trainerteam von ${club} registriert den Extraeinsatz sehr genau.`,
    });
    const huddle = trScene(l, {
      fr: `Costaud la séance de finition en rab tout à l'heure 🔥 Tu vas en planter une pleine lucarne au prochain match !`,
      en: `Top extra finishing session out there today 🔥 One of those free kicks is flying top bins on matchday!`,
      pt: `Treino absurdo de falta agora há pouco 🔥 No próximo jogo vai cair uma lá na gaveta!`,
      es: `Brutal la sesión extra de faltas de hoy 🔥 ¡En el próximo partido va una a la escuadra!`,
      it: `Grande sessione extra poco fa 🔥 Domenica ne metti una all'incrocio!`,
      de: `Starke Extraschicht eben 🔥 Am Spieltag zirkelst du genau so einen in den Winkel!`,
    });
    return { headline, narrative, kop: null, huddle, hudEmoji: [['🔥', 4], ['💪', 3]] };
  }

  if (actId === 'team_dinner') {
    const headline = trScene(l, { fr: `Dîner soudé avec ${mate} & le vestiaire`, en: `Team dinner with the ${club} lads`, pt: `Jantar de grupo com o elenco do ${club}`, es: `Cena de equipo lejos de las cámaras`, it: `Cena di squadra col gruppo`, de: `Teamdinner abseits der Kameras` });
    const narrative = trScene(l, {
      fr: `Grande table privée en centre-ville, aucun téléphone ni caméra : ${player}, ${mate} et le groupe refont la saison entre éclats de rire et promesses de vestiaire. L'ambiance monte d'un cran avant le week-end.`,
      en: `Private room downtown, phones tucked away: ${player}, ${mate}, and teammates trade stories and laughs over a long dinner. Exactly the kind of chemistry that shows up in tight matches.`,
      pt: `Mesa reservada longe das câmeras: ${player}, ${mate} e vários companheiros dão muita risada e fecham o grupo antes da sequência pesada da temporada.`,
      es: `Mesa privada sin cámaras ni focos: ${player}, ${mate} y los compañeros comparten risas y confidencias. De esas noches que unen al vestuario cuando toca sufrir en el campo.`,
      it: `Tavolata privata lontano dai flash: ${player}, ${mate} e il gruppo tra risate e compattezza prima della prossima battaglia.`,
      de: `Langer Abend ohne Kameras mit ${mate} und den Teamkollegen – genau die Stimmung, die eine Mannschaft in engen Spielen zusammenhält.`,
    });
    const huddle = trScene(l, {
      fr: `Merci pour le dîner chef 🍽️🔥 On a jamais autant rigolé, même ambiance samedi sur le terrain !`,
      en: `Top night out lads 🍽️🔥 Thanks for sorting dinner — let's carry that energy into Saturday!`,
      pt: `Valeu pelo jantar hoje 🍽️🔥 Resenha pesada, agora é levar essa sintonia pra dentro de campo!`,
      es: `¡Gracias por la cena de hoy 🍽️🔥 Ambiente top, el sábado a salir a por todas!`,
      it: `Grazie per la cena ragazzi 🍽️🔥 Gruppo unitissimo, portiamolo in campo sabato!`,
      de: `Danke für das starke Essen heute 🍽️🔥 Top Stimmung – genau so am Wochenende auf den Platz!`,
    });
    return { headline, narrative, kop: null, huddle, hudEmoji: [['🔥', 5], ['❤️', 3]] };
  }

  if (actId === 'inner_circle') {
    const headline = trScene(l, { fr: `Parenthèse avec ${personTxt}`, en: `Quiet time with ${personTxt}`, pt: `Momento em família com ${personTxt}`, es: `Tiempo en familia con ${personTxt}`, it: `Pausa privata con ${personTxt}`, de: `Auszeit mit ${personTxt}` });
    const narrative = trScene(l, {
      fr: `Loin des stades et des notifications, ${player} passe l'après-midi avec ${personTxt}${townTxt}. Une soirée simple, les pieds sur terre, pour souffler entre deux matchs intenses.`,
      en: `Phones on silent, zero cameras: ${player} spends the day catching up with ${personTxt}${townTxt}. Grounded energy that resets everything away from the ${club} pressure cooker.`,
      pt: `Longe dos holofotes e do celular, ${player} passa o dia com ${personTxt}${townTxt}. Energia simples e verdadeira para recarregar a mente.`,
      es: `Móvil en silencio y lejos del ruido: ${player} disfruta de una tarde tranquila junto a ${personTxt}${townTxt}. Cable a tierra necesario para volver con la mente despejada.`,
      it: `Lontano da notifiche e pressioni, ${player} dedica la giornata a ${personTxt}${townTxt}. Semplicità preziosa tra una gara e l'altra.`,
      de: `Abseits von Medien und Termindruck verbringt ${player} einen ruhigen Tag mit ${personTxt}${townTxt} – genau die Erdung zwischen den englischen Wochen.`,
    });
    return { headline, narrative, kop: null, huddle: null }; // Strict privacy: no Kop post
  }

  if (actId === 'sponsor_shoot') {
    return renderObligationScene(ctx, sponsorTxt, handleTag, {
      obligationKind: 'kit_shoot',
      sponsorCategory: ctx.topSponsorCategory || '',
      refId: `shoot_${ctx.seed}`,
    }, null);
  }

  if (actId === 'charity_visit') {
    const headline = trScene(l, { fr: `Rencontre associative en ville`, en: `Community & youth visit`, pt: `Visita a projeto social local`, es: `Visita solidaria con jóvenes aficionados`, it: `Incontro solidale con i giovani tifosi`, de: `Besuch bei einem Jugendprojekt` });
    const narrative = trScene(l, {
      fr: `Sourires, maillots signés et petit match improvisé sur le bitume avec les jeunes supporters de ${club}. Une après-midi qui rappelle pourquoi ce sport rassemble toute une ville.`,
      en: `Signed shirts, wide smiles, and a kickabout with young ${club} fans in the local neighbourhood. The kind of afternoon that turns a good player into a crowd favourite.`,
      pt: `Camisas autografadas, fotos e um bate-bola improvisado com a garotada apaixonada pelo ${club}. Tarde inesquecível que conquista a cidade inteira.`,
      es: `Camisetas firmadas, sonrisas y un partidillo improvisado con chavales de la ciudad. Tardes así explican por qué la grada quiere tanto a ${player}.`,
      it: `Maglie autografate, sorrisi e qualche palleggio coi ragazzi del quartiere. Un pomeriggio che lega per sempre ${player} alla gente del ${club}.`,
      de: `Signierte Trikots, strahlende Gesichter und ein kurzer Kick mit dem Nachwuchs aus der Stadt – genau solche Nachmittage machen Fans glücklich.`,
    });
    const kop = trScene(l, {
      fr: `Des gestes simples qui veulent tout dire ❤️ Bravo ${handleTag} pour la visite auprès des jeunes de ${club} aujourd'hui !`,
      en: `Class moments off the pitch ❤️ Huge shoutout to ${handleTag} for spending the afternoon with young ${club} supporters!`,
      pt: `Isso é futebol raiz ❤️ Parabéns ${handleTag} pela humildade na visita à garotada do ${club} hoje!`,
      es: `Esto vale más que mil goles ❤️ Grande ${handleTag} pasando la tarde con los chicos de ${club} hoy.`,
      it: `Cose semplici che restano ❤️ Bravo ${handleTag} con i piccoli tifosi del ${club} oggi!`,
      de: `Echte Größe ❤️ Stark von ${handleTag}, den Nachmittag mit den Jugendkids von ${club} zu verbringen!`,
    });
    return { headline, narrative, kop, huddle: null };
  }

  if (actId === 'media_feature') {
    const headline = trScene(l, { fr: `Grand entretien portrait`, en: `Long-form media feature`, pt: `Entrevista especial & ensaio`, es: `Gran reportaje y entrevista`, it: 'Speciale intervista ritratto', de: `Großes Porträt-Interview` });
    const narrative = trScene(l, {
      fr: `${player} se confie longuement sur son parcours, ses ambitions avec ${club} et sa vie hors terrain. Les premiers extraits mettent déjà Kop en ébullition.`,
      en: `${player} sits down for a candid long-form feature covering ambition, ${club}'s dressing room, and life beyond football. Preview clips are already sparking debate on Kop.`,
      pt: `${player} abre o jogo em entrevista longa sobre ambições no ${club}, bastidores e vida pessoal. Os primeiros trechos já estão bombando no Kop.`,
      es: `${player} repasa en profundidad su momento en ${club}, sus metas y su vida lejos del fútbol. Los adelantos ya encienden el debate en Kop.`,
      it: `${player} si racconta tra ambizioni al ${club} e vita privata. Le prime anticipazioni accendono già Kop.`,
      de: `${player} spricht im ausführlichen Porträt über Ziele bei ${club} und das Leben abseits des Rasens. Erste Ausschnitte sorgen auf Kop direkt für Gesprächsstoff.`,
    });
    const kop = trScene(l, {
      fr: `Solide l'entretien de ${handleTag} qui vient de sortir 👀 Beaucoup de personnalité, hâte de voir la suite sur le terrain !`,
      en: `Really enjoyed ${handleTag}'s new feature interview 👀 Hungry mindset and loads of personality!`,
      pt: `Que entrevista forte do ${handleTag} que acabou de sair 👀 Mentalidade gigante!`,
      es: `Muy buena la entrevista que acaba de publicar ${handleTag} 👀 Mentalidad ambiciosa y con carácter.`,
      it: `Bella intervista di ${handleTag} uscita oggi 👀 Idee chiarissime e personalità!`,
      de: `Starkes Porträt-Interview von ${handleTag} heute 👀 Klare Kante und viel Ausstrahlung!`,
    });
    return { headline, narrative, kop, huddle: null };
  }

  if (actId === 'vip_night') {
    const headline = trScene(l, { fr: `Apparition remarquée en soirée VIP`, en: `Flashbulbs at an exclusive gala`, pt: `Noite VIP sob os holofotes`, es: `Noche VIP bajo los flashes`, it: `Serata VIP sotto i flash`, de: `VIP-Gala im Blitzlichtgewitter` });
    const narrative = trScene(l, {
      fr: `Tapis rouge, tenues de soirée et flashs à l'entrée du gala privé. Les photos font grimper ta notoriété instantanément sur Kop, même si le coach espère te voir frais demain matin.`,
      en: `Tailored suit, velvet rope, and camera flashes outside an exclusive city gala. Clips hit Kop within minutes — though the gaffer will be watching how sharp you look tomorrow morning.`,
      pt: `Terno alinhado, tapete vermelho e dezenas de flashes na festa exclusiva da cidade. O hype no Kop dispara na hora — só resta saber o que o técnico vai achar amanhã cedo.`,
      es: `Traje de gala y lluvia de flashes en la fiesta privada de la ciudad. Las fotos corren rápido por Kop, aunque el míster mirará mañana si llegas fresco al entreno.`,
      it: `Abito su misura e flash alla serata di gala esclusiva. Le foto volano su Kop, anche se il mister controllerà la freschezza domani mattina.`,
      de: `Maßanzug und Blitzlicht auf der exklusiven Gala: Auf Kop trenden die Bilder sofort – solange morgen früh im Training nichts durchhängt.`,
    });
    const kop = trScene(l, {
      fr: `${handleTag} de sortie au gala de la ville hier soir ✨📸 Classe mondiale même en costume !`,
      en: `${handleTag} stepping out at last night's gala ✨📸 World class on and off the pitch!`,
      pt: `${handleTag} roubando a cena no evento VIP ontem à noite ✨📸 Estilo puro!`,
      es: `${handleTag} anoche en la gala de la ciudad ✨📸 Elegancia total también de traje.`,
      it: `${handleTag} alla serata di gala ieri sera ✨📸 Classe pura anche in smoking!`,
      de: `${handleTag} gestern Abend auf der Stadt-Gala ✨📸 Auch im Anzug Weltklasse!`,
    });
    const huddle = trScene(l, {
      fr: `Vu les photos en smoking ce matin 😂 Prêt à courir 12 km quand même aujourd'hui ?`,
      en: `Saw the red-carpet pics already 😂 Hope those dancing shoes turn back into boots by 9am!`,
      pt: `Vi as fotos todo elegante ontem 😂 Hoje às 9h quero ver esse pique todo no treino hein!`,
      es: `Ya vimos las fotos de gala de anoche 😂 Hoy toca sudar el doble en el entreno eh!`,
      it: `Viste le foto in smoking 😂 Stamattina però si corre come sempre eh!`,
      de: `Schicke Gala-Fotos gestern 😂 Heute Vormittag wird trotzdem wieder voll marschiert!`,
    });
    return { headline, narrative, kop, huddle, hudEmoji: [['😂', 4], ['✨', 2]] };
  }

  // Custom action
  const title = customTitle || (l === 'fr' ? 'Activité personnelle' : 'Personal activity');
  const headline = title;
  const narrative = trScene(l, {
    fr: `${player} consacre sa journée libre à : « ${title} ». Un choix personnel qui pèse concrètement sur ton équilibre autour de ${club}.`,
    en: `${player} spends a valuable day off on: "${title}" — a personal choice that shapes relationships around ${club}.`,
    pt: `${player} dedica o dia livre a "${title}" — uma escolha pessoal com impacto real no ambiente ao redor do ${club}.`,
    es: `${player} dedica su día libre a "${title}", marcando huella en el entorno de ${club}.`,
    it: `${player} dedica il giorno libero a "${title}", lasciando un segnale concreto attorno al ${club}.`,
    de: `${player} nutzt den freien Tag für "${title}" – eine persönliche Entscheidung rund um ${club}.`,
  });
  const huddle = focus === 'squad' ? trScene(l, {
    fr: `Bien joué pour « ${title} », le groupe apprécie vraiment ce genre de moment 👍`,
    en: `Fair play with "${title}" today — squad really appreciates it 👍`,
    pt: `Massa demais "${title}" hoje, o grupo curtiu muito 👍`,
    es: `Bien ahí con "${title}", el vestuario lo valora mucho 👍`,
    it: `Bella iniziativa "${title}", il gruppo apprezza 👍`,
    de: `Starke Aktion mit "${title}", kommt in der Kabine richtig gut an 👍`,
  }) : null;
  const kop = ['fans', 'media', 'sponsors'].includes(focus) ? trScene(l, {
    fr: `${handleTag} actif aujourd'hui : « ${title} » 👏 Ça bosse sur tous les fronts !`,
    en: `${handleTag} spotted today: "${title}" 👏 Active on every front!`,
    pt: `${handleTag} em atividade hoje: "${title}" 👏 Presente dentro e fora de campo!`,
    es: `${handleTag} muy activo hoy: "${title}" 👏`,
    it: `${handleTag} attivo anche fuori dal campo: "${title}" 👏`,
    de: `${handleTag} heute abseits des Platzes aktiv: "${title}" 👏`,
  }) : null;
  return { headline, narrative, kop, huddle, hudEmoji: [['👍', 3]] };
}

function renderDilemmaSceneBase(ctx, dilemmaId, choiceId, handleTag) {
  const { l, club, teammate } = ctx;
  const key = `${dilemmaId}:${choiceId}`;
  const headline = trScene(l, {
    fr: 'Choix décisif hors terrain',
    en: 'Off-pitch crossroads settled',
    pt: 'Decisão tomada fora de campo',
    es: 'Decisión tomada fuera del campo',
    it: 'Scelta presa fuori dal campo',
    de: 'Entscheidung abseits des Platzes',
  });
  const narrative = trScene(l, {
    fr: `Ta décision dans cette situation fait immédiatement réagir autour de ${club}. Chaque prise de position laisse une trace sur ta réputation et sur les attentes du vestiaire.`,
    en: `Your call spreads fast around ${club}. Off the pitch just as much as on it, every stance shapes how teammates, supporters, and the dressing room read your character.`,
    pt: `Sua escolha corre rápido pelos bastidores do ${club}. Fora das quatro linhas, cada decisão molda sua reputação diante do elenco e da torcida.`,
    es: `Tu decisión no pasa desapercibida en ${club}. Cada postura fuera del campo deja huella en la grada y en el vestuario.`,
    it: `La tua scelta fa subito il giro dell'ambiente ${club}. Ogni presa di posizione conta nello spogliatoio e tra i tifosi.`,
    de: `Deine Entscheidung spricht sich bei ${club} sofort herum – jede Haltung prägt dein Standing in Kabine und Umfeld.`,
  });
  const publicChoices = {
    'tabloid_deal:a': {
      fr: `La nouvelle couverture lifestyle de ${handleTag} enflamme déjà les réseaux 👀📸`,
      en: `${handleTag}'s glossy magazine spread just dropped everywhere 👀📸`,
      pt: `A capa de revista do ${handleTag} já está em todos os feeds 👀📸`,
      es: `La portada de revista de ${handleTag} ya da la vuelta a las redes 👀📸`,
      it: `La copertina patinata di ${handleTag} sta già spopolando ovunque 👀📸`,
      de: `Das neue Hochglanz-Cover mit ${handleTag} sorgt gerade überall für Aufsehen 👀📸`,
    },
    'youth_club_plea:a': {
      fr: `${handleTag} vient de financer un terrain neuf pour son club d'enfance 👏❤️ La classe pure.`,
      en: `${handleTag} just funded a brand-new pitch for his boyhood club 👏❤️ Unbelievable gesture.`,
      pt: `${handleTag} financiou um campo novinho para o clube formador 👏❤️ Respeito eterno.`,
      es: `${handleTag} acaba de pagar un campo nuevo para su primer club 👏❤️ Enorme corazón.`,
      it: `${handleTag} ha finanziato un nuovo campo per il suo club d'infanzia 👏❤️ Gesto meraviglioso.`,
      de: `${handleTag} finanziert seinem Jugendverein einfach einen komplett neuen Platz 👏❤️ Wahnsinns-Geste!`,
    },
    'youth_club_plea:b': {
      fr: `Beau clin d'œil de ${handleTag} avec des maillots dédicacés pour les jeunes de ses débuts 🙌`,
      en: `Nice touch from ${handleTag} sending signed shirts back to his boyhood academy 🙌`,
      pt: `Bela atitude de ${handleTag} mandando camisas autografadas pra base 🙌`,
      es: `Bonito detalle de ${handleTag} enviando camisetas firmadas a su primer club 🙌`,
      it: `Bel gesto di ${handleTag} con le maglie autografate per i ragazzi del suo vecchio club 🙌`,
      de: `Feiner Zug von ${handleTag}: signierte Trikots für seinen Ausbildungsverein 🙌`,
    },
    'training_gate:a': {
      fr: `Sous la pluie battante, ${handleTag} est resté une heure à signer des autographes après l'entraînement à ${club} 🌧️❤️`,
      en: `Pouring rain at ${club} and ${handleTag} still stayed an hour signing every last shirt at the gate 🌧️❤️`,
      pt: `Debaixo de chuva no CT do ${club}, ${handleTag} ficou quase uma hora atendendo a torcida 🌧️❤️`,
      es: `Bajo la lluvia en ${club}, ${handleTag} se quedó una hora firmando a todos los chavales 🌧️❤️`,
      it: `Sotto il diluvio al ${club}, ${handleTag} è rimasto un'ora a firmare autografi ai ragazzi 🌧️❤️`,
      de: `Bei strömendem Regen blieb ${handleTag} noch eine Stunde für alle Kids am Trainingszaun 🌧️❤️`,
    },
    'training_gate:c': {
      fr: `Moment magique : ${handleTag} a ouvert la pelouse aux gamins venus sous la pluie aujourd'hui 🥹⚽`,
      en: `Magical scenes: ${handleTag} invited the kids right onto the pitch today 🥹⚽`,
      pt: `Cena inesquecível: ${handleTag} chamou as crianças para o gramado mesmo na chuva 🥹⚽`,
      es: `Escena preciosa: ${handleTag} invitó hoy a los chavales al césped 🥹⚽`,
      it: `Momento magico: ${handleTag} ha portato i ragazzi sul campo oggi 🥹⚽`,
      de: `Gänsehautmoment: ${handleTag} hat die Kids heute direkt mit auf den Rasen geholt 🥹⚽`,
    },
    'agent_leak:b': {
      fr: `${handleTag} vient de couper court aux rumeurs — engagement total envers ${club} ! 💪🔵`,
      en: `${handleTag} shutting down the transfer noise loud and clear — all in for ${club}! 💪`,
      pt: `${handleTag} colocou ponto final nos boatos de transferência — foco total no ${club}! 💪`,
      es: `${handleTag} zanja los rumores de golpe: compromiso total con ${club} 💪`,
      it: `${handleTag} spegne subito le voci di mercato: testa solo al ${club}! 💪`,
      de: `${handleTag} schiebt den Wechselgerüchten klar den Riegel vor – voller Fokus auf ${club}! 💪`,
    },
    'docu_crew:a': {
      fr: `Des caméras toute la semaine avec ${handleTag} à ${club} 👀🎬 Le documentaire promet !`,
      en: `Full behind-the-scenes docu crew following ${handleTag} this week 👀🎬 Can't wait to watch this!`,
      pt: `Equipe de documentário acompanhando a semana do ${handleTag} 👀🎬 Vai dar o que falar!`,
      es: `Cámaras siguiendo toda la semana a ${handleTag} 👀🎬 ¡Pintaza de documental!`,
      it: `Telecamere dietro le quinte tutta la settimana con ${handleTag} 👀🎬 Non vediamo l'ora!`,
      de: `Doku-Kameras begleiten ${handleTag} diese Woche auf Schritt und Tritt 👀🎬`,
    },
  };
  const huddleChoices = {
    'late_party:b': {
      fr: `Belle soirée d'après-match hier 😂 Juste, mets un gros réveil pour demain !`,
      en: `Top night out with the boys 😂 Just make sure two alarms are set for tomorrow!`,
      pt: `Que resenha ontem depois da vitória 😂 Só bota o despertador bem alto pra amanhã!`,
      es: `Menuda noche ayer con el grupo 😂 ¡Pon doble alarma para mañana!`,
      it: `Gran serata ieri 😂 Metti la doppia sveglia per domani mattina eh!`,
      de: `Starke Siegesfeier gestern 😂 Stell dir für morgen besser zwei Wecker!`,
    },
    'late_party:c': {
      fr: `Top le dîner calme entre nous hier soir 🤝 L'esprit pro ça paie.`,
      en: `Class quiet dinner last night instead of going out late 🤝 Smart head on you.`,
      pt: `Jantar tranquilo bem melhor do que madrugada fora 🤝 Cabeça no lugar.`,
      es: `Qué acierto la cena tranquila de ayer en lugar de salir hasta tarde 🤝`,
      it: `Ottima scelta la cena tranquilla di ieri sera 🤝 Testa giusta.`,
      de: `Richtig guter, ruhiger Abend statt langer Partynacht 🤝 Genau die richtige Einstellung.`,
    },
    'teammate_vent:a': {
      fr: `Merci d'avoir pris le temps de m'écouter tout à l'heure, ça compte vraiment dans ce vestiaire 🙏`,
      en: `Appreciate you backing me up privately earlier — means a lot in this dressing room 🙏`,
      pt: `Valeu por me ouvir e apoiar mais cedo, faz toda diferença no grupo 🙏`,
      es: `Gracias por escucharme antes en privado, dice mucho de ti como compañero 🙏`,
      it: `Grazie per avermi ascoltato prima nello spogliatoio, vuol dire molto 🙏`,
      de: `Danke für dein offenes Ohr vorhin in der Kabine, das bedeutet mir echt viel 🙏`,
    },
    'teammate_vent:c': {
      fr: `Bien joué d'avoir calmé tout le monde avant la séance 👏 C'est comme ça qu'un groupe avance.`,
      en: `Top leadership calming tensions before training 👏 Keeps everyone pulling together.`,
      pt: `Mandou muito bem apaziguando o clima antes do treino 👏 Grupo fechado!`,
      es: `Bien mediado antes del entreno 👏 Así se mantiene unido un vestuario.`,
      it: `Grande equilibrio nel calmare gli animi prima della seduta 👏 Così si vince insieme.`,
      de: `Stark moderiert vor dem Training 👏 So hält man eine Kabine zusammen.`,
    },
    'docu_crew:c': {
      fr: `Bien vu d'avoir dit non aux caméras dans le vestiaire — nos affaires restent entre nous 💪`,
      en: `Respect for keeping the cameras out of our dressing room — our space stays ours 💪`,
      pt: `Acertou em barrar as câmeras no vestiário — nossa intimidade não está à venda 💪`,
      es: `Bien hecho frenando las cámaras en el vestuario — lo nuestro se queda aquí dentro 💪`,
      it: `Ottima scelta tenere le telecamere fuori dallo spogliatoio — le nostre cose restano nostre 💪`,
      de: `Stark, dass du die Kameras aus unserer Kabine gehalten hast – was hier passiert, bleibt unter uns 💪`,
    },
  };
  if (dilemmaId === 'teammate_vent' && teammate) {
    // Keep attribution natural in huddle if teammate spoke
  }
  const kop = publicChoices[key] ? trScene(l, publicChoices[key]) : null;
  const huddle = huddleChoices[key] ? trScene(l, huddleChoices[key]) : null;
  return { headline, narrative, kop, huddle, hudEmoji: [['💪', 3], ['🤝', 2]] };
}

function renderObligationScene(ctx, brand, handleTag, event = {}, state = null) {
  const { l, player, club } = ctx;
  const obKind = String(event?.obligationKind || '').toLowerCase();
  const matchedSp = (state?.lifeHub?.sponsors || []).find((s) => String(s?.brand || '').toLowerCase() === String(brand || '').toLowerCase());
  const spCat = String(event?.sponsorCategory || matchedSp?.categories?.[0] || matchedSp?.category || '').toLowerCase();

  const templates = [
    {
      id: 'boots_colorway',
      match: () => obKind === 'boot_launch' || spCat === 'boots',
      headline: {
        fr: `Nouveau coloris signature dévoilé avec ${brand}`,
        en: `Signature boot reveal with ${brand}`,
        pt: `Chuteira exclusiva lançada com ${brand}`,
        es: `Presentación de botas exclusivas con ${brand}`,
        it: `Nuovi scarpini signature svelati con ${brand}`,
        de: `Signature-Schuh-Release mit ${brand}`,
      },
      narrative: {
        fr: `Projecteurs rasants et caméras haute vitesse sur pelouse humide : ${player} teste et dévoile le dernier modèle ${brand}. Les gros plans sur chaque frappe font déjà le tour des réseaux.`,
        en: `High-speed phantom cameras on a floodlit pitch: ${player} laces up ${brand}'s newest silhouette and pings top-corner strikes for the launch reel.`,
        pt: `Câmeras de alta velocidade no gramado iluminado: ${player} calça o novo modelo da ${brand} e grava finalizações no ângulo para o vídeo de lançamento.`,
        es: `Cámaras de alta velocidad sobre el césped iluminado: ${player} estrena el nuevo modelo de ${brand} clavando disparos a la escuadra para el spot oficial.`,
        it: `Telecamere ad alta velocità sul prato illuminato: ${player} indossa il nuovo modello ${brand} per lo spot di lancio.`,
        de: `Highspeed-Kameras unter Flutlicht: ${player} schnürt das neue ${brand}-Modell und jagt Bälle für den Launch-Clip in den Winkel.`,
      },
      kop: {
        fr: `Le nouveau coloris ${brand} porté par ${handleTag} est incroyable 👟🔥 Hâte de les voir dès le prochain match !`,
        en: `That new ${brand} boot colorway on ${handleTag} is unreal 👟🔥 Need to see those under the stadium lights this weekend!`,
        pt: `Essa nova chuteira da ${brand} nos pés de ${handleTag} ficou absurda 👟🔥 Já quero ver estreando no próximo jogo!`,
        es: `Las nuevas botas ${brand} de ${handleTag} son una locura 👟🔥 ¡Ganas de verlas este fin de semana!`,
        it: `I nuovi scarpini ${brand} di ${handleTag} sono clamorosi 👟🔥 Non vedo l'ora di vederli in campo!`,
        de: `Der neue ${brand}-Colorway an ${handleTag} sieht überragend aus 👟🔥 Am Wochenende direkt damit treffen!`,
      },
      huddle: {
        fr: `Dis-moi que t'as demandé à ${brand} d'envoyer deux ou trois paires en plus au vestiaire 👀👟`,
        en: `Tell me you got ${brand} to send a few extra pairs into the dressing room 👀👟`,
        pt: `Me diz que você pediu pra ${brand} mandar uns pares extras aqui pro vestiário 👀👟`,
        es: `Dime que le has pedido a ${brand} que mande unos pares extra al vestuario 👀👟`,
        it: `Dimmi che hai fatto mandare qualche paio extra da ${brand} nello spogliatoio 👀👟`,
        de: `Sag bitte, dass ${brand} direkt ein paar Extrapaare in die Kabine geschickt hat 👀👟`,
      },
    },
    {
      id: 'aviation_tarmac',
      match: () => obKind === 'first_class_lounge' || spCat === 'airlines' || spCat === 'hospitality',
      headline: {
        fr: `Tournage sur le tarmac pour ${brand}`,
        en: `Runway & first-class shoot with ${brand}`,
        pt: `Campanha de alto voo com ${brand}`,
        es: `Rodaje en pista y cabina VIP con ${brand}`,
        it: `Shooting in pista e lounge VIP con ${brand}`,
        de: `Rollfeld- & First-Class-Dreh mit ${brand}`,
      },
      narrative: {
        fr: `Entre hangar privé et salon première classe, ${player} tourne la nouvelle campagne internationale de ${brand}. Une réalisation cinématographique qui assoit ton statut bien au-delà du championnat.`,
        en: `Filmed between a private hangar and the flagship cabin, ${player} fronts ${brand}'s new international travel campaign with cinema-grade production.`,
        pt: `Entre o hangar privado e a cabine executiva, ${player} estrela a nova campanha internacional da ${brand} em clima de cinema.`,
        es: `Entre el hangar privado y la cabina ejecutiva, ${player} protagoniza la nueva campaña internacional de ${brand} con factura de cine.`,
        it: `Tra hangar privato e cabina first-class, ${player} guida la nuova campagna globale di ${brand}.`,
        de: `Zwischen Privat-Hangar und First-Class-Kabine steht ${player} für die neue internationale ${brand}-Kampagne vor der Kamera.`,
      },
      kop: {
        fr: `Du terrain au tarmac : la nouvelle campagne ${brand} avec ${handleTag} a une allure folle ✈️🔥`,
        en: `From the pitch to the runway — ${handleTag} front and center in the new ${brand} campaign ✈️🔥 Proper global star move!`,
        pt: `Dos gramados para as nuvens — o novo comercial da ${brand} com ${handleTag} ficou nível cinema ✈️🔥`,
        es: `Del césped a la pista de despegue: el nuevo spot de ${brand} con ${handleTag} es puro cine ✈️🔥`,
        it: `Dal prato alla pista di decollo: la nuova campagna ${brand} con ${handleTag} è spettacolare ✈️🔥`,
        de: `Vom Rasen aufs Rollfeld – die neue ${brand}-Kampagne mit ${handleTag} hat absolutes Kino-Niveau ✈️🔥`,
      },
      huddle: {
        fr: `Maintenant que t'es l'image de ${brand}, c'est toi qui réserves le jet pour le prochain déplacement 😂✈️`,
        en: `Now that you're the face of ${brand}, you're upgrading the whole squad's seats on the next away trip right? 😂✈️`,
        pt: `Agora que tá fechado com a ${brand}, já garante a primeira classe pro elenco todo na próxima viagem 😂✈️`,
        es: `Ahora que eres imagen de ${brand}, nos subirás a todos a primera clase en el próximo viaje ¿no? 😂✈️`,
        it: `Ora che sei il volto di ${brand}, ci porti tutti in prima classe alla prossima trasferta vero? 😂✈️`,
        de: `Jetzt wo du das Gesicht von ${brand} bist, fliegen wir zum nächsten Auswärtsspiel aber alle First Class, oder? 😂✈️`,
      },
    },
    {
      id: 'beverage_hydration',
      match: () => obKind === 'nutrition_lab' || spCat === 'beverage' || spCat === 'healthy_beverage' || spCat === 'health',
      headline: {
        fr: `Spot haute intensité avec ${brand}`,
        en: `High-voltage performance shoot with ${brand}`,
        pt: `Comercial de alta energia com ${brand}`,
        es: `Spot de máxima energía con ${brand}`,
        it: `Spot ad alta energia con ${brand}`,
        de: `High-Energy-Kampagne mit ${brand}`,
      },
      narrative: {
        fr: `Capteurs de sprint, éclairages néon et ralentis spectaculaires : ${player} tourne le nouveau spot performance de ${brand}. Une campagne taillée pour tourner en boucle les soirs de match.`,
        en: `Sprint lasers, neon backlighting, and high-tempo cuts: ${player} headlines ${brand}'s new matchday fuel commercial built to air every big game night.`,
        pt: `Luzes neon, tiros de velocidade e câmera lenta: ${player} grava o novo comercial de performance da ${brand} feito para dominar os intervalos dos jogos.`,
        es: `Luces de neón, sprints explosivos y cámara superlenta: ${player} protagoniza el nuevo anuncio de rendimiento de ${brand}.`,
        it: `Luci al neon, scatti esplosivi e slow-motion: ${player} guida il nuovo spot performance di ${brand}.`,
        de: `Neonlicht, Sprint-Sensoren und Slow-Motion: ${player} dreht den neuen Performance-Spot für ${brand}.`,
      },
      kop: {
        fr: ` Grosse énergie dans le nouveau spot ${brand} avec ${handleTag} ⚡🥤 Le montage est ultra nerveux !`,
        en: `High voltage! The new ${brand} spot starring ${handleTag} just dropped and the editing goes crazy ⚡🥤`,
        pt: `Energia lá no teto! Saiu o novo comercial da ${brand} com ${handleTag} e a edição ficou braba demais ⚡🥤`,
        es: `¡Pura energía! Acaba de salir el nuevo anuncio de ${brand} con ${handleTag} y el ritmo es brutal ⚡🥤`,
        it: `Pura energia nel nuovo spot ${brand} con ${handleTag} ⚡🥤 Montaggio pazzesco!`,
        de: `Volle Ladung Energie im neuen ${brand}-Spot mit ${handleTag} ⚡🥤 Richtig stark geschnitten!`,
      },
      huddle: {
        fr: `Dis à ${brand} de remplir le frigo du vestiaire demain matin, on a tous soif après la séance 😂🥤`,
        en: `Tell ${brand} to stock the dressing room fridge tomorrow morning, the lads are thirsty 😂🥤`,
        pt: `Já avisa a ${brand} pra abastecer a geladeira do vestiário amanhã cedo que a rapaziada tá com sede 😂🥤`,
        es: `Dile a ${brand} que llene la nevera del vestuario mañana por la mañana 😂🥤`,
        it: `Dì a ${brand} di riempire il frigo dello spogliatoio domani mattina 😂🥤`,
        de: `Sag ${brand}, sie sollen morgen früh direkt den Kabinen-Kühlschrank vollpacken 😂🥤`,
      },
    },
    {
      id: 'auto_trackday',
      match: () => obKind === 'test_track_day' || spCat === 'automotive',
      headline: {
        fr: `Journée circuit & caméra embarquée pour ${brand}`,
        en: `Closed-circuit track shoot with ${brand}`,
        pt: `Dia de pista e gravação com ${brand}`,
        es: `Jornada de circuito y rodaje con ${brand}`,
        it: `Giornata in pista e riprese con ${brand}`,
        de: `Rennstrecken-Dreh mit ${brand}`,
      },
      narrative: {
        fr: `Casque vissé et micros sur l'échappement : ${player} enchaîne les tours de piste sur circuit fermé avec les pilotes d'essai de ${brand}. Les images embarquées font un carton immédiat.`,
        en: `On-board cameras and exhaust mics rigged up on a closed circuit: ${player} runs hot laps alongside ${brand}'s test drivers for a high-octane feature.`,
        pt: `Câmeras onboard e microfones no escapamento em pista fechada: ${player} acelera ao lado dos pilotos da ${brand} em uma gravação eletrizante.`,
        es: `Cámaras a bordo y circuito cerrado: ${player} rueda a fondo junto a los pilotos de pruebas de ${brand} en un spot espectacular.`,
        it: `Onboard camera e pista chiusa: ${player} gira in circuito coi collaudatori ${brand} per un video ad alta adrenalina.`,
        de: `Onboard-Kameras auf abgesperrter Rennstrecke: ${player} dreht mit den Testfahrern von ${brand} schnelle Runden für den neuen Clip.`,
      },
      kop: {
        fr: `Ce son de moteur dans la vidéo ${brand} avec ${handleTag} sur circuit 🏎️💨 Quel duo !`,
        en: `Hear that engine roar — ${handleTag} taking ${brand} around the test track for their new campaign 🏎️💨`,
        pt: `Ouve o ronco desse motor no vídeo da ${brand} com ${handleTag} na pista 🏎️💨 Pesado demais!`,
        es: `Cómo suena ese motor en el vídeo de circuito de ${brand} con ${handleTag} 🏎️💨`,
        it: `Che rombo nel nuovo video in pista di ${brand} con ${handleTag} 🏎️💨`,
        de: `Dieser Motorsound im neuen Rennstrecken-Clip von ${brand} mit ${handleTag} 🏎️💨`,
      },
      huddle: {
        fr: `On a vu la vidéo sur circuit avec ${brand} 👀 T'as vraiment conduit ou c'était un cascadeur ? 😂🏎️`,
        en: `Saw the ${brand} track-day clip 👀 Be honest, did you drive that fast lap or was it the stunt driver? 😂🏎️`,
        pt: `Vimos o vídeo na pista com a ${brand} 👀 Confessa, foi tu no volante mesmo ou chamaram dublê? 😂🏎️`,
        es: `Vimos el vídeo en circuito con ${brand} 👀 Confiesa, ¿conducías tú o era el piloto especialista? 😂🏎️`,
        it: `Visto il video in pista con ${brand} 👀 Confessa, guidavi tu o lo stuntman? 😂🏎️`,
        de: `Haben den Rennstrecken-Clip mit ${brand} gesehen 👀 Ehrlich: Bist du selbst gefahren oder der Stuntfahrer? 😂🏎️`,
      },
    },
    {
      id: 'watches_atelier',
      match: () => obKind === 'watchmaker_atelier' || spCat === 'watches' || spCat === 'fashion' || spCat === 'eyewear' || spCat === 'grooming',
      headline: {
        fr: `Édition prestige & séance privée avec ${brand}`,
        en: `Private atelier & editorial showcase for ${brand}`,
        pt: `Ensaio editorial e vitrine de luxo com ${brand}`,
        es: `Sesión editorial de alta gama con ${brand}`,
        it: `Shooting d'alta classe e atelier privato con ${brand}`,
        de: `Exklusives Atelier-Shooting für ${brand}`,
      },
      narrative: {
        fr: `Éclairage feutré, pièces d'exception et portrait noir et blanc : ${player} prête son image à la nouvelle collection prestige de ${brand}. Les clichés respirent l'élégance.`,
        en: `Moody lighting, bespoke pieces, and crisp black-and-white portraits: ${player} fronts ${brand}'s new luxury showcase with effortless poise.`,
        pt: `Iluminação dramática, peças exclusivas e retratos em preto e branco: ${player} estrela a nova campanha de prestígio da ${brand}.`,
        es: `Iluminación cuidada, piezas exclusivas y retratos en blanco y negro: ${player} encabeza la nueva colección de prestigio de ${brand}.`,
        it: `Luce soffusa, pezzi esclusivi e ritratti d'autore: ${player} è il volto della nuova collezione prestige di ${brand}.`,
        de: `Gedämpftes Licht, exklusive Stücke und Schwarz-Weiß-Porträts: ${player} präsentiert die neue Prestige-Kollektion von ${brand}.`,
      },
      kop: {
        fr: `Le sens du timing sur le terrain comme en dehors : les clichés de ${handleTag} pour ${brand} sont d'une classe folle ⌚✨`,
        en: `Precision timing on and off the pitch — the new ${brand} portraits with ${handleTag} are pure class ⌚✨`,
        pt: `Precisão dentro e fora de campo — as fotos da nova campanha da ${brand} com ${handleTag} são pura elegância ⌚✨`,
        es: `Elegancia pura dentro y fuera del césped: las nuevas fotos de ${handleTag} para ${brand} son de otro nivel ⌚✨`,
        it: `Stile impeccabile dentro e fuori dal campo: i nuovi scatti di ${handleTag} per ${brand} sono pura classe ⌚✨`,
        de: `Perfektes Timing auf und neben dem Platz – die neuen ${brand}-Porträts mit ${handleTag} haben richtig Stil ⌚✨`,
      },
      huddle: {
        fr: `Ce regard sérieux sur les affiches ${brand} 😂 On va accrocher la photo sur ton casier demain !`,
        en: `That serious model stare in the ${brand} photos 😂 We're taping that poster right onto your locker tomorrow!`,
        pt: `Essa cara de modelo sério nas fotos da ${brand} 😂 Amanhã essa foto vai estar colada no teu armário!`,
        es: `Esa mirada de modelo serio en las fotos de ${brand} 😂 ¡Mañana la pegamos en tu taquilla!`,
        it: `Quello sguardo serissimo negli scatti ${brand} 😂 Domani ti tappezziamo l'armadietto!`,
        de: `Dieser ernste Model-Blick auf den ${brand}-Fotos 😂 Das Poster hängt morgen definitiv an deinem Spind!`,
      },
    },
    {
      id: 'gaming_tech_showmatch',
      match: () => obKind === 'esports_showmatch' || obKind === 'stream_promo' || obKind === 'videogame_cover' || spCat === 'gaming' || spCat === 'phones' || spCat === 'telecom' || spCat === 'appliances' || spCat === 'media',
      headline: {
        fr: `Direct événement & studio high-tech avec ${brand}`,
        en: `Live tech showcase & showmatch with ${brand}`,
        pt: `Live especial e estúdio high-tech com ${brand}`,
        es: `Directo especial y estudio tecnológico con ${brand}`,
        it: `Live show e studio high-tech con ${brand}`,
        de: `Live-Tech-Show & Creator-Event mit ${brand}`,
      },
      narrative: {
        fr: `Plateau connecté, défis en direct et des dizaines de milliers de spectateurs en simultané : ${player} assure le show pour ${brand} avec un naturel qui régale la communauté.`,
        en: `Rigged up in a high-tech studio with tens of thousands watching live, ${player} trades banter and challenges during ${brand}'s flagship digital showcase.`,
        pt: `Estúdio conectado, desafios ao vivo e dezenas de milhares assistindo: ${player} comanda a transmissão especial da ${brand} com carisma de sobra.`,
        es: `Estudio de última generación y decenas de miles de espectadores en directo: ${player} lidera el evento digital de ${brand}.`,
        it: `Studio high-tech e decine di migliaia di spettatori connessi: ${player} è il protagonista dell'evento live di ${brand}.`,
        de: `High-Tech-Studio und Zehntausende live im Stream: ${player} liefert beim digitalen Showcase von ${brand} beste Unterhaltung.`,
      },
      kop: {
        fr: `Les extraits du live ${brand} avec ${handleTag} tournent partout 🎮⚡ Ultra détendu devant les caméras !`,
        en: `Clips from ${handleTag}'s live session with ${brand} are going viral everywhere 🎮⚡ Natural in front of the cameras!`,
        pt: `Os cortes da live da ${brand} com ${handleTag} já estão viralizando geral 🎮⚡ Muito resenha!`,
        es: `Los clips del directo de ${handleTag} con ${brand} ya son virales en todas partes 🎮⚡`,
        it: `Le clip della live di ${handleTag} con ${brand} stanno già facendo il giro del web 🎮⚡`,
        de: `Die Clips aus dem ${brand}-Livestream mit ${handleTag} gehen gerade überall viral 🎮⚡`,
      },
      huddle: null,
    },
    {
      id: 'flagship_crowd',
      match: () => obKind === 'flagship_signing' || obKind === 'store_launch' || spCat === 'local',
      headline: {
        fr: `Foule immense devant l’espace ${brand}`,
        en: `Block-long queues at ${brand}'s flagship event`,
        pt: `Multidão na loja conceito da ${brand}`,
        es: `Locura de aficionados en el espacio de ${brand}`,
        it: `Bagno di folla al flagship store ${brand}`,
        de: `Riesenandrang beim Flagship-Event von ${brand}`,
      },
      narrative: {
        fr: `Des centaines de supporters patientent sur tout le trottoir pour apercevoir ${player} lors de l'événement organisé par ${brand}. Autographes, selfies et chants à la gloire de ${club} font vibrer tout le quartier.`,
        en: `Supporters line the pavement around the block as ${player} arrives at ${brand}'s flagship venue. Shirts signed, selfies snapped, and ${club} chants echoing down the street.`,
        pt: `Centenas de fãs formam fila dobrando o quarteirão para ver ${player} no evento da ${brand}. Autógrafos, selfies e cantos da torcida do ${club} tomam conta da rua.`,
        es: `Cientos de seguidores llenan la calle frente al espacio de ${brand} para ver a ${player}. Firmas, fotos y cánticos de ${club} durante toda la tarde.`,
        it: `Centinaia di tifosi in coda lungo tutto l'isolato per incontrare ${player} all'evento ${brand}, tra autografi, selfie e cori per il ${club}.`,
        de: `Hunderte Fans stehen rund um den Block Schlange, als ${player} beim Flagship-Event von ${brand} Autogramme und Selfies verteilt.`,
      },
      kop: {
        fr: `La file d'attente devant ${brand} pour voir ${handleTag} fait tout le tour du pâté de maisons 🤯👏 Quelle cote d'amour !`,
        en: `The queue outside ${brand} just to catch a glimpse of ${handleTag} goes all the way down the block 🤯👏 Massive pull!`,
        pt: `O tamanho da fila na porta da ${brand} hoje só pra ver ${handleTag} de perto 🤯👏 Moral absurda!`,
        es: `La cola en la calle frente a ${brand} para ver a ${handleTag} da la vuelta a la manzana 🤯👏`,
        it: `La coda fuori da ${brand} per vedere ${handleTag} fa il giro dell'isolato 🤯👏`,
        de: `Die Schlange vor ${brand} für ${handleTag} reicht einfach die ganze Straße runter 🤯👏`,
      },
      huddle: null,
    },
    {
      id: 'youth_masterclass',
      match: () => obKind === 'community_clinic' || obKind === 'charity_match',
      headline: {
        fr: `Masterclass jeunes avec ${brand}`,
        en: `Youth football masterclass with ${brand}`,
        pt: `Clínica de futebol para jovens com ${brand}`,
        es: `Masterclass con jóvenes talentos junto a ${brand}`,
        it: `Masterclass per i giovani talenti con ${brand}`,
        de: `Nachwuchs-Masterclass gemeinsam mit ${brand}`,
      },
      narrative: {
        fr: `Sur un playground urbain privatisé par ${brand}, ${player} anime un atelier technique avec des dizaines de jeunes passionnés. Conseils de placement, petits ponts et sourires du début à la fin.`,
        en: `On a city pitch hosted by ${brand}, ${player} runs finishing drills and 1v1 challenges with local youth players — handing out gear and advice they won't forget.`,
        pt: `Em uma quadra urbana preparada pela ${brand}, ${player} comanda desafios de drible e finalização com dezenas de jovens da cidade.`,
        es: `En una cancha urbana organizada por ${brand}, ${player} comparte trucos de definición y regate con decenas de jóvenes futbolistas.`,
        it: `Su un campetto cittadino allestito da ${brand}, ${player} guida sfide tecniche e consigli con decine di giovani calciatori.`,
        de: `Auf einem von ${brand} gestalteten City-Court zeigt ${player} Jugendlichen Tricks, Abschlüsse und Eins-gegen-Eins-Moves.`,
      },
      kop: {
        fr: `Superbe initiative : ${handleTag} et ${brand} sur le terrain avec les jeunes de la ville aujourd'hui ⚽❤️`,
        en: `Class activation — ${handleTag} and ${brand} out on the pitch coaching local kids today ⚽❤️ Proper role model!`,
        pt: `Ação gigante: ${handleTag} e ${brand} batendo bola e ensinando a garotada hoje ⚽❤️ Exemplo demais!`,
        es: `Qué gran iniciativa de ${handleTag} y ${brand} entrenando hoy con los chavales en la calle ⚽❤️`,
        it: `Bellissima iniziativa: ${handleTag} e ${brand} in campo coi ragazzi della città oggi ⚽❤️`,
        de: `Starke Aktion: ${handleTag} und ${brand} heute beim Training mit den Kids auf dem Bolzplatz ⚽❤️`,
      },
      huddle: null,
    },
    {
      id: 'billboard_downtown',
      match: () => obKind === 'billboard_campaign' || obKind === 'magazine_shoot' || true,
      headline: {
        fr: `Affichage géant en plein cœur de la ville avec ${brand}`,
        en: `Giant downtown billboard reveal for ${brand}`,
        pt: `Outdoor gigante no centro da cidade com ${brand}`,
        es: `Lona gigante en el centro de la ciudad con ${brand}`,
        it: `Maxi affissione in centro città con ${brand}`,
        de: `Riesiges City-Billboard mit ${brand} enthüllt`,
      },
      narrative: {
        fr: `Impossible de traverser le centre-ville sans lever les yeux : la nouvelle affiche monumentale de ${brand} met ${player} à l'honneur sur toute une façade.`,
        en: `Towering over the main square downtown, ${brand}'s new monumental façade billboard puts ${player} front and center across the city skyline.`,
        pt: `Quem passa pelo centro da cidade já dá de cara com a nova empena gigante da ${brand} estampando ${player} em tamanho monumental.`,
        es: `Imposible pasar por el centro sin mirar arriba: la nueva lona gigante de ${brand} con ${player} domina toda la avenida principal.`,
        it: `Impossibile non notarlo in centro: il nuovo maxi cartellone di ${brand} con ${player} domina la piazza principale.`,
        de: `Mitten in der Innenstadt kaum zu übersehen: Das neue Riesenplakat von ${brand} zeigt ${player} über eine komplette Hausfassade.`,
      },
      kop: {
        fr: `Je viens de passer devant l'affiche géante ${brand} de ${handleTag} en centre-ville 🏙️🔥 Impossible de la rater !`,
        en: `Just walked past the massive new ${brand} billboard of ${handleTag} downtown 🏙️🔥 Taking over the whole city!`,
        pt: `Acabei de passar em frente ao outdoor gigante da ${brand} com ${handleTag} no centro 🏙️🔥 Dono da cidade!`,
        es: `Acabo de pasar frente a la lona gigante de ${brand} con ${handleTag} en pleno centro 🏙️🔥 ¡Imponente!`,
        it: `Appena passato davanti al maxi cartellone ${brand} di ${handleTag} in centro 🏙️🔥 Spettacolo!`,
        de: `Gerade am riesigen neuen ${brand}-Plakat von ${handleTag} in der City vorbeigelaufen 🏙️🔥 Nicht zu übersehen!`,
      },
      huddle: null,
    },
    {
      id: 'primetime_commercial',
      match: () => obKind === 'tv_commercial' || obKind === 'tournament_promo' || true,
      headline: {
        fr: `Spot télévisé en prime time pour ${brand}`,
        en: `Primetime TV commercial premiere with ${brand}`,
        pt: `Estreia de comercial em horário nobre com ${brand}`,
        es: `Estreno de spot televisivo en prime time con ${brand}`,
        it: `Debutto dello spot TV in prima serata con ${brand}`,
        de: `Primetime-TV-Spot mit ${brand} feiert Premiere`,
      },
      narrative: {
        fr: `Bande-son percutante et montage nerveux : le nouveau spot télévisé de ${brand} avec ${player} est diffusé en ouverture des grands rendez-vous sportifs de la semaine.`,
        en: `Backed by a thumping soundtrack and razor-sharp cuts, ${brand}'s new broadcast spot starring ${player} airs nationwide during primetime coverage.`,
        pt: `Com trilha sonora marcante e fotografia impecável, o novo comercial de TV da ${brand} estrelado por ${player} estreia em rede nacional.`,
        es: `Con banda sonora potente y montaje cinematográfico, el nuevo anuncio televisivo de ${brand} con ${player} se estrena en horario estelar.`,
        it: `Colonna sonora d'impatto e regia cinematografica: il nuovo spot TV di ${brand} con ${player} debutta in prima serata.`,
        de: `Mit starkem Soundtrack und Kino-Look läuft der neue ${brand}-TV-Spot mit ${player} erstmals zur besten Sendezeit.`,
      },
      kop: {
        fr: `Le nouveau spot TV de ${brand} avec ${handleTag} qui vient de passer à l'écran 🎬🔥 La réalisation est dingue !`,
        en: `That new ${brand} commercial starring ${handleTag} just aired on TV — production value is through the roof 🎬🔥`,
        pt: `O novo comercial da ${brand} com ${handleTag} que acabou de passar na TV 🎬🔥 Arrepiou!`,
        es: `El nuevo anuncio de TV de ${brand} con ${handleTag} que acaba de salir en pantalla 🎬🔥 ¡Qué barbaridad!`,
        it: `Il nuovo spot TV di ${brand} con ${handleTag} appena andato in onda 🎬🔥 Livello altissimo!`,
        de: `Der neue ${brand}-Werbespot mit ${handleTag} lief gerade im TV – richtig stark produziert 🎬🔥`,
      },
      huddle: null,
    },
    {
      id: 'behind_the_scenes_doc',
      match: () => obKind === 'documentary_spot' || obKind === 'podcast_feature' || true,
      headline: {
        fr: `Format court « Coulisses & exigence » avec ${brand}`,
        en: `Inside the grind: mini-doc feature with ${brand}`,
        pt: `Bastidores da rotina: mini-doc com ${brand}`,
        es: `Mini-documental de rutina y élite con ${brand}`,
        it: `Mini-doc dietro le quinte con ${brand}`,
        de: `Behind-the-Scenes-Kurzfilm mit ${brand}`,
      },
      narrative: {
        fr: `Une équipe réduite de ${brand} suit ${player} sur sa préparation invisible, ses rituels d'avant-match et son exigence quotidienne. Un format sobre et authentique salué par les supporters.`,
        en: `A small film unit from ${brand} captures ${player}'s unseen preparation, matchday focus, and daily craft in a raw short-form feature.`,
        pt: `Uma equipe enxuta da ${brand} registra a preparação invisível e os rituais de foco de ${player} em um mini-documentário autêntico.`,
        es: `Un equipo de rodaje de ${brand} retrata la preparación silenciosa y la disciplina diaria de ${player} en un formato breve muy auténtico.`,
        it: `Una troupe di ${brand} racconta il lavoro invisibile e la concentrazione quotidiana di ${player} in un mini-documentario autentico.`,
        de: `Ein kleines Filmteam von ${brand} begleitet ${player} bei der unsichtbaren Vorbereitung und dem täglichen Fokus in einer authentischen Kurzdoku.`,
      },
      kop: {
        fr: `Très propre la vidéo coulisses de ${brand} sur la routine de ${handleTag} 🎥👏 On voit tout le travail invisible.`,
        en: `Loved the new ${brand} mini-doc on ${handleTag}'s matchweek routine 🎥👏 Shows the real work behind the scenes.`,
        pt: `Muito foda o mini-doc da ${brand} mostrando a rotina de preparação de ${handleTag} 🎥👏 Mentalidade de elite!`,
        es: `Muy bueno el mini-documental de ${brand} sobre la rutina de trabajo de ${handleTag} 🎥👏`,
        it: `Bellissimo il mini-doc di ${brand} sulla routine di preparazione di ${handleTag} 🎥👏`,
        de: `Richtig starke Kurzdoku von ${brand} über die Spieltag-Routine von ${handleTag} 🎥👏`,
      },
      huddle: null,
    },
    {
      id: 'gala_red_carpet',
      match: () => obKind === 'brand_gala' || obKind === 'vip_event' || true,
      headline: {
        fr: `Soirée annuelle & tapis rouge pour ${brand}`,
        en: `Annual partner gala & keynote night with ${brand}`,
        pt: `Noite de gala e recepção oficial da ${brand}`,
        es: `Gala anual de embajadores de ${brand}`,
        it: `Serata di gala degli ambasciatori ${brand}`,
        de: `Jährliche Botschafter-Gala von ${brand}`,
      },
      narrative: {
        fr: `Invité d'honneur de la soirée annuelle de ${brand}, ${player} échange avec les dirigeants internationaux et les médias présents avant de regagner le calme de la maison à heure raisonnable.`,
        en: `Guest of honour at ${brand}'s annual ambassadors evening, ${player} shares the stage with global executives and media before heading home early ahead of training.`,
        pt: `Convidado de honra na noite anual da ${brand}, ${player} representa a marca diante da imprensa e executivos antes de voltar cedo para casa.`,
        es: `Invitado de honor en la gala anual de ${brand}, ${player} comparte escenario con invitados internacionales antes de retirarse a buena hora.`,
        it: `Ospite d'onore alla serata annuale di ${brand}, ${player} rappresenta il marchio davanti a media e dirigenti internazionali.`,
        de: `Als Ehrengast beim Jahresabend von ${brand} vertritt ${player} die Marke souverän auf der Bühne, bevor es rechtzeitig nach Hause geht.`,
      },
      kop: {
        fr: `${handleTag} invité d'honneur à la soirée internationale de ${brand} ce soir ✨🤝 Une vraie stature d'ambassadeur.`,
        en: `${handleTag} headlining the ${brand} ambassadors evening tonight ✨🤝 Moving like a true global icon.`,
        pt: `${handleTag} como convidado de honra na noite internacional da ${brand} ✨🤝 Postura de craque!`,
        es: `${handleTag} como invitado de honor en la gala internacional de ${brand} esta noche ✨🤝`,
        it: `${handleTag} ospite d'onore alla serata internazionale di ${brand} ✨🤝 Stile da vendere.`,
        de: `${handleTag} heute als Ehrengast beim internationalen Abend von ${brand} ✨🤝 Starker Auftritt!`,
      },
      huddle: null,
    },
    {
      id: 'capsule_drop_hype',
      match: () => obKind === 'signature_drop' || obKind === 'limited_capsule' || obKind === 'kit_shoot' || true,
      headline: {
        fr: `Édition limitée ${brand} × ${player}`,
        en: `Limited-edition ${brand} × ${player} drop`,
        pt: `Edição limitada ${brand} × ${player}`,
        es: `Edición limitada ${brand} × ${player}`,
        it: `Edizione limitata ${brand} × ${player}`,
        de: `Limitierter ${brand} × ${player} Drop`,
      },
      narrative: {
        fr: `La série spéciale co-signée par ${player} et ${brand} est dévoilée en ligne à midi. En quelques heures, la collaboration génère un engouement massif chez les supporters de ${club}.`,
        en: `The limited-run collaboration between ${player} and ${brand} goes live at noon — sparking instant demand across ${club}'s fanbase and commercial charts.`,
        pt: `A edição especial assinada por ${player} e ${brand} entra no ar ao meio-dia e esgota em poucas horas entre os torcedores do ${club}.`,
        es: `La edición especial firmada por ${player} y ${brand} se lanza al mediodía y desata la fiebre entre los seguidores de ${club}.`,
        it: `L'edizione speciale firmata da ${player} e ${brand} va online a mezzogiorno e scatena subito l'entusiasmo dei tifosi del ${club}.`,
        de: `Die limitierte Sonderedition von ${player} und ${brand} geht mittags online und sorgt sofort für riesige Nachfrage unter den ${club}-Fans.`,
      },
      kop: {
        fr: `La collab limitée ${brand} × ${handleTag} vient de sortir et tout part déjà à une vitesse folle 🔥📦`,
        en: `The limited ${brand} × ${handleTag} drop just went live and items are already selling out in minutes 🔥📦`,
        pt: `O drop limitado ${brand} × ${handleTag} acabou de sair e já tá esgotando tudo em minutos 🔥📦`,
        es: `La edición limitada de ${brand} × ${handleTag} acaba de salir y se está agotando en minutos 🔥📦`,
        it: `Il drop limitato ${brand} × ${handleTag} è appena uscito e sta già andando sold out 🔥📦`,
        de: `Der limitierte ${brand} × ${handleTag} Drop ist online und nach wenigen Minuten fast ausverkauft 🔥📦`,
      },
      huddle: null,
    },
    {
      id: 'deal_signed_announcement',
      match: () => obKind === 'deal_signed' || true,
      headline: {
        fr: `Partenariat officiel scellé avec ${brand}`,
        en: `Official partnership sealed with ${brand}`,
        pt: `Parceria oficial fechada com ${brand}`,
        es: `Acuerdo oficial cerrado con ${brand}`,
        it: `Partnership ufficiale siglata con ${brand}`,
        de: `Offizielle Partnerschaft mit ${brand} besiegelt`,
      },
      narrative: {
        fr: `Poignée de main officielle et communiqué commun : ${player} rejoint le cercle des ambassadeurs de ${brand}, confirmant son attractivité grandissante autour de ${club}.`,
        en: `Contracts signed and press release live: ${player} officially joins ${brand}'s ambassador roster, underlining growing commercial pull at ${club}.`,
        pt: `Contrato assinado e anúncio oficial no ar: ${player} passa a integrar o time de embaixadores da ${brand}.`,
        es: `Contrato firmado y anuncio oficial publicado: ${player} se une al elenco de embajadores de ${brand}.`,
        it: `Contratto firmato e comunicato ufficiale: ${player} entra nella squadra degli ambasciatori ${brand}.`,
        de: `Vertrag unterschrieben und offiziell verkündet: ${player} gehört ab sofort zu den Markenbotschaftern von ${brand}.`,
      },
      kop: {
        fr: `Officiel : ${handleTag} s'associe à ${brand} ✍️💼 Le rayonnement hors terrain continue de grimper !`,
        en: `Official: ${handleTag} signs on as a new ambassador for ${brand} ✍️💼 Off-pitch stock keeps rising!`,
        pt: `Oficial: ${handleTag} é o novo embaixador da ${brand} ✍️💼 O homem tá voando dentro e fora de campo!`,
        es: `Oficial: ${handleTag} firma como nuevo embajador de ${brand} ✍️💼 ¡Sigue creciendo fuera del campo!`,
        it: `Ufficiale: ${handleTag} è il nuovo ambasciatore di ${brand} ✍️💼 Sempre più protagonista!`,
        de: `Offiziell: ${handleTag} wird neuer Markenbotschafter von ${brand} ✍️💼 Auch neben dem Platz auf Kurs!`,
      },
      huddle: null,
    },
    {
      id: 'fan_giveaway_activation',
      match: () => true,
      headline: {
        fr: `Opération spéciale supporters avec ${brand}`,
        en: `Fan Q&A & giveaway activation with ${brand}`,
        pt: `Ação especial com torcedores e ${brand}`,
        es: `Acción especial para aficionados junto a ${brand}`,
        it: `Attivazione speciale per i tifosi con ${brand}`,
        de: `Fan-Q&A & Gewinnspiel-Aktion mit ${brand}`,
      },
      narrative: {
        fr: `En marge de la séance du jour, ${player} participe à une session questions-réponses et fait gagner des lots exclusifs avec ${brand}. Un format direct qui ravit la communauté.`,
        en: `After training wraps, ${player} hosts a quick fan Q&A and signed-prize giveaway alongside ${brand}, boosting goodwill across social feeds.`,
        pt: `Após o treino, ${player} participa de um bate-papo rápido e sorteia prêmios autografados junto com a ${brand}.`,
        es: `Tras el entrenamiento, ${player} participa en un encuentro rápido con preguntas y premios firmados junto a ${brand}.`,
        it: `Dopo l'allenamento, ${player} partecipa a un Q&A con premi autografati in collaborazione con ${brand}.`,
        de: `Nach dem Training nimmt sich ${player} Zeit für ein kurzes Fan-Q&A samt signierten Preisen mit ${brand}.`,
      },
      kop: {
        fr: `Sympa l'opération de ${handleTag} avec ${brand} pour faire gagner des cadeaux aux supporters aujourd'hui 🎁🙌`,
        en: `Class touch from ${handleTag} and ${brand} running a giveaway for the supporters today 🎁🙌`,
        pt: `Mandou bem demais ${handleTag} junto com a ${brand} sorteando presentes pra torcida hoje 🎁🙌`,
        es: `Gran detalle de ${handleTag} y ${brand} organizando hoy un sorteo para la afición 🎁🙌`,
        it: `Bel gesto di ${handleTag} e ${brand} con i regali messi in palio oggi per i tifosi 🎁🙌`,
        de: `Coole Aktion von ${handleTag} und ${brand} heute mit den Preisen für die Fans 🎁🙌`,
      },
      huddle: null,
    },
  ];

  // Prioritize category/obligation-specific matches first, then general templates, and avoid any recently used templateId
  const generalIds = new Set(['billboard_downtown', 'primetime_commercial', 'behind_the_scenes_doc', 'gala_red_carpet', 'capsule_drop_hype', 'deal_signed_announcement', 'fan_giveaway_activation']);
  const specific = templates.filter((t) => !generalIds.has(t.id) && t.match());
  const general = templates.filter((t) => generalIds.has(t.id));

  const recentTplIds = new Set(
    (state?.lifeHub?.scenes || [])
      .slice(0, 8)
      .map((s) => s?.templateId)
      .filter(Boolean)
  );

  const freshSpecific = specific.filter((t) => !recentTplIds.has(t.id));
  const freshGeneral = general.filter((t) => !recentTplIds.has(t.id));

  let activePool;
  if (obKind === 'deal_signed') {
    const dealTpl = templates.find((t) => t.id === 'deal_signed_announcement');
    activePool = (dealTpl && !recentTplIds.has(dealTpl.id))
      ? [dealTpl]
      : (freshSpecific.length ? freshSpecific : (freshGeneral.length ? freshGeneral : general));
  } else if (freshSpecific.length) {
    activePool = freshSpecific;
  } else if (freshGeneral.length) {
    activePool = freshGeneral;
  } else {
    activePool = [...specific, ...general];
  }

  const seedVal = hashStr(`${brand}|${obKind}|${spCat}|${event?.refId || ''}|${(state?.feed || []).length}|${(state?.lifeHub?.scenes || []).length}`);
  const picked = activePool[seedVal % activePool.length] || templates[0];

  const headline = trScene(l, picked.headline);
  const narrative = trScene(l, picked.narrative);
  const kop = trScene(l, picked.kop);
  // Include teammate huddle banter ~50% of the time when the template has one
  const huddle = (picked.huddle && (seedVal % 2 === 0)) ? trScene(l, picked.huddle) : null;
  return { templateId: picked.id, headline, narrative, kop, huddle, hudEmoji: [['😂', 3], ['🔥', 3]] };
}

function joinNames(names, l) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} ${CAL_AND[l] || 'and'} ${list.at(-1)}`;
}

function renderCalendarEventScene(ctx, event, handleTag) {
  const { l, player, club } = ctx;
  const names = (event.people || []).map((p) => p.name).filter(Boolean);
  const vars = { E: event.title || '', W: joinNames(names, l), P: player, C: club, O: event.title || '', H: handleTag, X: event.title || '' };
  const fill = (t) => trScene(l, t, vars);
  let headline = event.title || '';
  let group = names.length ? 'people' : 'solo';
  if (event.decKind === 'media_event') {
    group = 'media';
    headline = `${event.title} · ${trScene(l, CAL_MEDIA_KIND[event.mediaKind] || CAL_MEDIA_KIND.podcast)}`;
  } else if (event.decKind === 'persona_event') {
    group = 'persona';
    headline = CAL_PERSONA_HEAD[event.eventKey] ? fill(CAL_PERSONA_HEAD[event.eventKey]) : headline;
  }
  let narrative = fill(pickFresh(ctx.state, `cal:${group}`, CAL_NARRATIVES[group], `${ctx.seed}|${event.refId}`));
  // ceux qui vivent loin sont venus exprès (2.0)
  const circleAll = Object.values(ctx.state?.persona?.circle || {}).flat().filter((p) => p?.name);
  const farNames = names.filter((n) => isFar(circleAll.find((c) => c.name === n)));
  if (group === 'people' && farNames.length) narrative = `${narrative} ${trScene(l, farNames.length > 1 ? CAL_FAR_MANY : CAL_FAR_ONE, { N: joinNames(farNames, l) })}`;
  const publicKind = ['public', 'generous', 'media_open', 'media_promo', 'media_bold', 'media_give', 'media_team', 'hobby_film', 'hobby_charity', 'home_kids', 'home_press', 'home_kids_remote', 'home_radio', 'idol_photo', 'idol_thanks', 'dream_share', 'turn_post', 'fcr_tribute'].includes(event.choiceKind);
  const kopSet = group === 'media' ? CAL_KOP.media : publicKind ? CAL_KOP.public : null;
  const kop = kopSet ? fill(pickFresh(ctx.state, `calkop:${group}`, kopSet, `${ctx.seed}|${event.refId}|k`)) : null;
  const withTeam = (event.people || []).some((p) => p.role === 'teammates');
  const huddle = withTeam ? fill(pickFresh(ctx.state, 'cal:huddle', CAL_HUDDLE, `${ctx.seed}|${event.refId}|h`)) : null;
  return { headline, narrative, kop, huddle, hudEmoji: [['🙌', 3], ['😂', 2]] };
}

function buildSceneAndReactions(state, snapshot, event = {}, { language = 'en', newId = () => `sc_${Date.now()}` } = {}) {
  const hub = state?.lifeHub;
  if (!hub) return null;
  hub.scenes = hub.scenes || [];
  const gameDate = event.date || snapshot?.gameDate || hub.lastTickDate || '';
  const ctx = resolveContext(state, snapshot, event, language);
  ctx.state = state; // mémoire anti-répétition des phrases (2.0)
  const myHandle = state?.profile?.handle ? `@${state.profile.handle}` : ctx.player;

  let built;
  if (event.kind === 'purchase') built = renderPurchaseScene(ctx, event.asset, myHandle);
  else if (event.kind === 'action') built = renderActionScene(ctx, event.refId, event.customTitle, event.focus, myHandle);
  else if (event.kind === 'dilemma') built = renderDilemmaScene(ctx, event.dilemmaId, event.choiceId, myHandle);
  else if (event.kind === 'obligation') built = renderObligationScene(ctx, event.brand || 'Partner', myHandle, event, state);
  else if (event.kind === 'calendar') built = renderCalendarEventScene(ctx, event, myHandle);
  else return null;

  const reactions = [];
  const kopCirclePerson = pickKopInnerCircle(state, ctx.seed);
  if (event.kind === 'calendar') {
    // les supporters (si c'était public), puis jusqu'à 3 proches présents qui sont sur Kop, chacun avec sa personnalité
    if (built.kop) {
      const k = pushKopReaction(state, { club: ctx.club, gameDate, language: ctx.l, newId }, built.kop);
      if (k) reactions.push(k);
    }
    const circle = Object.values(state.persona?.circle || {}).flat().filter((p) => p?.name);
    const present = (event.people || []).map((p) => circle.find((c) => c.name === p.name)).filter((p) => p?.kopPersonality).slice(0, 3);
    for (const person of present) {
      const text = buildCircleKopReaction(person, myHandle, 'calendar', ctx.l, `${ctx.seed}|${person.name}`, state);
      if (!text) continue;
      const kc = pushKopReaction(state, { club: ctx.club, gameDate, language: ctx.l, newId, customAuthor: ensureCircleKopAccount(state, person) }, text);
      if (kc) reactions.push(kc);
    }
  } else if (event.kind === 'obligation' && event.brand) {
    const spObj = (state?.lifeHub?.sponsors || []).find((s) => String(s?.brand || '').toLowerCase() === String(event.brand).toLowerCase());
    const spCat = String(event?.sponsorCategory || spObj?.categories?.[0] || spObj?.category || '').toLowerCase();
    const brandAuthor = ensureBrandKopAccount(state, event.brand, spCat);
    const brandText = buildBrandProfessionalPost(event.brand, myHandle, event.obligationKind || '', spCat, ctx.l, ctx.seed, state);
    const fanAuthor = built.kop ? findOrCreateFanAuthor(state, ctx.club, ctx.l) : null;
    const kb = pushKopReaction(
      state,
      { club: ctx.club, gameDate, language: ctx.l, newId, customAuthor: brandAuthor, replyAuthor: fanAuthor, replyText: built.kop || '' },
      brandText
    );
    if (kb) reactions.push(kb);
    if (built.kop && fanAuthor) {
      reactions.push({ channel: 'kop', from: `@${fanAuthor.handle}`, authorName: fanAuthor.name, text: built.kop });
    }
  } else if (built.kop) {
    let replyAuthor = null;
    let replyText = '';
    if (kopCirclePerson) {
      replyAuthor = ensureCircleKopAccount(state, kopCirclePerson);
      replyText = buildCircleKopReaction(kopCirclePerson, myHandle, event.kind, ctx.l, ctx.seed, state) || '';
    }
    const k = pushKopReaction(state, { club: ctx.club, gameDate, language: ctx.l, newId, replyAuthor, replyText }, built.kop);
    if (k) reactions.push(k);
    if (replyAuthor && replyText) {
      reactions.push({ channel: 'kop', from: `@${replyAuthor.handle}`, authorName: replyAuthor.name, text: replyText });
    }
  }
  if (event.kind === 'obligation' && kopCirclePerson && (hashStr(ctx.seed) % 2 === 0)) {
    const circleAuthor = ensureCircleKopAccount(state, kopCirclePerson);
    const circleText = buildCircleKopReaction(kopCirclePerson, myHandle, event.kind, ctx.l, ctx.seed, state);
    if (circleText) {
      const kc = pushKopReaction(state, { club: ctx.club, gameDate, language: ctx.l, newId, customAuthor: circleAuthor }, circleText);
      if (kc) reactions.push(kc);
    }
  }
  if (built.huddle) {
    const h = pushHuddleReaction(state, { gameDate, teammate: ctx.teammate, captain: ctx.captain }, built.huddle, built.huddleRole || null, built.hudEmoji);
    if (h) reactions.push(h);
  }

  const scene = {
    id: newId(),
    date: gameDate,
    kind: event.kind || 'life',
    refId: event.refId || '',
    category: event.category || 'life',
    ...(built.templateId ? { templateId: built.templateId } : {}),
    title: event.kind === 'purchase' ? catalogDisplayName(event.asset, ctx.l) : '',
    headline: built.headline,
    narrative: built.narrative,
    companion: ctx.teammate || ctx.inner?.name || '',
    deltas: event.deltas || {},
    reactions,
    image: event.image || null,
  };

  hub.scenes.unshift(scene);
  if (hub.scenes.length > 10) hub.scenes.length = 10;
  return scene;
}

module.exports = {
  CATALOG_NAMES,
  CATALOG_ENGLISH_NAMES,
  catalogDisplayName,
  buildSceneAndReactions,
  pickFresh,
  buildCircleKopReaction,
  buildBrandProfessionalPost,
  renderActionScene,
  renderPurchaseScene,
  renderDilemmaScene,
};
