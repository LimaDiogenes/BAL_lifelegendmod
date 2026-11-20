'use strict';
// Journaux nationaux par pays (Phase E) : remplace le nom unique « La Transversale » par un quotidien
// sportif fictif cohérent avec le championnat du joueur (Angleterre, Brésil, Espagne, Italie, Allemagne,
// France, Portugal, Pays-Bas, Argentine, etc.) avec passage automatique lors d’un transfert à l’étranger
// ou choix/nom personnalisé dans Réglages › Le monde. Noms strictement fictifs.

const DEFAULT_PAPER_ID = 'france';

const NATIONAL_PAPERS = [
  {
    id: 'england',
    country: 'England',
    name: 'The Touchline',
    slug: 'thetouchline',
    showName: 'Matchnight Panel',
    voice: 'Brisk, unsentimental British national sports daily: numbers, form tables, cup pedigree and dressing-room pressure.',
    patterns: [/premier league|efl|(?<!scottish\s)championship|league one|league two|fa cup|carabao/i],
    leadDesk: [
      { name: 'Callum Vance', role: 'Chroniqueur national' },
      { name: 'Priya Nair', role: 'Analyste tactique' },
      { name: 'Gareth Holt', role: 'Éditorialiste' },
      { name: 'Declan Mercer', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Hannah Brooks', role: 'Reporter' },
    ],
  },
  {
    id: 'brazil',
    country: 'Brazil',
    name: 'Folha do Gramado',
    slug: 'folhadogramado',
    showName: 'Mesa Redonda da Rodada',
    voice: 'Expressive, sharp Brazilian sports daily: flair on the pitch, fierce home pressure, derby pride and continental ambition.',
    patterns: [/brasileir|copa do brasil|s[eé]rie [ab]\s*(do\s+)?brasil|paulista|carioca/i],
    leadDesk: [
      { name: 'Rodrigo Valente', role: 'Chroniqueur national' },
      { name: 'Camila Peixoto', role: 'Analyste tactique' },
      { name: 'Henrique Tavares', role: 'Éditorialiste' },
      { name: 'Beto Queiroz', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Larissa Prado', role: 'Reporter' },
    ],
  },
  {
    id: 'spain',
    country: 'Spain',
    name: 'Diario Balón',
    slug: 'diariobalon',
    showName: 'El Tercer Tiempo',
    voice: 'Passionate Spanish national sports daily: possession, tactical duels, title-race pressure and stark front-page verdicts.',
    patterns: [/laliga|la liga|primera divisi[oó]n|segunda divisi[oó]n|copa del rey/i],
    leadDesk: [
      { name: 'Álvaro Cifuentes', role: 'Chroniqueur national' },
      { name: 'Lucía Serrano', role: 'Analyste tactique' },
      { name: 'Mateo Roldán', role: 'Éditorialiste' },
      { name: 'Raúl Santamaría', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Elena Ibáñez', role: 'Reporter' },
    ],
  },
  {
    id: 'italy',
    country: 'Italy',
    name: 'Corriere del Pallone',
    slug: 'corrieredelpallone',
    showName: 'Novanta Minuti',
    voice: 'Analytical Italian sports daily: tactical discipline, defensive craft, league standings and merciless tactical scrutiny.',
    patterns: [/serie a\b|serie bkt|serie b\b|coppa italia/i],
    leadDesk: [
      { name: 'Lorenzo Ferretti', role: 'Chroniqueur national' },
      { name: 'Giulia Bellini', role: 'Analyste tactique' },
      { name: 'Marco Santoro', role: 'Éditorialiste' },
      { name: 'Davide Conti', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Alessia Moretti', role: 'Reporter' },
    ],
  },
  {
    id: 'germany',
    country: 'Germany',
    name: 'Anstoß Kurier',
    slug: 'anstosskurier',
    showName: 'Der Spieltag-Talk',
    voice: 'Direct, precision-minded German sports daily: pressing metrics, work-rate, club structure and sober judgements.',
    patterns: [/bundesliga|dfb[\s-]?pokal/i],
    leadDesk: [
      { name: 'Tobias Lindner', role: 'Chroniqueur national' },
      { name: 'Katrin Seidel', role: 'Analyste tactique' },
      { name: 'Lukas Baumann', role: 'Éditorialiste' },
      { name: 'Stefan Köhler', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Nina Hartmann', role: 'Reporter' },
    ],
  },
  {
    id: 'france',
    country: 'France',
    name: 'La Transversale',
    slug: 'latransversale',
    showName: 'Le Débrief',
    voice: 'Factual, sober French national sports daily with sharp tactical and dressing-room analysis.',
    patterns: [/ligue 1|ligue 2|national fff|coupe de france/i],
    leadDesk: [
      { name: 'Marc Lhermitte', role: 'Chroniqueur national' },
      { name: 'Sofiane Kerbrat', role: 'Analyste tactique' },
      { name: 'Hélène Marchetti', role: 'Éditorialiste' },
      { name: 'Bruno Vidaillac', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Laura Ménard', role: 'Reporter' },
    ],
  },
  {
    id: 'portugal',
    country: 'Portugal',
    name: 'Jornal da Baliza',
    slug: 'jornaldabaliza',
    showName: 'Grande Área',
    voice: 'Portuguese national sports daily: big-three rivalries, youth breakthroughs, technical flair and European campaigns.',
    patterns: [/liga portugal|liga nos|primeira liga|ta[cç]a de portugal/i],
    leadDesk: [
      { name: 'Tiago Nogueira', role: 'Chroniqueur national' },
      { name: 'Inês Monteiro', role: 'Analyste tactique' },
      { name: 'Duarte Almeida', role: 'Éditorialiste' },
      { name: 'Rui Castelo', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Sofia Mendes', role: 'Reporter' },
    ],
  },
  {
    id: 'netherlands',
    country: 'Netherlands',
    name: 'De Buitenkant',
    slug: 'debuitenkant',
    showName: 'Studio Voetbalveld',
    voice: 'Dutch football daily: positional play, academy talent development, crisp passing and candid studio verdicts.',
    patterns: [/eredivisie|keuken kampioen|knvb/i],
    leadDesk: [
      { name: 'Bram Vermeer', role: 'Chroniqueur national' },
      { name: 'Lotte de Vries', role: 'Analyste tactique' },
      { name: 'Sander Kuiper', role: 'Éditorialiste' },
      { name: 'Bas van Dijk', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Roos Bakker', role: 'Reporter' },
    ],
  },
  {
    id: 'argentina',
    country: 'Argentina',
    name: 'Crónica del Área',
    slug: 'cronicadelarea',
    showName: 'Fútbol de Mesa',
    voice: 'Passionate Argentine football daily: grit, temple under pressure, derby intensity and raw terrace sentiment.',
    patterns: [/liga profesional|superliga argentina|primera nacional|copa argentina|\bsuperliga\b/i],
    leadDesk: [
      { name: 'Martín Pereyra', role: 'Chroniqueur national' },
      { name: 'Valentina Sosa', role: 'Analyste tactique' },
      { name: 'Federico Ledesma', role: 'Éditorialiste' },
      { name: 'Germán Quiroga', role: 'Consultant, ancien milieu de terrain' },
      { name: 'Camila Aguirre', role: 'Reporter' },
    ],
  },
  {
    id: 'saudi',
    country: 'Saudi Arabia',
    name: 'Al-Maydan Sports',
    slug: 'almaydansports',
    showName: 'Majlis Al-Malaeb',
    voice: 'Saudi national football daily covering superstar arrivals, title charges and continental fixtures.',
    patterns: [/saudi pro league|\bspl\b/i],
  },
  {
    id: 'scotland',
    country: 'Scotland',
    name: 'The Caledonian Pitch',
    slug: 'caledonianpitch',
    showName: 'Highland Matchtalk',
    voice: 'Scottish sports daily focused on physical battles, derby atmospheres and league tables.',
    patterns: [/scottish|spfl/i],
  },
  {
    id: 'belgium',
    country: 'Belgium',
    name: 'Le But Belge',
    slug: 'lebutbelge',
    showName: 'La Tribune du Dimanche',
    voice: 'Belgian national football daily tracking title playoffs and emerging internationals.',
    patterns: [/jupiler|pro league/i],
  },
  {
    id: 'turkey',
    country: 'Turkey',
    name: 'Santra Gazetesi',
    slug: 'santragazetesi',
    showName: '90 Artı Stüdyo',
    voice: 'Turkish football daily steeped in Istanbul rivalries, heated table battles and fearless headlines.',
    patterns: [/s[uü]per lig|t[uü]rkiye kupas/i],
  },
  {
    id: 'usa',
    country: 'United States',
    name: 'The Pitchside Ledger',
    slug: 'pitchsideledger',
    showName: 'Extra Time Desk',
    voice: 'North American soccer daily tracking conference tables, playoff chases and designated-player form.',
    patterns: [/\bmls\b|major league soccer|us open cup/i],
  },
  {
    id: 'japan',
    country: 'Japan',
    name: 'Pitch Shimbun',
    slug: 'pitchshimbun',
    showName: 'Kickoff Review',
    voice: 'Disciplined Japanese football daily highlighting collective movement, work-rate and J.League consistency.',
    patterns: [/j1 league|j\.?league|emperor'?s cup/i],
  },
  {
    id: 'colombia',
    country: 'Colombia',
    name: 'El Pitazo Deportivo',
    slug: 'pitazodeportivo',
    showName: 'Tercer Tiempo',
    voice: 'Colombian football daily following domestic playoff runs and flair across the league.',
    patterns: [/liga betplay|dimayor/i],
  },
  {
    id: 'chile',
    country: 'Chile',
    name: 'Gaceta del Sur',
    slug: 'gacetadelsur',
    showName: 'Cancha Abierta',
    voice: 'Chilean sports daily tracking title contention and derby fixtures.',
    patterns: [/liga de primera|anfp/i],
  },
];

const slugifyPaper = (name) => String(name || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .slice(0, 32) || 'nationalpress';

const cleanText = (s, max = 60) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function findPaperById(id) {
  return NATIONAL_PAPERS.find((p) => p.id === id) || NATIONAL_PAPERS.find((p) => p.id === DEFAULT_PAPER_ID);
}

function detectLeagueCountry(leagueName) {
  const name = String(leagueName || '').trim();
  if (!name) return DEFAULT_PAPER_ID;
  for (const paper of NATIONAL_PAPERS) {
    if (paper.patterns.some((re) => re.test(name))) return paper.id;
  }
  return DEFAULT_PAPER_ID;
}

function normalizePaperOverride(raw) {
  if (!raw || typeof raw !== 'object') return { mode: 'auto', presetId: '', customName: '', customShow: '' };
  const mode = ['auto', 'preset', 'custom'].includes(raw.mode) ? raw.mode : 'auto';
  const presetId = NATIONAL_PAPERS.some((p) => p.id === raw.presetId) ? raw.presetId : '';
  const customName = cleanText(raw.customName, 60);
  const customShow = cleanText(raw.customShow, 60);
  return { mode, presetId, customName, customShow };
}

function resolveNationalPaper({ snapshot = null, override = null } = {}) {
  const leagueName = snapshot?.league?.name || '';
  const detectedId = detectLeagueCountry(leagueName);
  const detected = findPaperById(detectedId);
  const ov = normalizePaperOverride(override);

  if (ov.mode === 'custom' && ov.customName) {
    return {
      id: detected.id,
      country: detected.country,
      name: ov.customName,
      slug: slugifyPaper(ov.customName),
      showName: ov.customShow || detected.showName || 'Le Débrief',
      voice: detected.voice || '',
      mode: 'custom',
      leadDesk: detected.leadDesk || null,
    };
  }
  if (ov.mode === 'preset' && ov.presetId) {
    const picked = findPaperById(ov.presetId);
    return {
      id: picked.id,
      country: picked.country,
      name: picked.name,
      slug: picked.slug,
      showName: picked.showName,
      voice: picked.voice || '',
      mode: 'preset',
      leadDesk: picked.leadDesk || null,
    };
  }
  return {
    id: detected.id,
    country: detected.country,
    name: detected.name,
    slug: detected.slug,
    showName: detected.showName,
    voice: detected.voice || '',
    mode: 'auto',
    leadDesk: detected.leadDesk || null,
  };
}

function paperDeskTemplate(paper, fallbackDesk = []) {
  const base = Array.isArray(fallbackDesk) && fallbackDesk.length ? fallbackDesk : [];
  const leads = paper?.leadDesk?.length ? paper.leadDesk : base.slice(0, 5);
  return base.map((entry, idx) => (idx < leads.length ? { ...entry, name: leads[idx].name, role: leads[idx].role || entry.role } : entry));
}

module.exports = {
  DEFAULT_PAPER_ID,
  NATIONAL_PAPERS,
  slugifyPaper,
  findPaperById,
  detectLeagueCountry,
  normalizePaperOverride,
  resolveNationalPaper,
  paperDeskTemplate,
};
