'use strict';
// Impulsion quotidienne (Tier 1 procédural + Tier 2 IA hybride légère) à chaque journée avancée.
// Strictement sans spoilers : ne lit que les faits déjà atteints jusqu'à simDate.

const { dayRhythm } = require('./calendar');
const { activeHuddle, addMessage: addHuddleMessage } = require('./huddle');
const { parseJson } = require('../ai/providers');
const { notePersonaBeat } = require('./narrativeMemory');
const { personaFacts } = require('./persona');

const MAX_DAILY_BRIEFS = 20;

const LANG_NAMES = {
  fr: 'French',
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
};

function normLang(lang) {
  return LANG_NAMES[lang] ? lang : 'en';
}

function hashStr(str) {
  let h = 2166136261;
  for (const c of String(str || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

const trPick = (l, map) => map[l] || map.en;

function pickKopVoice(state, clubName, kindSeed, preferJournalist = false) {
  const myHandle = String(state?.profile?.handle || '').toLowerCase();
  const accounts = state?.accounts || {};
  const list = Object.entries(accounts)
    .filter(([h, v]) => {
      if (!h || h.toLowerCase() === myHandle || !v) return false;
      if (v.type === 'club' || v.type === 'competition') return false;
      return preferJournalist ? (v.type === 'journalist' || v.type === 'insider' || v.type === 'fan') : v.type === 'fan';
    })
    .map(([handle, v]) => ({ handle, name: v.name || handle, type: v.type || 'fan', verified: Boolean(v.verified) }));

  if (list.length) {
    return list[hashStr(kindSeed) % list.length];
  }
  const slug = String(clubName || 'Matchday').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'Matchday';
  const handle = preferJournalist ? `${slug}Wire` : `${slug}Supporters`;
  state.accounts ||= {};
  if (!state.accounts[handle]) {
    state.accounts[handle] = { name: preferJournalist ? `${clubName || 'Club'} Desk` : `${clubName || 'Club'} Pulse`, type: preferJournalist ? 'journalist' : 'fan', ...(clubName ? { supports: clubName } : {}) };
  }
  return { handle, name: state.accounts[handle].name, type: state.accounts[handle].type, verified: false };
}

function pushDailyKop(state, author, text, gameDate, newId, extra = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!clean) return null;
  state.feed ||= [];
  if (state.feed.some((p) => p.gameDate === gameDate && p.text === clean)) return null;
  const fol = Math.max(400, Number(state?.profile?.followers) || 4200);
  const scale = Math.min(20, Math.max(0.4, Math.sqrt(fol / 4200)));
  const likes = Math.max(8, Math.round((18 + (hashStr(clean) % 85)) * scale));
  const post = {
    id: newId(),
    author,
    text: clean,
    gameDate,
    createdAt: Date.now(),
    aboutPost: null,
    replies: [],
    likes,
    reposts: Math.max(1, Math.round(likes * 0.1)),
    dailyPulse: true,
    ...extra,
  };
  state.feed.push(post);
  if (state.feed.length > 260) state.feed = state.feed.slice(-260);
  return post;
}

function pushDailyBrief(state, brief, newId) {
  if (!brief?.headline || !brief?.date) return null;
  state.dailyBriefs ||= [];
  const cleanHeadline = String(brief.headline).trim().slice(0, 140);
  const cleanBody = String(brief.body || '').trim().slice(0, 360);
  const cleanTag = String(brief.tag || 'daily').trim().slice(0, 32);
  const exists = state.dailyBriefs.findIndex((b) => b.date === brief.date && b.tag === cleanTag && b.source === (brief.source || 'procedural'));
  const entry = {
    id: newId(),
    date: brief.date,
    tag: cleanTag,
    headline: cleanHeadline,
    body: cleanBody,
    source: brief.source || 'procedural',
  };
  if (exists >= 0) state.dailyBriefs[exists] = entry;
  else state.dailyBriefs.unshift(entry);
  if (state.dailyBriefs.length > MAX_DAILY_BRIEFS) state.dailyBriefs.length = MAX_DAILY_BRIEFS;
  return entry;
}

function pickNotableTarget(state, snapshot, date, rhythm, dueBirthdays = [], dueDecisions = [], activeArcs = []) {
  const hub = state?.lifeHub;
  const selfOrCloseBday = dueBirthdays.find((b) => b.closeness === 'self' || b.closeness === 'close');
  if (selfOrCloseBday) {
    return { kind: 'birthday', date, subject: selfOrCloseBday.name, closeness: selfOrCloseBday.closeness, role: selfOrCloseBday.role };
  }
  if (hub?.regulatoryNews?.on === date) {
    return { kind: 'regulatory', date, subject: (hub.regulatoryNews.brands || []).join(', '), country: hub.regulatoryNews.country || '' };
  }
  if (hub?.lastSponsorSwitch?.on === date) {
    return { kind: 'sponsor_war', date, subject: hub.lastSponsorSwitch.to || '', from: hub.lastSponsorSwitch.from || [] };
  }
  if (rhythm === 'match_prep' && snapshot?.next) {
    const opp = snapshot.next.homeRef === snapshot.club?.ref ? snapshot.next.away : snapshot.next.home;
    const comp = snapshot.next.competition || '';
    const bigComp = /champions|europa|libertadores|cup|coupe|pokal|coppa|copa|world cup|euro|friendly/i.test(comp);
    if (bigComp || state.rival?.club === opp || (hashStr(`${date}|meve`) % 2 === 0)) {
      return { kind: 'match_eve', date, opponent: opp || 'opponent', competition: comp };
    }
  }
  const oneTimeOrSched = dueDecisions.find((d) => d.kind === 'onetime' || d.kind === 'scheduled');
  if (oneTimeOrSched) {
    return { kind: 'event', date, subject: oneTimeOrSched.title || oneTimeOrSched.brand || '' };
  }
  const hotDrama = activeArcs.find((a) => (a.heat || 1) >= 2);
  if (hotDrama && (hashStr(`${date}|${hotDrama.id}`) % 4 === 0)) {
    return { kind: 'drama', date, headline: hotDrama.headline, dramaKind: hotDrama.kind };
  }
  return null;
}

function runProceduralDailyPulse(state, snapshot, { step, settings = {}, newId = () => `dp_${Date.now()}`, dueDecisions = [], dueBirthdays = [] } = {}) {
  if ((settings?.eventMode || 'realistic') === 'games_only' || !snapshot || !step?.nextDate) {
    return { skipped: true, posts: 0, brief: null, notablePulse: null };
  }

  const date = step.nextDate;
  const l = normLang(settings.language);
  const player = snapshot.player?.name || state?.profile?.displayName || 'Player';
  const club = snapshot.club?.name || 'Club';
  const handle = state?.profile?.handle ? `@${state.profile.handle}` : player;
  const hub = state?.lifeHub;
  const activeArcs = state?.dramaSnapshot?.activeArcs || [];
  const rhythm = dayRhythm(state, date);
  const h = hashStr(`${state.careerId || ''}|${date}|pulse`);

  const alreadyRanDate = (state.feed || []).some((p) => p.dailyPulse && p.gameDate === date);
  let postsCreated = 0;
  let brief = null;
  let summary = '';

  const selfBday = dueBirthdays.find((b) => b.closeness === 'self');
  const otherBday = dueBirthdays.find((b) => b.closeness !== 'self');

  if (!alreadyRanDate) {
    // Post 1: contextual Kop pulse for today's date
    let postText = '';
    let useJourn = false;

    if (selfBday) {
      postText = trPick(l, {
        fr: `Joyeux anniversaire ${handle} 🎂🔥 Nouvelle année, mêmes ambitions sous le maillot de ${club} !`,
        en: `Happy birthday ${handle} 🎂🔥 Wishing our star another massive year in ${club} colours!`,
        pt: `Feliz aniversário ${handle} 🎂🔥 Mais um ano voando com a camisa do ${club}!`,
        es: `¡Feliz cumpleaños ${handle} 🎂🔥 Otro año más brillando con el ${club}!`,
        it: `Buon compleanno ${handle} 🎂🔥 Un altro anno da protagonista con il ${club}!`,
        de: `Alles Gute zum Geburtstag ${handle} 🎂🔥 Auf ein weiteres starkes Jahr bei ${club}!`,
      });
      summary = trPick(l, { fr: `Anniversaire de ${player}`, en: `${player}'s birthday`, pt: `Aniversário de ${player}`, es: `Cumpleaños de ${player}`, it: `Compleanno di ${player}`, de: `${player}s Geburtstag` });
      brief = pushDailyBrief(state, {
        date,
        tag: 'birthday',
        headline: trPick(l, {
          fr: `Bon anniversaire ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning} ans)` : ''}`,
          en: `Happy Birthday ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning})` : ''}`,
          pt: `Feliz aniversário, ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning} anos)` : ''}`,
          es: `Feliz cumpleaños, ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning} años)` : ''}`,
          it: `Buon compleanno, ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning} anni)` : ''}`,
          de: `Alles Gute, ${player}${selfBday.ageTurning ? ` (${selfBday.ageTurning})` : ''}`,
        }),
        body: trPick(l, {
          fr: `Les supporters de ${club} et le vestiaire fêtent aujourd’hui l’anniversaire de ${player}.`,
          en: `${club} supporters and teammates celebrate ${player}'s birthday across Kop today.`,
          pt: `A torcida do ${club} e o elenco comemoram o aniversário de ${player} hoje.`,
          es: `La afición del ${club} y el vestuario celebran hoy el cumpleaños de ${player}.`,
          it: `I tifosi del ${club} e lo spogliatoio festeggiano oggi il compleanno di ${player}.`,
          de: `${club}-Fans und Teamkollegen feiern heute ${player}s Geburtstag.`,
        }),
      }, newId);
    } else if (otherBday) {
      postText = trPick(l, {
        fr: `Ambiance au centre d’entraînement de ${club} aujourd’hui pour l’anniversaire de ${otherBday.name} 🎂`,
        en: `Good vibes around ${club} training ground today celebrating ${otherBday.name}'s birthday 🎂`,
        pt: `Clima leve no CT do ${club} hoje no aniversário de ${otherBday.name} 🎂`,
        es: `Buen ambiente en el entrenamiento del ${club} celebrando el cumpleaños de ${otherBday.name} 🎂`,
        it: `Bel clima al centro sportivo del ${club} per il compleanno di ${otherBday.name} 🎂`,
        de: `Gute Stimmung beim Training von ${club} zu ${otherBday.name}s Geburtstag 🎂`,
      });
      summary = `${otherBday.name} (🎂)`;
    } else if (rhythm === 'match_prep' && snapshot.next) {
      const opp = snapshot.next.homeRef === snapshot.club?.ref ? snapshot.next.away : snapshot.next.home;
      useJourn = true;
      postText = trPick(l, {
        fr: `J-1 avant ${club} – ${opp} : tous les regards sont tournés vers ${handle} à la veille du coup d’envoi.`,
        en: `Match eve ahead of ${club} vs ${opp}: big build-up around ${handle} with kick-off 24 hours away.`,
        pt: `Véspera de ${club} x ${opp}: expectativa alta em torno de ${handle} antes da bola rolar.`,
        es: `Previa de ${club} contra ${opp}: máxima expectación alrededor de ${handle} a 24 horas del partido.`,
        it: `Vigilia di ${club} - ${opp}: grande attesa intorno a ${handle} a 24 ore dal fischio d’inizio.`,
        de: `Am Vorabend von ${club} gegen ${opp}: Alle Augen richten sich auf ${handle}.`,
      });
      summary = `${club} – ${opp}`;
      brief = pushDailyBrief(state, {
        date,
        tag: 'match_eve',
        headline: trPick(l, {
          fr: `Veille de match : ${club} – ${opp}`,
          en: `Matchday Eve: ${club} vs ${opp}`,
          pt: `Véspera de jogo: ${club} x ${opp}`,
          es: `Previa del partido: ${club} vs ${opp}`,
          it: `Vigilia del match: ${club} - ${opp}`,
          de: `Vorbericht: ${club} gegen ${opp}`,
        }),
        body: trPick(l, {
          fr: `Derniers réglages à l’entraînement avant d’affronter ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''}.`,
          en: `Final training session completed ahead of ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''}.`,
          pt: `Últimos ajustes no treino antes de enfrentar o ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''}.`,
          es: `Última sesión táctica antes de medirse al ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''}.`,
          it: `Rifinitura completata prima della sfida contro ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''}.`,
          de: `Abschlusstraining vor dem Duell mit ${opp}${snapshot.next.competition ? ` (${snapshot.next.competition})` : ''} beendet.`,
        }),
      }, newId);
    } else if (hub?.biddingWars?.length && h % 2 === 0) {
      const war = hub.biddingWars[0];
      const names = war.bids.filter((b) => !b.walkedAway).slice(0, 2).map((b) => b.brand).join(' & ');
      useJourn = true;
      postText = trPick(l, {
        fr: `En coulisses : ${names} se disputent l’image de ${player} sur le créneau ${war.category}. L’agent fait monter la mise 👀`,
        en: `Commercial watch: ${names} locked in a bidding tussle over ${player} (${war.category}). Off-pitch value soaring 👀`,
        pt: `Bastidores comerciais: ${names} disputam forte o espaço de ${player} na categoria ${war.category} 👀`,
        es: `Guerra comercial: ${names} pujan fuerte por la imagen de ${player} en la categoría ${war.category} 👀`,
        it: `Sfida commerciale: ${names} si contendono ${player} nel settore ${war.category} 👀`,
        de: `Marken-Duell: ${names} bieten um ${player} in der Kategorie ${war.category} 👀`,
      });
      summary = names;
    } else if (activeArcs.length && h % 2 === 0) {
      const arc = activeArcs[0];
      useJourn = true;
      postText = trPick(l, {
        fr: `Le débat du jour sur Kop autour de ${handle} : ${arc.headline}. Les avis divergent déjà entre supporters.`,
        en: `Today's talking point around ${handle}: ${arc.headline} — fans split in the replies.`,
        pt: `O debate do dia sobre ${handle}: ${arc.headline} — torcida dividida nos comentários.`,
        es: `El debate del día sobre ${handle}: ${arc.headline} — división total entre aficionados.`,
        it: `Il tema del giorno attorno a ${handle}: ${arc.headline} — tifosi divisi.`,
        de: `Das Thema des Tages um ${handle}: ${arc.headline} — Fans sind gespalten.`,
      });
      summary = arc.headline;
    } else if (rhythm === 'recovery') {
      postText = trPick(l, {
        fr: `Séance de récup’ aujourd’hui à ${club}. ${handle} déjà focus sur la suite de la semaine 💪`,
        en: `Recovery session wrapped up at ${club}. ${handle} already locked in for what's next 💪`,
        pt: `Treino regenerativo hoje no ${club}. ${handle} já focado na sequência 💪`,
        es: `Sesión de recuperación hoy en el ${club}. ${handle} ya pensando en el próximo reto 💪`,
        it: `Seduta di scarico oggi al ${club}. ${handle} già concentrato sul prossimo impegno 💪`,
        de: `Regenerationseinheit heute bei ${club}. ${handle} richtet den Blick schon voraus 💪`,
      });
    } else if (rhythm === 'day_off') {
      const hobby = state?.persona?.flavor?.hobby;
      postText = hobby
        ? trPick(l, {
            fr: `Journée de repos bien méritée pour ${handle} loin des terrains (${hobby}).`,
            en: `Well-earned day off from the training ground for ${handle} (${hobby}).`,
            pt: `Dia de folga merecido para ${handle} longe dos treinos (${hobby}).`,
            es: `Día libre merecido para ${handle} lejos del campo (${hobby}).`,
            it: `Giorno di riposo meritato per ${handle} lontano dal campo (${hobby}).`,
            de: `Verdienter freier Tag für ${handle} abseits des Trainingsplatzes (${hobby}).`,
          })
        : trPick(l, {
            fr: `Journée de repos au programme aujourd’hui pour l’effectif de ${club}.`,
            en: `Quiet off-day around ${club} before training resumes tomorrow.`,
            pt: `Dia de descanso hoje para o elenco do ${club} antes da reapresentação.`,
            es: `Jornada de descanso hoy para la plantilla del ${club}.`,
            it: `Giornata di riposo oggi per la squadra del ${club}.`,
            de: `Freier Tag heute für den Kader von ${club}.`,
          });
    } else {
      postText = trPick(l, {
        fr: `Séance intense au centre d’entraînement de ${club} aujourd’hui — ${handle} affine les derniers détails ⚽`,
        en: `Sharp training session at ${club} today — ${handle} putting in the extra work ⚽`,
        pt: `Treino intenso hoje no CT do ${club} — ${handle} ajustando os últimos detalhes ⚽`,
        es: `Entrenamiento exigente hoy con el ${club} — ${handle} puliendo detalles ⚽`,
        it: `Allenamento intenso oggi al ${club} — ${handle} cura ogni dettaglio ⚽`,
        de: `Intensive Einheit heute bei ${club} — ${handle} arbeitet an den Details ⚽`,
      });
    }

    if (postText) {
      const author = pickKopVoice(state, club, `${date}|post1`, useJourn);
      if (pushDailyKop(state, author, postText, date, newId)) postsCreated++;
    }

    // Optional occasional huddle line on training/recovery/match_prep
    const group = activeHuddle(state);
    if (group && group.players?.length && !group.messages.some((m) => m.dailyPulse && m.gameDate === date)) {
      if (rhythm === 'match_prep' || dueDecisions.length > 0 || (h % 3 === 0)) {
        const sender = group.players[h % group.players.length];
        const hudText = rhythm === 'match_prep'
          ? trPick(l, {
              fr: `Gros match demain les gars, on reste concentrés 💪`,
              en: `Big one tomorrow boys, stay locked in 💪`,
              pt: `Jogão amanhã rapaziada, foco total 💪`,
              es: `Partidazo mañana chavales, máxima concentración 💪`,
              it: `Domani gara tosta ragazzi, massima concentrazione 💪`,
              de: `Wichtiges Spiel morgen Jungs, voller Fokus 💪`,
            })
          : trPick(l, {
              fr: `Bonne séance ce matin, ça bosse dur 🔥`,
              en: `Sharp session this morning lads 🔥`,
              pt: `Treino forte hoje cedo 🔥`,
              es: `Buen entreno esta mañana equipo 🔥`,
              it: `Ottima seduta stamattina ragazzi 🔥`,
              de: `Starke Einheit heute Morgen 🔥`,
            });
        addHuddleMessage(group, { who: 'them', from: sender, role: 'player', gameDate: date, dailyPulse: true, text: hudText });
      }
    }
  }

  if (state.calendar?.history?.[0]?.date === date && summary) {
    state.calendar.history[0].summary = summary;
  }

  const notablePulse = pickNotableTarget(state, snapshot, date, rhythm, dueBirthdays, dueDecisions, activeArcs);
  return { skipped: false, posts: postsCreated, brief, notablePulse, summary };
}

async function runHybridAiDailyPulse({ state, snapshot, settings, apiKey, notable, complete, privacyMap, newId, mem = null }) {
  if (!notable || (settings?.eventMode || 'realistic') === 'games_only' || !snapshot || !state) {
    return { ok: false, skipped: true };
  }
  const l = normLang(settings?.language);
  const langName = LANG_NAMES[l] || 'English';
  const club = snapshot.club?.name || '';
  const nextMatch = snapshot.next ? {
    date: snapshot.next.date,
    home: snapshot.next.home,
    away: snapshot.next.away,
    competition: snapshot.next.competition || '',
  } : null;

  const facts = {
    today: notable.date || snapshot.gameDate,
    player: snapshot.player?.name || state.profile?.displayName || 'Player',
    handle: `@${state.profile?.handle || 'player'}`,
    club,
    league: snapshot.league?.name || '',
    notable_event: notable,
    next_unplayed_match: nextMatch,
    active_sponsors: (state.lifeHub?.sponsors || []).slice(0, 6).map((s) => `${s.brand} (${s.category}${s.isGlobalPartner ? ', Global' : ''})`),
    active_bidding_wars: (state.lifeHub?.biddingWars || []).map((w) => ({ category: w.category, brands: w.bids.filter((b) => !b.walkedAway).map((b) => b.brand) })),
    active_drama: (mem?.dramaArcs || state?.dramaSnapshot?.activeArcs || []).filter((a) => !a.status || a.status === 'active').slice(0, 2).map((a) => ({ kind: a.kind, headline: a.headline, angle: a.angle })),
    persona: state.persona ? personaFacts(state.persona) : undefined,
    huddle_members: (activeHuddle(state)?.players || []).slice(0, 8),
  };

  const system = `You write a crisp daily football world pulse (non-matchday update) for LifeLegend strictly in ${langName}.
RULES:
1. NEVER invent match results, goals, injuries, or scores for any unplayed fixture. Only reference facts in FACTS.
2. Reflect the player's personality traits, off-pitch lifestyle, sponsors, and active drama naturally.
3. Return strict JSON only:
{
  "brief": { "headline": "max 12 words", "body": "1-2 factual lively sentences", "tag": "${notable.kind}" },
  "kop": [ { "name": "Realistic Account Name", "handle": "RealisticHandle", "type": "fan|journalist", "text": "max 220 chars social post" } ],
  "huddle": { "from": "exact name from huddle_members or null", "text": "short casual dressing-room line" } | null
}`;

  const user = `FACTS:\n${JSON.stringify(facts)}`;
  const raw = await complete(settings, apiKey, { light: true, maxTokens: 1000, privacyMap, system, user });
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== 'object') return { ok: false };

  const date = notable.date || snapshot.gameDate;
  if (parsed.brief?.headline) {
    pushDailyBrief(state, {
      date,
      tag: parsed.brief.tag || notable.kind,
      headline: parsed.brief.headline,
      body: parsed.brief.body || '',
      source: 'ai',
    }, newId);
  }

  let kopAdded = 0;
  const myHandle = String(state.profile?.handle || '').toLowerCase();
  for (const rawPost of Array.isArray(parsed.kop) ? parsed.kop.slice(0, 2) : []) {
    if (!rawPost?.text) continue;
    const hClean = String(rawPost.handle || '').replace(/^@/, '').replace(/[^\w]/g, '').slice(0, 24) || `${club.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'Club'}Wire`;
    if (hClean.toLowerCase() === myHandle) continue;
    const type = rawPost.type === 'journalist' ? 'journalist' : 'fan';
    const name = String(rawPost.name || hClean).trim().slice(0, 48);
    state.accounts ||= {};
    if (!state.accounts[hClean]) state.accounts[hClean] = { name, type, ...(type === 'fan' && club ? { supports: club } : {}) };
    if (pushDailyKop(state, { handle: hClean, name, type, verified: type === 'journalist' }, rawPost.text, date, newId, { aiDailyPulse: true })) {
      kopAdded++;
    }
  }

  const group = activeHuddle(state);
  if (group && parsed.huddle?.text && parsed.huddle?.from) {
    const validSender = (group.players || []).find((p) => p.toLowerCase() === String(parsed.huddle.from).trim().toLowerCase());
    if (validSender) {
      addHuddleMessage(group, {
        who: 'them',
        from: validSender,
        role: 'player',
        gameDate: date,
        dailyPulse: true,
        text: String(parsed.huddle.text).trim().slice(0, 260),
      });
    }
  }

  if (mem) {
    notePersonaBeat(mem, `daily:${notable.kind}:${date}`);
    tickDramaArcs({ state, snapshot, mem });
  }

  return { ok: true, kopAdded };
}

module.exports = {
  runProceduralDailyPulse,
  runHybridAiDailyPulse,
  pushDailyBrief,
};
