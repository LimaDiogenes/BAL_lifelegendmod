'use strict';
// Où vivent les proches, et quand il peut vraiment partir (2.0). Un footballeur ne rentre pas chez lui pour une journée :
// un voyage à la maison n'a de sens qu'avec au moins 4 jours sans match d'affilée (trêve sans sélection, vacances).
// Les proches qui vivent loin viennent le voir, appellent, ou écrivent comme quelqu'un qui est loin.
// Rien ici n'est imposé aux carrières existantes : un proche sans lieu (« non précisé ») garde des textes neutres.

const LIVES = ['with', 'city', 'hometown', 'abroad'];
const TRIP_MIN_FREE_DAYS = 4;

const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const normLives = (v) => (LIVES.includes(v) ? v : '');
/** Lives in his hometown or in another country: visits, calls, messages from afar. */
const isFar = (p) => p?.lives === 'hometown' || p?.lives === 'abroad';

/** Every known match date: club and national team, from the live snapshot and the save, plus matches still to sync. */
function matchDates(state) {
  const set = new Set();
  for (const snap of [state?.snapshot, state?.saveSnapshot]) {
    for (const f of [...(snap?.fixtures || []), ...(snap?.nationalTeam?.fixtures || [])]) {
      if (f?.date && isIso(f.date)) set.add(f.date);
    }
    if (snap?.next?.date && isIso(snap.next.date)) set.add(snap.next.date);
    if (snap?.nationalTeam?.next?.date && isIso(snap.nationalTeam.next.date)) set.add(snap.nationalTeam.next.date);
  }
  for (const m of state?.calendar?.pendingMatches || []) {
    if (m?.date && isIso(m.date)) set.add(m.date);
  }
  return set;
}

/** Days without a match in a row around this date (0 on a match day), counted up to `cap` each way. */
function freeRunAround(state, iso, cap = 10, dates = null) {
  if (!isIso(iso)) return 0;
  const m = dates || matchDates(state);
  if (m.has(iso)) return 0;
  let n = 1;
  for (let i = 1; i <= cap && !m.has(addDays(iso, -i)); i += 1) n += 1;
  for (let i = 1; i <= cap && !m.has(addDays(iso, i)); i += 1) n += 1;
  return n;
}

/** A trip home (or abroad) only makes sense with at least 4 match-free days in a row. */
const canTravelHome = (state, iso, dates = null) => freeRunAround(state, iso, 10, dates) >= TRIP_MIN_FREE_DAYS;

/** The same day, or the next one without a match (system events never sit on a match day). */
function nextFreeDay(state, iso, dates = null, max = 21) {
  if (!isIso(iso)) return iso;
  const m = dates || matchDates(state);
  let d = iso;
  for (let i = 0; i < max && m.has(d); i += 1) d = addDays(d, 1);
  return d;
}

module.exports = { LIVES, TRIP_MIN_FREE_DAYS, normLives, isFar, matchDates, freeRunAround, canTravelHome, nextFreeDay };
