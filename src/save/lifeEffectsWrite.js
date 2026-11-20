'use strict';
// Effets optionnels de « Ma vie » écrits dans la sauvegarde Become a Legend (jeu fermé uniquement) :
// - fiche + 318 : affection / relation avec le coach (0..99)
// - fiche + 327 (bits 0..2) : flèche de forme (0 = très mauvaise .. 4 = excellente), bits 3..7 préservés
// - fiche + 328 : indisponibilité en jours (ne réduit jamais une blessure/sanction plus longue déjà en place)
// Passe exclusivement par writeInSave (src/save/influenceWrite.js) avec copie de sécurité et relecture vérifiée.

const { writeInSave } = require('./influenceWrite');
const { PLAYER_REC } = require('./blReader');
const { readPlayerProfile } = require('./playerProfile');

const PROFILE_BEFORE_ID = 48;
const AFFECTION_REL = 318;
const FORM_ARROW_REL = 327;
const UNAVAILABLE_REL = 328;
const PROFILE_SIZE = 376;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

function lifeEffectsInData(source, { playerId, affectionDelta = 0, formArrowDelta = 0, unavailableDays = 0 } = {}) {
  const d = Buffer.from(source);
  const start = PLAYER_REC - PROFILE_BEFORE_ID;
  if (d.length < start + PROFILE_SIZE || d.readUInt32LE(PLAYER_REC) !== playerId) {
    throw new Error('Ce n’est pas la sauvegarde de ton joueur : rien n’a été modifié.');
  }
  const prof = readPlayerProfile(d, PLAYER_REC);
  if (!prof) throw new Error('Ce n’est pas la sauvegarde de ton joueur : rien n’a été modifié.');

  const affOff = start + AFFECTION_REL;
  const arrowOff = start + FORM_ARROW_REL;
  const unavailOff = start + UNAVAILABLE_REL;

  const before = {
    affection: d[affOff],
    formArrowLevel: d[arrowOff] & 0x07,
    unavailableDays: d[unavailOff],
  };

  const affStep = clamp(affectionDelta, -12, 12);
  const arrowStep = clamp(formArrowDelta, -2, 2);
  const reqDays = clamp(unavailableDays, 0, 30);

  const nextAff = clamp(before.affection + affStep, 0, 99);
  const nextArrow = clamp(before.formArrowLevel + arrowStep, 0, 4);
  const nextUnavail = reqDays > 0 ? Math.max(before.unavailableDays, reqDays) : before.unavailableDays;

  const changes = [];
  if (nextAff !== before.affection) {
    d[affOff] = nextAff;
    changes.push(`affection ${before.affection} -> ${nextAff}`);
  }
  if (nextArrow !== before.formArrowLevel) {
    // Préserve strictement les 5 bits de poids fort de l'octet +327.
    d[arrowOff] = (d[arrowOff] & ~0x07) | (nextArrow & 0x07);
    changes.push(`forme ${before.formArrowLevel} -> ${nextArrow}`);
  }
  if (nextUnavail !== before.unavailableDays) {
    d[unavailOff] = nextUnavail;
    changes.push(`indisponible ${nextUnavail} j`);
  }

  if (!changes.length) throw new Error('Aucun changement à écrire dans la sauvegarde.');

  return {
    data: d,
    before,
    after: { affection: d[affOff], formArrowLevel: d[arrowOff] & 0x07, unavailableDays: d[unavailOff] },
    changes,
  };
}

function applyLifeEffects({ savePath, backupDir, playerId, affectionDelta = 0, formArrowDelta = 0, unavailableDays = 0 }) {
  let expected = null;
  return writeInSave({
    savePath,
    backupDir,
    tag: 'lifeeffects',
    edit: (data) => {
      const r = lifeEffectsInData(data, { playerId, affectionDelta, formArrowDelta, unavailableDays });
      expected = r.after;
      return r;
    },
    check: (d) => {
      if (d.readUInt32LE(PLAYER_REC) !== playerId || !expected) return false;
      const start = PLAYER_REC - PROFILE_BEFORE_ID;
      return d[start + AFFECTION_REL] === expected.affection
        && (d[start + FORM_ARROW_REL] & 0x07) === expected.formArrowLevel
        && d[start + UNAVAILABLE_REL] === expected.unavailableDays;
    },
  });
}

module.exports = { lifeEffectsInData, applyLifeEffects, AFFECTION_REL, FORM_ARROW_REL, UNAVAILABLE_REL };
