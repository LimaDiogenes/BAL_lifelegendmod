'use strict';
// Moteur de drame et de mise sous le projecteur (Spotlight Drama Engine) :
// génère des récits médiatiques et de supporters réalistes même quand tout va bien sur le terrain,
// à partir uniquement des faits réels de la sauvegarde, de la personnalité (persona), de la bio et de Ma vie.

const { normalizePersona, TRAIT_KEYS, ROOT_KEYS, FLAVOR_KEYS } = require('./persona');

const DRAMA_KINDS = [
  'tall_poppy_skeptics',
  'brand_vs_football',
  'persona_friction',
  'divided_loyalties',
  'dressing_room_shadow',
  'roots_backstory_echo',
  'media_cold_war',
  'invincible_target',
  'quote_boomerang',
];

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

const isWinCode = (c) => /^[vw]/i.test(String(c || ''));

function detectDramaCandidates({ state = {}, snapshot = {}, changes = {}, mem = {} } = {}) {
  const candidates = [];
  const gameDate = snapshot?.gameDate || state?.snapshot?.gameDate || '2026-08-01';
  const player = snapshot?.player || {};
  const club = snapshot?.club || {};
  const table = Array.isArray(snapshot?.table) ? snapshot.table : [];
  const row = table.find((r) => r.mine) || null;
  const total = snapshot?.stats?.total || {};
  const hub = state?.lifeHub;
  const normPersona = state?.persona ? normalizePersona(state.persona) : null;
  const pb = mem?.pressBehavior || {};

  // 1. Guerre froide avec la presse (conférence séchée ou refus répétés de répondre)
  if ((pb.skips || 0) >= 1 || (pb.noComments || 0) >= 2) {
    const skips = pb.skips || 0;
    const ncs = pb.noComments || 0;
    candidates.push({
      kind: 'media_cold_war',
      heat: (skips >= 2 || ncs >= 3) ? 3 : 2,
      headline: skips >= 1 ? `${player.name || 'Player'} snubs the press room` : `${player.name || 'Player'} shuts down reporters`,
      angle: skips >= 1
        ? `He skipped the post-match press conference (${skips} time(s)): journalists accuse him of dodging accountability and fans argue on Kop whether silence is strength or arrogance`
        : `Multiple "no comment" answers (${ncs}) leave beat writers frustrated and split fans over his frosty attitude with the media`,
      targetFacet: 'press_behavior',
    });
  }

  // 2. Tall-poppy / sceptiques quand ses stats et son équipe écrasent tout
  const recentWins = (row?.form || []).slice(-5).filter(isWinCode).length;
  const apps = Number(total.apps) || 0;
  const contrib = (Number(total.goals) || 0) + (Number(total.assists) || 0);
  const avg = Number(total.avgRating) || 0;
  if (recentWins >= 4 || (row && row.pos <= 2 && (row.p || 0) >= 6) || (apps >= 4 && (contrib / apps >= 1.0 || avg >= 7.3))) {
    const high = apps >= 8 && contrib / apps >= 1.5;
    candidates.push({
      kind: 'tall_poppy_skeptics',
      heat: high ? 3 : 2,
      headline: `System star or untouchable genius? Skeptics come for ${player.name || 'him'}`,
      angle: `With elite numbers (${total.goals || 0} goals, ${total.assists || 0} assists${avg ? `, avg ${avg}` : ''}) for ${club.name || 'his club'}, rival hate-watchers and contrarian pundits push tall-poppy takes ("system merchant", "stat-padder in a dominant side", "wait for the knockout pressure") even while he does nothing wrong on the pitch`,
      targetFacet: 'peak_form',
    });
  }

  // 3. Empire commercial & lifestyle vs terrain
  if (hub?.calibrated) {
    const sponsors = (hub.sponsors || []).filter((s) => s?.brand).map((s) => s.brand);
    const notableAssets = (hub.assets || [])
      .filter((a) => a.catalogId !== 'rented_studio' && (a.custom || ['home', 'car', 'charity', 'staff'].includes(a.category)))
      .map((a) => a.name || String(a.catalogId || '').replace(/_/g, ' '))
      .filter(Boolean);
    if (sponsors.length >= 3 || notableAssets.length >= 2) {
      const topBrands = sponsors.slice(0, 3).join(', ');
      const topAssets = notableAssets.slice(0, 2).join(', ');
      candidates.push({
        kind: 'brand_vs_football',
        heat: sponsors.length >= 6 ? 3 : 2,
        headline: `Empire off the pitch: ${sponsors.length} sponsors around ${player.name || 'him'}`,
        angle: `Pundits and cynical fans debate whether his commercial footprint (${sponsors.length} active deals${topBrands ? ` including ${topBrands}` : ''}${topAssets ? `, plus lifestyle choices like ${topAssets}` : ''}) turns his brand bigger than the club or risks becoming a distraction`,
        targetFacet: 'commercial_lifestyle',
      });
    }
  }

  // 4. Friction liée aux traits de personnalité (FACTS.persona)
  if (normPersona && TRAIT_KEYS.some((k) => Boolean(normPersona.traits[k]))) {
    const t = normPersona.traits;
    let traitAngle = '';
    let facet = 'personality';
    if (t.media === 'guarded_tactical' || t.media === 'media_shy') {
      traitAngle = 'Rivals and columnists call his guarded, short media answers cold or robotic, while defenders argue quiet focus beats empty PR slogans';
      facet = `media:${t.media}`;
    } else if (t.ego === 'humble_star' || t.media === 'calm_humble' || t.lifestyle === 'bookish_calm') {
      traitAngle = 'Cynics on Kop dismiss his understated, humble image as calculated PR too clean to be true, clashing with fans who respect his discipline';
      facet = `ego:${t.ego || t.lifestyle || t.media}`;
    } else if (t.media === 'cocky_charismatic' || t.ego === 'main_character' || t.media === 'unfiltered') {
      traitAngle = 'Opposition fans and pundits accuse him of acting bigger than the dressing room, turning every quote and gesture into headline bait';
      facet = `ego:${t.ego || t.media}`;
    } else if (t.temperament === 'hot_headed' || t.temperament === 'volatile' || t.temperament === 'passionate') {
      traitAngle = 'Critics wonder aloud if opponents are deliberately baiting his fiery temperament, while supporters love the edge it brings';
      facet = `temperament:${t.temperament}`;
    } else if (t.lifestyle === 'flashy_lux' || t.lifestyle === 'nightlife_music' || t.lifestyle === 'jet_setter') {
      traitAngle = 'Tabloids and grumpy traditionalists put a magnifying glass on his glamorous off-pitch lifestyle whenever a match gets tight';
      facet = `lifestyle:${t.lifestyle}`;
    } else if (t.loyalty === 'ambitious_climber' || t.loyalty === 'highest_bidder' || t.loyalty === 'restless_nomad') {
      traitAngle = 'Skeptical supporters question how long his commitment to the club lasts before he eyes the next big step';
      facet = `loyalty:${t.loyalty}`;
    } else {
      traitAngle = 'Observers dissect how his personality traits off the pitch collide with relentless expectations inside the club';
    }
    candidates.push({
      kind: 'persona_friction',
      heat: 2,
      headline: `The image debate around ${player.name || 'him'}`,
      angle: traitAngle,
      targetFacet: facet,
    });
  }

  // 5. Ambition internationale / loyautés divisées
  const ambition = normPersona?.traits?.ambition || '';
  const ambitionNt = /world\s*cup|mondial|copa|sele[cç]|national|champion|brazil|brasil|france|england|spain|argentin|portugal|ital|german/i.test(ambition);
  const ntName = snapshot?.nationalTeam?.name || player?.nationality || '';
  if (ambitionNt || (snapshot?.nationalTeam?.inSquad && apps >= 6)) {
    candidates.push({
      kind: 'divided_loyalties',
      heat: 2,
      headline: ntName ? `${club.name || 'Club'} vs ${ntName}: where does his obsession lie?` : 'Club glory or international obsession?',
      angle: ambitionNt
        ? `His stated ambition ("${ambition}") feeds debate on Kop and in press columns: skeptical fans wonder if ${club.name || 'the club'} is just a stepping stone toward ${ntName || 'national team'} immortality`
        : `Pundits and fans debate managing his workload and focus between ${club.name || 'his club'} and ${ntName || 'his national team'}`,
      targetFacet: 'ambition_nt',
    });
  }

  // 6. Ombre sur le vestiaire / « one-man team »
  const intel = snapshot?.squadIntel || {};
  const rivalPos = intel.positionRivals?.[0]?.name || null;
  const nonMeCap = intel.captain && !intel.captain.me ? intel.captain.name : null;
  if ((contrib >= 6 || avg >= 7.3) && (rivalPos || nonMeCap || intel.unusedBench?.length)) {
    const rivalNote = rivalPos ? ` (especially teammates fighting for his spot like ${rivalPos})` : nonMeCap ? ` around captain ${nonMeCap}` : '';
    candidates.push({
      kind: 'dressing_room_shadow',
      heat: 2,
      headline: `The ${player.name || 'star'} show: too much shadow in the dressing room?`,
      angle: `With his massive output for ${club.name || 'the side'}, talk-show pundits question whether the attack revolves too heavily around one player${rivalNote} and whether coach ${club.coach || 'the manager'} gets enough credit`,
      targetFacet: rivalPos || nonMeCap || 'squad_balance',
    });
  }

  // 7. Racines, bio, goûts et entourage réel (FACTS.biography / FACTS.persona)
  const hasBio = Boolean(state?.bio?.text && state.bio.text.length >= 80);
  const hasRoots = Boolean(normPersona && (ROOT_KEYS.some((k) => normPersona.roots[k]) || FLAVOR_KEYS.some((k) => normPersona.flavor[k]) || Object.values(normPersona.circle).some((list) => list.some((p) => p.name))));
  if (hasBio || hasRoots) {
    const isBig = hub?.stage === 'superstar' || hub?.stage === 'star' || (state?.profile?.followers || 0) >= 500000;
    candidates.push({
      kind: 'roots_backstory_echo',
      heat: isBig ? 2 : 1,
      headline: `Long way from home: has stardom changed ${player.name || 'him'}?`,
      angle: 'Feature writers and Kop voices contrast details from his backstory in FACTS.biography (and real roots/inner circle in FACTS.persona, without inventing unlisted names) against his current status — debating whether fame has changed his edge',
      targetFacet: 'biography_roots',
    });
  }

  // 8. Série invincible : cible dans le dos
  const formAllWins = (row?.form || []).length >= 5 && row.form.slice(-5).every(isWinCode);
  const bigLead = Boolean(row && row.pos === 1 && row.p >= 8 && table[1] && (row.pts - table[1].pts) >= 5);
  const unbeaten = Boolean(row && row.l === 0 && row.p >= 8);
  if (unbeaten || bigLead || formAllWins) {
    candidates.push({
      kind: 'invincible_target',
      heat: (row?.p || 0) >= 15 && unbeaten ? 3 : 2,
      headline: `Target on their back: everyone waits for ${club.name || 'the leaders'} to crack`,
      angle: `On a dominant run (${row ? `${row.pos}e, ${row.pts} pts, ${row.w}W-${row.d}D-${row.l}L` : 'winning streak'}), every opponent treats the match like a final and pundits circle the calendar waiting for the first slip so backlash can erupt`,
      targetFacet: 'streak_pressure',
    });
  }

  // 9. Effet boomerang d'une ancienne déclaration (quoteVault)
  const qCand = [...(mem?.quoteVault || [])]
    .filter((q) => (q.usedCount || 0) < 2 && daysBetween(q.date, gameDate) >= 7)
    .sort((a, b) => (a.usedCount - b.usedCount) || a.date.localeCompare(b.date))[0];
  if (qCand) {
    candidates.push({
      kind: 'quote_boomerang',
      heat: 2,
      headline: `Receipts from ${qCand.date}: his own words come back`,
      angle: `Pundits and rival accounts dig up what he actually said on ${qCand.date} ("${qCand.text.slice(0, 140)}") to test whether he lives up to it now`,
      targetFacet: qCand.id,
    });
  }

  return candidates;
}

function spotlightLevel({ state = {}, snapshot = {}, mem = {} } = {}) {
  const row = (snapshot?.table || []).find((r) => r.mine) || null;
  const total = snapshot?.stats?.total || {};
  const followers = state?.profile?.followers || 0;
  const stage = state?.lifeHub?.stage;
  const sponsors = state?.lifeHub?.sponsors?.length || 0;
  const active = (mem?.dramaArcs || []).filter((a) => a.status === 'active');
  const maxHeat = active.reduce((m, a) => Math.max(m, a.heat || 1), 0);

  let s = 18;
  if (followers >= 1000000) s += 20;
  else if (followers >= 200000) s += 12;
  else if (followers >= 30000) s += 6;
  if (stage === 'superstar') s += 14;
  else if (stage === 'star') s += 9;
  else if (stage === 'established') s += 4;
  s += Math.min(14, sponsors * 2);
  if (row && ((row.l === 0 && row.p >= 6) || (row.pos <= 2 && row.p >= 6))) s += 14;
  if ((total.apps || 0) >= 5 && (((total.goals || 0) + (total.assists || 0)) / total.apps >= 1 || (total.avgRating || 0) >= 7.3)) s += 12;
  if ((state?.fanMood?.level || 0) >= 2) s += 10;
  if ((mem?.pressBehavior?.skips || 0) >= 1) s += 8;
  s += Math.min(18, maxHeat * 6);
  return Math.max(0, Math.min(100, Math.round(s)));
}

function tickDramaArcs({ state = {}, snapshot = {}, changes = {}, mem = {} } = {}) {
  mem.dramaArcs ||= [];
  const gameDate = snapshot?.gameDate || state?.snapshot?.gameDate || '2026-08-01';
  const editions = state?.editions?.length || 0;
  const detected = detectDramaCandidates({ state, snapshot, changes, mem });
  const byKind = new Map(detected.map((c) => [c.kind, c]));

  // Faire avancer ou clore les arcs actifs existants.
  for (const arc of mem.dramaArcs) {
    if (arc.status !== 'active') continue;
    arc.editionsActive = (arc.editionsActive || 0) + 1;
    arc.lastSeenOn = gameDate;
    const fresh = byKind.get(arc.kind);
    if (fresh) {
      arc.heat = Math.max(arc.heat || 1, fresh.heat || 1);
      arc.headline = fresh.headline;
      arc.angle = fresh.angle;
    }
    const maxLife = arc.heat >= 3 ? 4 : 3;
    if (arc.editionsActive >= maxLife) {
      arc.status = 'resolved';
      arc.cooldownUntil = addDaysIso(gameDate, 28);
    }
  }

  let active = mem.dramaArcs.filter((a) => a.status === 'active');
  const blockedKinds = new Set([
    ...active.map((a) => a.kind),
    ...mem.dramaArcs.filter((a) => a.status === 'resolved' && a.cooldownUntil && a.cooldownUntil > gameDate).map((a) => a.kind),
  ]);

  const pool = detected.filter((c) => !blockedKinds.has(c.kind));
  const seed = hashOf(`${state?.careerId || ''}|${gameDate}|${editions}`);

  while (active.length < 2 && pool.length > 0) {
    let idx = pool.findIndex((c) => c.kind === 'media_cold_war');
    if (idx < 0) {
      const topHeat = Math.max(...pool.map((c) => c.heat || 1));
      const hotPool = pool.filter((c) => (c.heat || 1) >= topHeat);
      const chosen = hotPool[(seed + active.length * 7) % hotPool.length];
      idx = pool.indexOf(chosen);
    }
    const [pick] = pool.splice(idx, 1);
    const arc = {
      id: `arc_${(hashOf(`${pick.kind}|${gameDate}|${mem.dramaArcs.length}`) >>> 0).toString(36)}`,
      kind: pick.kind,
      status: 'active',
      heat: pick.heat,
      headline: pick.headline,
      angle: pick.angle,
      targetFacet: pick.targetFacet,
      startedOn: gameDate,
      lastSeenOn: gameDate,
      editionsActive: 1,
      cooldownUntil: null,
    };
    mem.dramaArcs.push(arc);
    active.push(arc);
  }

  active = mem.dramaArcs.filter((a) => a.status === 'active').sort((a, b) => (b.heat - a.heat) || a.startedOn.localeCompare(b.startedOn));
  if (mem.dramaArcs.length > 16) {
    const resolved = mem.dramaArcs.filter((a) => a.status !== 'active').slice(-Math.max(0, 16 - active.length));
    mem.dramaArcs = [...resolved, ...active];
  }

  return {
    active,
    primary: active[0] || null,
    secondary: active[1] || null,
    spotlight: spotlightLevel({ state, snapshot, mem }),
  };
}

function dramaFacts(mem) {
  const active = (mem?.dramaArcs || []).filter((a) => a.status === 'active');
  if (!active.length) return undefined;
  return {
    spotlight_note: 'Ongoing public/media drama narratives built strictly from real FACTS, FACTS.persona, FACTS.biography, and FACTS.off_pitch_hub — opinions, scrutiny, hot takes, and fan splits, never invented scandals or unlisted relatives.',
    active_arcs: active.map((a) => ({
      id: a.id,
      kind: a.kind,
      heat: a.heat,
      headline: a.headline,
      angle: a.angle,
      editions_active: a.editionsActive || 1,
    })),
  };
}

module.exports = {
  DRAMA_KINDS,
  detectDramaCandidates,
  tickDramaArcs,
  dramaFacts,
  spotlightLevel,
};
