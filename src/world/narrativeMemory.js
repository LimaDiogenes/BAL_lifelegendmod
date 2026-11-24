'use strict';
// Mémoire narrative locale par carrière (careers/<careerId>/narrative-memory.json) :
// évite la répétition des questions en conférence de presse / interview, conserve les citations
// exactes réutilisables par les médias et pilote les arcs dramatiques actifs.
// Autonome : aucun import de world, prompts ou privacyShield (pas de dépendance circulaire).

const { normalizePersona, TRAIT_AI_LABELS, TRAIT_KEYS, ROOT_KEYS, FLAVOR_KEYS } = require('./persona');

const MAX_PRESS_HISTORY = 40;
const MAX_INTERVIEW_HISTORY = 30;
const MAX_QUOTE_VAULT = 24;
const MAX_DRAMA_ARCS = 16;
const MAX_PERSONA_BEATS = 20;

const cleanStr = (s, max = 300) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());

function addDaysIso(iso, n) {
  const base = isIsoDate(iso) ? iso : '2026-08-01';
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aIso, bIso) {
  if (!isIsoDate(aIso) || !isIsoDate(bIso)) return 0;
  return Math.round((Date.parse(`${bIso}T12:00:00Z`) - Date.parse(`${aIso}T12:00:00Z`)) / 864e5);
}

function hashOf(str) {
  let h = 2166136261;
  for (const c of String(str || '').toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function defaultNarrativeMemory() {
  return {
    v: 1,
    pressHistory: [],
    interviewHistory: [],
    quoteVault: [],
    dramaArcs: [],
    personaBeatsUsed: [],
    pressBehavior: { skips: 0, noComments: 0, totalDone: 0, lastSkipOn: null },
  };
}

function trimMemory(mem) {
  mem.pressHistory = (mem.pressHistory || []).slice(-MAX_PRESS_HISTORY);
  mem.interviewHistory = (mem.interviewHistory || []).slice(-MAX_INTERVIEW_HISTORY);
  mem.quoteVault = (mem.quoteVault || []).slice(-MAX_QUOTE_VAULT);
  mem.dramaArcs = (mem.dramaArcs || []).slice(-MAX_DRAMA_ARCS);
  mem.personaBeatsUsed = (mem.personaBeatsUsed || []).slice(-MAX_PERSONA_BEATS);
  return mem;
}

function cleanDramaAngle(raw) {
  return cleanStr(raw, 320)
    .replace(/details from his backstory in FACTS\.biography\s*\(and real roots\/inner circle in FACTS\.persona(?:,\s*without inventing unlisted names)?\)/gi, 'his humble beginnings, roots and close circle')
    .replace(/\s*\(?(?:from|in)\s+FACTS\.[a-zA-Z0-9_.]+\)?/g, '')
    .replace(/\bFACTS\.[a-zA-Z0-9_.]+/g, 'his background')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeNarrativeMemory(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const pb = src.pressBehavior && typeof src.pressBehavior === 'object' ? src.pressBehavior : {};
  const out = {
    v: 1,
    pressHistory: Array.isArray(src.pressHistory)
      ? src.pressHistory.filter((x) => x && typeof x === 'object' && x.question).map((x) => ({
        date: cleanStr(x.date, 20),
        matchId: x.matchId ? cleanStr(x.matchId, 80) : null,
        journalist: cleanStr(x.journalist, 80),
        outlet: cleanStr(x.outlet, 80),
        beat: x.beat ? cleanStr(x.beat, 60) : null,
        focus: x.focus ? cleanStr(x.focus, 30) : null,
        question: cleanStr(x.question, 400),
        answer: x.answer ? cleanStr(x.answer, 400) : null,
        declined: Boolean(x.declined),
      }))
      : [],
    interviewHistory: Array.isArray(src.interviewHistory)
      ? src.interviewHistory.filter((x) => x && typeof x === 'object' && x.question).map((x) => ({
        date: cleanStr(x.date, 20),
        source: cleanStr(x.source || 'interview', 30),
        journalist: cleanStr(x.journalist, 80),
        question: cleanStr(x.question, 400),
        answer: x.answer ? cleanStr(x.answer, 400) : null,
      }))
      : [],
    quoteVault: Array.isArray(src.quoteVault)
      ? src.quoteVault.filter((x) => x && typeof x === 'object' && x.text).map((x, idx) => ({
        id: cleanStr(x.id || `q_${idx + 1}`, 40),
        date: cleanStr(x.date, 20),
        source: cleanStr(x.source || 'press', 30),
        to: cleanStr(x.to, 80),
        question: x.question ? cleanStr(x.question, 220) : null,
        text: cleanStr(x.text, 280),
        usedCount: Math.max(0, Number(x.usedCount) || 0),
        lastUsedOn: x.lastUsedOn ? cleanStr(x.lastUsedOn, 20) : null,
      }))
      : [],
    dramaArcs: Array.isArray(src.dramaArcs)
      ? src.dramaArcs.filter((x) => x && typeof x === 'object' && x.kind).map((x, idx) => ({
        id: cleanStr(x.id || `arc_${idx + 1}`, 48),
        kind: cleanStr(x.kind, 48),
        status: x.status === 'resolved' ? 'resolved' : 'active',
        heat: Math.max(1, Math.min(3, Math.round(Number(x.heat) || 1))),
        headline: cleanStr(x.headline, 140),
        angle: cleanDramaAngle(x.angle),
        targetFacet: x.targetFacet ? cleanStr(x.targetFacet, 80) : null,
        startedOn: cleanStr(x.startedOn, 20),
        lastSeenOn: cleanStr(x.lastSeenOn, 20),
        editionsActive: Math.max(0, Number(x.editionsActive) || 0),
        cooldownUntil: x.cooldownUntil ? cleanStr(x.cooldownUntil, 20) : null,
      }))
      : [],
    personaBeatsUsed: Array.isArray(src.personaBeatsUsed)
      ? src.personaBeatsUsed.filter((x) => x && typeof x === 'object' && x.key).map((x) => ({
        key: cleanStr(x.key, 80),
        date: cleanStr(x.date, 20),
      }))
      : [],
    pressBehavior: {
      skips: Math.max(0, Number(pb.skips) || 0),
      noComments: Math.max(0, Number(pb.noComments) || 0),
      totalDone: Math.max(0, Number(pb.totalDone) || 0),
      lastSkipOn: pb.lastSkipOn ? cleanStr(pb.lastSkipOn, 20) : null,
    },
  };
  return trimMemory(out);
}

function loadNarrativeMemory(store, careerId) {
  if (!careerId || typeof store?.loadAux !== 'function') return defaultNarrativeMemory();
  const loaded = store.loadAux(careerId, 'narrative-memory');
  return loaded ? normalizeNarrativeMemory(loaded) : defaultNarrativeMemory();
}

function saveNarrativeMemory(store, careerId, mem) {
  const clean = trimMemory(normalizeNarrativeMemory(mem));
  if (careerId && typeof store?.saveAux === 'function') {
    store.saveAux(careerId, 'narrative-memory', clean);
  }
  return clean;
}

const normText = (s) => cleanStr(s, 400).toLowerCase();

function pushQuoteToVault(mem, { date, source = 'press', to = '', question = null, text }) {
  const clean = cleanStr(text, 280);
  if (clean.length < 24) return null;
  mem.quoteVault ||= [];
  const norm = normText(clean);
  if (mem.quoteVault.some((q) => normText(q.text) === norm)) return null;
  const entry = {
    id: `q_${(hashOf(`${date}|${source}|${clean}`) >>> 0).toString(36)}`,
    date: cleanStr(date, 20),
    source: cleanStr(source, 30),
    to: cleanStr(to, 80),
    question: question ? cleanStr(question, 220) : null,
    text: clean,
    usedCount: 0,
    lastUsedOn: null,
  };
  mem.quoteVault.push(entry);
  if (mem.quoteVault.length > MAX_QUOTE_VAULT) mem.quoteVault = mem.quoteVault.slice(-MAX_QUOTE_VAULT);
  return entry;
}

function recordPressQuestions(mem, { gameDate = '', matchId = null, questions = [] } = {}) {
  mem.pressHistory ||= [];
  for (const q of Array.isArray(questions) ? questions : []) {
    const text = cleanStr(q?.question, 400);
    if (!text) continue;
    const norm = normText(text);
    const exists = mem.pressHistory.some((h) => h.matchId === matchId && normText(h.question) === norm);
    if (exists) continue;
    mem.pressHistory.push({
      date: cleanStr(gameDate, 20),
      matchId: matchId ? cleanStr(matchId, 80) : null,
      journalist: cleanStr(q.journalist, 80),
      outlet: cleanStr(q.outlet, 80),
      beat: q.beat ? cleanStr(q.beat, 60) : null,
      focus: q.focus ? cleanStr(q.focus, 30) : null,
      question: text,
      answer: null,
      declined: false,
    });
  }
  if (mem.pressHistory.length > MAX_PRESS_HISTORY) mem.pressHistory = mem.pressHistory.slice(-MAX_PRESS_HISTORY);
  return mem;
}

function recordPressAnswers(mem, { gameDate = '', matchId = null, exchanges = [] } = {}) {
  mem.pressHistory ||= [];
  mem.pressBehavior ||= { skips: 0, noComments: 0, totalDone: 0, lastSkipOn: null };
  let declinedNow = 0;
  for (const ex of Array.isArray(exchanges) ? exchanges : []) {
    const qText = cleanStr(ex?.question, 400);
    const ans = cleanStr(ex?.answer, 400);
    const declined = !ans;
    if (declined) declinedNow++;
    const normQ = normText(qText);
    const target = [...mem.pressHistory].reverse().find((h) => (matchId ? h.matchId === matchId : true) && normText(h.question) === normQ);
    if (target) {
      target.answer = ans || null;
      target.declined = declined;
    } else if (qText) {
      mem.pressHistory.push({
        date: cleanStr(gameDate, 20),
        matchId: matchId ? cleanStr(matchId, 80) : null,
        journalist: cleanStr(ex?.journalist, 80),
        outlet: cleanStr(ex?.outlet, 80),
        beat: ex?.beat ? cleanStr(ex.beat, 60) : null,
        focus: ex?.focus ? cleanStr(ex.focus, 30) : null,
        question: qText,
        answer: ans || null,
        declined,
      });
    }
    if (ans) {
      pushQuoteToVault(mem, { date: gameDate, source: 'press', to: ex?.journalist || '', question: qText, text: ans });
    }
  }
  mem.pressBehavior.skips = 0;
  mem.pressBehavior.totalDone = (mem.pressBehavior.totalDone || 0) + 1;
  mem.pressBehavior.noComments = declinedNow > 0 ? (mem.pressBehavior.noComments || 0) + declinedNow : 0;
  return trimMemory(mem);
}

function recordPressSkip(mem, { gameDate = '' } = {}) {
  mem.pressBehavior ||= { skips: 0, noComments: 0, totalDone: 0, lastSkipOn: null };
  mem.pressBehavior.skips = (mem.pressBehavior.skips || 0) + 1;
  if (gameDate) mem.pressBehavior.lastSkipOn = cleanStr(gameDate, 20);
  return mem;
}

function recordInterviewQuestions(mem, { gameDate = '', journalist = '', questions = [], source = 'interview' } = {}) {
  mem.interviewHistory ||= [];
  for (const raw of Array.isArray(questions) ? questions : []) {
    const text = cleanStr(raw, 400);
    if (!text) continue;
    const norm = normText(text);
    if (mem.interviewHistory.some((h) => h.date === gameDate && normText(h.question) === norm)) continue;
    mem.interviewHistory.push({
      date: cleanStr(gameDate, 20),
      source: cleanStr(source, 30),
      journalist: cleanStr(journalist, 80),
      question: text,
      answer: null,
    });
  }
  if (mem.interviewHistory.length > MAX_INTERVIEW_HISTORY) mem.interviewHistory = mem.interviewHistory.slice(-MAX_INTERVIEW_HISTORY);
  return mem;
}

function recordInterviewAnswer(mem, { gameDate = '', journalist = '', text = '' } = {}) {
  const full = cleanStr(text, 600);
  if (!full) return mem;
  for (const h of mem.interviewHistory || []) {
    if (h.journalist === journalist && !h.answer) h.answer = full.slice(0, 220);
  }
  const sentences = full.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => s.length >= 24);
  const picks = sentences.length ? sentences.slice(0, 2) : [full.slice(0, 240)];
  for (const q of picks) {
    pushQuoteToVault(mem, { date: gameDate, source: 'interview', to: journalist, text: q });
  }
  return trimMemory(mem);
}

function recordKopQuote(mem, { gameDate = '', text = '' } = {}) {
  const clean = cleanStr(text, 280);
  if (clean.length < 28) return null;
  return pushQuoteToVault(mem, { date: gameDate, source: 'kop', to: 'Kop', text: clean });
}

function notePersonaBeat(mem, key, gameDate = '') {
  if (!key) return mem;
  mem.personaBeatsUsed ||= [];
  mem.personaBeatsUsed = [...mem.personaBeatsUsed.filter((x) => x.key !== key), { key: cleanStr(key, 80), date: cleanStr(gameDate, 20) }].slice(-MAX_PERSONA_BEATS);
  return mem;
}

function markQuoteUsed(mem, quoteId, gameDate = '') {
  if (!quoteId) return null;
  const q = (mem.quoteVault || []).find((x) => x.id === quoteId);
  if (!q) return null;
  q.usedCount = (q.usedCount || 0) + 1;
  if (gameDate) q.lastUsedOn = cleanStr(gameDate, 20);
  return q;
}

function dismissDramaArc(mem, arcId, gameDate = '') {
  const arc = (mem.dramaArcs || []).find((a) => a.id === arcId);
  if (!arc) return null;
  arc.status = 'resolved';
  if (gameDate) arc.cooldownUntil = addDaysIso(gameDate, 28);
  return arc;
}

function clearMediaQuestionHistory(mem) {
  mem.pressHistory = [];
  mem.interviewHistory = [];
  return mem;
}

// ---------- Anti-répétition des questions ----------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'this', 'that', 'are', 'how', 'what', 'when', 'where', 'who', 'why',
  'does', 'did', 'has', 'have', 'had', 'now', 'from', 'about', 'after', 'before', 'into', 'they', 'their', 'his',
  'will', 'would', 'could', 'can', 'just', 'team', 'club', 'match', 'game', 'season', 'today', 'next', 'last',
  'les', 'des', 'une', 'est', 'pas', 'avec', 'pour', 'dans', 'sur', 'qui', 'aux', 'vous', 'votre', 'vos', 'cette',
  'comment', 'quelle', 'quel', 'quels', 'elles', 'sont', 'etre', 'avoir', 'apres', 'avant', 'match', 'equipe',
  'que', 'con', 'por', 'para', 'una', 'los', 'las', 'como', 'sobre', 'esta', 'este', 'su', 'sus', 'partido',
  'che', 'per', 'con', 'una', 'dei', 'delle', 'come', 'oggi', 'dopo', 'prima', 'partita', 'squadra', 'tuo', 'suo',
  'como', 'com', 'por', 'para', 'uma', 'seu', 'sua', 'seus', 'suas', 'jogo', 'equipa', 'time', 'hoje', 'apos',
  'der', 'die', 'das', 'und', 'mit', 'fur', 'wie', 'was', 'ein', 'eine', 'sie', 'ihre', 'ihr', 'nach', 'vor', 'spiel',
]);

function tokenizeQuestion(text) {
  const ascii = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = ascii.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP_WORDS.has(w));
  const unique = [...new Set(words)];
  const bigrams = new Set();
  for (let i = 0; i + 1 < words.length; i++) bigrams.add(`${words[i]}_${words[i + 1]}`);
  return { ascii, words: new Set(unique), bigrams };
}

function setJaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function setContainment(a, b) {
  const minSize = Math.min(a.size, b.size);
  if (!minSize) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / minSize;
}

const CLICHE_STEMS = [
  /maintain(?:ing)? this (?:level of )?consistency/i,
  /keep(?:ing)? this (?:level of )?(?:form|consistency|momentum)/i,
  /maintenir ce niveau de r[ée]gularit[ée]/i,
  /manter essa (?:consist[êe]ncia|regularidade)/i,
  /mantener este nivel de (?:regularidad|consistencia)/i,
  /mantenere questa (?:continuit[àa]|regolarit[àa])/i,
  /diese konstanz (?:halten|aufrechterhalten)/i,
  /turn(?:ing)? your attention to/i,
  /how are you feeling after this/i,
  /what are your thoughts on (?:this|today)/i,
];

function questionSimilarity(tokA, tokB) {
  const jac = setJaccard(tokA.words, tokB.words);
  const cont = setContainment(tokA.words, tokB.words) * 0.85;
  const bi = setJaccard(tokA.bigrams, tokB.bigrams);
  let score = Math.max(jac, cont, bi);
  for (const stem of CLICHE_STEMS) {
    if (stem.test(tokA.ascii) && stem.test(tokB.ascii)) {
      score = Math.max(score, 0.72);
      break;
    }
  }
  return score;
}

function findRepeatedQuestions(candidates = [], mem = {}, { threshold = 0.52 } = {}) {
  const list = (Array.isArray(candidates) ? candidates : []).map((c) => cleanStr(typeof c === 'string' ? c : c?.question, 400));
  const pastRaw = [
    ...((mem?.pressHistory || []).slice(-18).map((x) => x.question)),
    ...((mem?.interviewHistory || []).slice(-12).map((x) => x.question)),
  ].filter(Boolean);
  const pastToks = pastRaw.map((q) => ({ question: q, tok: tokenizeQuestion(q) }));
  const candToks = list.map((q) => ({ question: q, tok: tokenizeQuestion(q) }));

  if (!pastToks.length && candToks.length <= 1) return [];

  const flagged = [];
  for (let i = 0; i < candToks.length; i++) {
    const cur = candToks[i];
    if (!cur.question) continue;
    let bestScore = 0;
    let bestMatch = null;
    for (const p of pastToks) {
      const s = questionSimilarity(cur.tok, p.tok);
      if (s > bestScore) { bestScore = s; bestMatch = p.question; }
    }
    if (bestScore >= threshold) {
      flagged.push({ index: i, matchedQuestion: bestMatch, score: Math.round(bestScore * 100) / 100 });
      continue;
    }
    for (let j = 0; j < i; j++) {
      const s = questionSimilarity(cur.tok, candToks[j].tok);
      if (s >= 0.62) {
        flagged.push({ index: i, matchedQuestion: candToks[j].question, score: Math.round(s * 100) / 100 });
        break;
      }
    }
  }
  return flagged;
}

// ---------- Sélection des 5 à 7 angles de conférence de presse ----------

function pickPressBeats({ state = {}, snapshot = {}, mem = {}, activeArcs = [], match = null, count = null } = {}) {
  const gameDate = snapshot?.gameDate || state?.snapshot?.gameDate || '';
  const matchObj = match && typeof match === 'object' ? match : snapshot?.last;
  const matchId = matchObj?.id || state?.press?.matchId || '';
  const seed = hashOf(`${state?.careerId || ''}|${matchId}|${mem?.pressHistory?.length || 0}`);
  const targetCount = Number.isInteger(count) && count >= 3 && count <= 7 ? count : (5 + (seed % 3));
  const recentBeats = new Set((mem?.pressHistory || []).slice(-6).map((x) => x.beat).filter(Boolean));
  const recentPersonaKeys = new Set((mem?.personaBeatsUsed || []).slice(-6).map((x) => x.key).filter(Boolean));

  // Seat 0 : sportif / tactique précis sur CE match
  const mText = state?.press?.match || (matchObj ? `${matchObj.home} ${matchObj.score?.[0] ?? ''}-${matchObj.score?.[1] ?? ''} ${matchObj.away}` : 'the match');
  const opp = matchObj ? (matchObj.venue === 'domicile' ? matchObj.away : matchObj.home) : 'the opponent';
  const goalMin = matchObj?.goalTimeline?.find((g) => g.scorer === snapshot?.player?.name)?.minute;
  const teamScorer = (matchObj?.clubLineup || []).find((p) => p.name && p.name !== snapshot?.player?.name && (p.goals || p.assists));
  const cap = snapshot?.squadIntel?.captain && !snapshot.squadIntel.captain.me ? snapshot.squadIntel.captain.name : null;
  const goalsConceded = matchObj?.score ? (matchObj.venue === 'domicile' ? matchObj.score[1] : matchObj.score[0]) : 0;

  const matchBeatPool = [
    {
      beat: 'tactical_moment',
      focusLabel: 'tactics',
      angle: `Ask about ONE specific tactical shift or decisive moment in ${mText}${goalMin ? ` (his goal at minute ${goalMin})` : ''} — never ask a generic question about maintaining consistency.`,
    },
    {
      beat: 'teammate_chemistry',
      focusLabel: 'match',
      angle: `Ask about his on-pitch link-up with ${teamScorer ? teamScorer.name : cap || 'his teammates'} during ${mText} and how the team shares responsibility in key spells.`,
    },
    {
      beat: 'clinical_critique',
      focusLabel: 'match',
      angle: goalsConceded > 0
        ? `Even with the result in ${mText}, challenge him sharply on the ${goalsConceded} goal(s) conceded or spells where control slipped — zero softball praise.`
        : `Challenge him on his exact role or efficiency in ${mText} (even in a good spell, demand where he or the team can still be more ruthless).`,
    },
    {
      beat: 'opponent_battle',
      focusLabel: 'tactics',
      angle: `Ask how ${opp} tried to shut down his space in ${mText} and what adjustment broke them open.`,
    },
    {
      beat: 'competition_pressure',
      focusLabel: 'match',
      angle: `Ask what the result in ${mText} demands in ${matchObj?.competition || snapshot?.league?.name || 'this competition'} right now (concrete table gap or knockout pressure, never generic consistency).`,
    },
  ];
  const freshMatchBeats = matchBeatPool.filter((b) => !recentBeats.has(b.beat));
  const seat0 = freshMatchBeats.length ? freshMatchBeats[seed % freshMatchBeats.length] : matchBeatPool[seed % matchBeatPool.length];

  // Seat 1 : drame / pression médiatique / rappel d'une ancienne citation
  const lastTwoDramaBeats = new Set((mem?.pressHistory || []).slice(-6).map((x) => x.beat).filter(Boolean));
  const eligibleQuote = [...(mem?.quoteVault || [])]
    .filter((q) => (q.usedCount || 0) < 2 && (daysBetween(q.date, gameDate) >= 7 || q.source !== 'press' || (mem?.pressHistory?.length || 0) >= 3))
    .sort((a, b) => (a.usedCount - b.usedCount) || a.date.localeCompare(b.date))[0] || null;

  let seat1;
  if ((state?.fanMood?.level || 0) >= 2) {
    seat1 = {
      beat: 'fan_anger',
      focusLabel: 'fans',
      angle: `Fans are furious/angry on Kop (level ${state.fanMood.level}, target: ${state.fanMood.target || 'team'}). Confront him directly about fan criticism and pressure.`,
    };
  } else if (activeArcs.length > 0) {
    const pickedArc = [...activeArcs]
      .sort((a, b) => (b.heat - a.heat) || (Number(lastTwoDramaBeats.has(`drama:${a.kind}`)) - Number(lastTwoDramaBeats.has(`drama:${b.kind}`))))
      [0];
    seat1 = {
      beat: `drama:${pickedArc.kind}`,
      focusLabel: 'drama',
      angle: `Spotlight & media drama (${pickedArc.headline}): ${pickedArc.angle}. Ask a sharp, pointed question putting him on the spot without inventing unlisted facts.`,
    };
  } else if (eligibleQuote) {
    seat1 = {
      beat: 'quote_callback',
      focusLabel: 'quote',
      quoteId: eligibleQuote.id,
      angle: `Quote callback from ${eligibleQuote.date}: quote his exact previous words ("${eligibleQuote.text.slice(0, 140)}") and ask if recent events proved him right or forced a rethink.`,
    };
  } else {
    seat1 = {
      beat: 'ambition_pressure',
      focusLabel: 'drama',
      angle: `Ask a pointed question about rising scrutiny, contract expectations (${snapshot?.player?.contractUntil || 'his future'}), or lofty ambitions (${state?.persona?.traits?.ambition || snapshot?.nationalTeam?.name || 'top honours'}).`,
    };
  }

  // Seat 2 : personnalité, histoire perso, entourage, sponsors, lifestyle ou courbe inattendue
  const personaHooks = [];
  const norm = state?.persona ? normalizePersona(state.persona) : null;
  if (norm) {
    for (const k of TRAIT_KEYS) {
      const val = norm.traits[k];
      if (!val) continue;
      const desc = TRAIT_AI_LABELS[k]?.[val] || val;
      personaHooks.push({
        beat: `persona_${k}`,
        focusLabel: 'persona',
        personaKey: `trait:${k}`,
        angle: `Probe his ${k} trait (${desc}) from FACTS.persona: ask a revealing human/mindset question connecting that exact trait to how he handles life at ${snapshot?.club?.name || 'the club'}.`,
      });
    }
    for (const grp of ['family', 'friends', 'business', 'roots']) {
      for (const p of norm.circle[grp] || []) {
        if (!p.name) continue;
        personaHooks.push({
          beat: `circle_${grp}`,
          focusLabel: 'persona',
          personaKey: `circle:${grp}:${p.role || p.name}`,
          angle: `Ask a warm yet probing question mentioning ${p.name}${p.role ? ` (${p.role})` : ''} from FACTS.persona.inner_circle and how their perspective keeps him grounded (never invent unlisted facts).`,
        });
      }
    }
    for (const rk of ROOT_KEYS) {
      const rv = norm.roots[rk];
      if (!rv) continue;
      personaHooks.push({
        beat: `roots_${rk}`,
        focusLabel: 'persona',
        personaKey: `roots:${rk}`,
        angle: `Connect his roots (${rk}: ${rv} from FACTS.persona.roots) to where he stands today on the big stage.`,
      });
    }
    for (const fk of FLAVOR_KEYS) {
      const fv = norm.flavor[fk];
      if (!fv) continue;
      personaHooks.push({
        beat: `flavor_${fk}`,
        focusLabel: 'persona',
        personaKey: `flavor:${fk}`,
        angle: `Bring up a personal touch from FACTS.persona.flavor (${fk}: ${fv}) and ask how it shapes his routine away from cameras.`,
      });
    }
  }
  if (state?.bio?.text) {
    personaHooks.push({
      beat: 'bio_origins',
      focusLabel: 'persona',
      personaKey: 'bio:origins',
      angle: 'Ask a human-interest question connecting a real detail from FACTS.biography (his origins, early setbacks, or values) to the heights he has reached now.',
    });
  }
  const hub = state?.lifeHub;
  if (hub?.calibrated) {
    // Pas de questions sur ses sponsors perso en conférence d'après-match (les sponsors du club sont sur le panneau) :
    // ces sujets vont aux interviews personnelles (2.0).
    for (const as of (hub.assets || []).filter((a) => a.catalogId !== 'rented_studio').slice(0, 5)) {
      const label = as.name || as.catalogId;
      if (!label) continue;
      personaHooks.push({
        beat: 'off_pitch_asset',
        focusLabel: 'off_pitch',
        personaKey: `asset:${label}`,
        angle: `Ask an off-pitch lifestyle question referencing "${label}" from FACTS.off_pitch_hub.notable_lifestyle (tabloid curiosity or grounded perspective).`,
      });
    }
    const recentNonSponsor = (hub.recentEvents || []).find((e) => e?.text && e.kind !== 'sponsor' && e.kind !== 'obligation' && e.kind !== 'onetime' && !/sponsor|partner|brand|commitment|appearance/i.test(e.text));
    if (recentNonSponsor) {
      personaHooks.push({
        beat: 'off_pitch_recent',
        focusLabel: 'off_pitch',
        personaKey: `hub:${recentNonSponsor.text.slice(0, 40)}`,
        angle: `Ask about his recent off-pitch focus ("${recentNonSponsor.text}" from FACTS.off_pitch_hub.recent_off_pitch).`,
      });
    }
  }
  if (state?.rival?.name) {
    personaHooks.push({
      beat: 'rival_duel',
      focusLabel: 'match',
      personaKey: `rival:${state.rival.name}`,
      angle: `Ask directly about the statistical duel with ${state.rival.name} (${state.rival.team}) in FACTS.rival.`,
    });
  }
  if (snapshot?.nationalTeam?.name) {
    personaHooks.push({
      beat: 'national_duty',
      focusLabel: 'persona',
      personaKey: `nt:${snapshot.nationalTeam.name}`,
      angle: `Ask about switching mindset between club duties and international expectations with ${snapshot.nationalTeam.name}.`,
    });
  }
  if (eligibleQuote && seat1.beat !== 'quote_callback') {
    personaHooks.push({
      beat: 'quote_callback',
      focusLabel: 'quote',
      quoteId: eligibleQuote.id,
      personaKey: `quote:${eligibleQuote.id}`,
      angle: `Follow up on his earlier public remark from ${eligibleQuote.date} ("${eligibleQuote.text.slice(0, 140)}"): ask if his outlook has evolved since.`,
    });
  }
  if (!personaHooks.length) {
    personaHooks.push({
      beat: 'dressing_room_voice',
      focusLabel: 'persona',
      personaKey: 'fallback:room',
      angle: `Ask an unexpected off-script question about locker-room leadership or handling growing expectations at ${snapshot?.club?.name || 'the club'}.`,
    });
  }
  const unusedPersonaHooks = personaHooks.filter((h) => !recentPersonaKeys.has(h.personaKey));
  const hookPool = unusedPersonaHooks.length ? unusedPersonaHooks : personaHooks;
  const seat2 = hookPool[(seed + 3) % hookPool.length];

  const chosen = [seat0, seat1, seat2];
  const usedBeats = new Set(chosen.map((b) => b.beat));
  const usedPKeys = new Set(chosen.map((b) => b.personaKey).filter(Boolean));

  const extraCandidates = [
    ...matchBeatPool.filter((b) => !usedBeats.has(b.beat)),
    ...hookPool.filter((h) => !usedPKeys.has(h.personaKey) && !usedBeats.has(h.beat)),
    ...(activeArcs.slice(1).map((arc) => ({
      beat: `drama:${arc.kind}`,
      focusLabel: 'drama',
      angle: `Spotlight & media drama (${arc.headline}): ${arc.angle}. Ask a direct follow-up without inventing unlisted facts.`,
    }))),
    ...(snapshot?.next ? [{
      beat: 'next_fixture_challenge',
      focusLabel: 'tactics',
      angle: `Ask a specific tactical question looking ahead to the upcoming fixture (${snapshot.next.home} vs ${snapshot.next.away} in ${snapshot.next.competition || 'competition'}) and what adjustment it requires.`,
    }] : []),
    {
      beat: 'locker_room_standards',
      focusLabel: 'match',
      angle: `Ask about dressing-room standards under ${snapshot?.club?.coach || 'the coach'} after ${mText} and how senior voices reacted at full-time.`,
    },
    {
      beat: 'media_scrutiny_response',
      focusLabel: 'drama',
      angle: `Ask how he filters outside noise on Kop and in national columns while fighting for ${snapshot?.club?.name || 'the club'}'s targets.`,
    },
  ];

  for (let i = 0; i < extraCandidates.length && chosen.length < targetCount; i++) {
    const cand = extraCandidates[(seed + i) % extraCandidates.length];
    if (!cand) continue;
    if (usedBeats.has(cand.beat) && (!cand.personaKey || usedPKeys.has(cand.personaKey))) continue;
    usedBeats.add(cand.beat);
    if (cand.personaKey) usedPKeys.add(cand.personaKey);
    chosen.push(cand);
  }

  while (chosen.length < targetCount) {
    const idx = chosen.length;
    chosen.push({
      beat: `match_followup_${idx}`,
      focusLabel: 'match',
      angle: `Ask a distinct follow-up question on ${mText} and his personal standards at ${snapshot?.club?.name || 'the club'}.`,
    });
  }

  return chosen.slice(0, targetCount).map((b, i) => ({ seat: i, ...b }));
}

// Projection compacte envoyée dans MEMORY.media_memory aux requêtes IA.
function narrativeMemoryForAi(mem) {
  if (!mem || typeof mem !== 'object') return undefined;
  const asked = [
    ...((mem.pressHistory || []).slice(-12).map((x) => ({ date: x.date, journalist: x.journalist, question: x.question, answer: x.answer || undefined }))),
    ...((mem.interviewHistory || []).slice(-6).map((x) => ({ date: x.date, journalist: x.journalist, question: x.question }))),
  ].slice(-14);
  const quotes = (mem.quoteVault || []).slice(-6).map((q) => ({ id: q.id, date: q.date, source: q.source, text: q.text }));
  const arcs = (mem.dramaArcs || []).filter((a) => a.status === 'active').map((a) => ({ kind: a.kind, heat: a.heat, headline: a.headline }));
  const pb = mem.pressBehavior || {};
  const rep = pb.skips > 0 || pb.noComments >= 2 ? { skips_in_a_row: pb.skips || 0, recent_no_comments: pb.noComments || 0, last_skip_on: pb.lastSkipOn || undefined } : undefined;
  if (!asked.length && !quotes.length && !arcs.length && !rep) return undefined;
  return {
    ...(asked.length ? { recent_questions_do_not_repeat: asked } : {}),
    ...(quotes.length ? { quote_vault: quotes } : {}),
    ...(arcs.length ? { active_drama_arcs: arcs } : {}),
    ...(rep ? { press_reputation: rep } : {}),
  };
}

module.exports = {
  MAX_PRESS_HISTORY,
  MAX_INTERVIEW_HISTORY,
  MAX_QUOTE_VAULT,
  MAX_DRAMA_ARCS,
  MAX_PERSONA_BEATS,
  defaultNarrativeMemory,
  normalizeNarrativeMemory,
  loadNarrativeMemory,
  saveNarrativeMemory,
  recordPressQuestions,
  recordPressAnswers,
  recordPressSkip,
  recordInterviewQuestions,
  recordInterviewAnswer,
  recordKopQuote,
  notePersonaBeat,
  markQuoteUsed,
  dismissDramaArc,
  clearMediaQuestionHistory,
  findRepeatedQuestions,
  pickPressBeats,
  narrativeMemoryForAi,
};
