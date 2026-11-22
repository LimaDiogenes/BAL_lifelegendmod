'use strict';
// Liens que l'app accepte d'ouvrir hors de sa fenêtre : seulement https:// et mailto:. Tout le reste (http://, file:,
// javascript:, protocoles d'autres programmes…) est bloqué.

function externalUrl(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return null; }
  if (u.protocol === 'https:' && u.hostname) return u.href;
  if (u.protocol === 'mailto:' && u.pathname) return u.href;
  return null;
}

// La page de l'app elle-même (rechargement) : le même fichier, quel que soit le #fragment ou la ?requête.
function samePage(url, pageUrl) {
  try {
    const a = new URL(String(url || '')), b = new URL(String(pageUrl || ''));
    return a.protocol === 'file:' && b.protocol === 'file:' && decodeURIComponent(a.pathname).toLowerCase() === decodeURIComponent(b.pathname).toLowerCase();
  } catch {
    return false;
  }
}

module.exports = { externalUrl, samePage };
