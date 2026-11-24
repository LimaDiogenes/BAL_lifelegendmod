'use strict';
// Gammes des marques automobiles du catalogue de sponsors (2.0) : pour chaque type de voiture de Ma vie, quelques
// modèles réels. Sert au choix de la voiture offerte par un sponsor et à la clause « tu roules dans nos voitures ».
// Gammes 2025-2026 telles que les constructeurs les présentent (liste fixe, jamais cherchée en ligne par l'app) ;
// un type absent = la marque n'en fait pas. Les voitures de collection (car_classic) ne sont jamais concernées.

const LINEUPS = {
  audi: { car_hatch: ['A3 Sportback'], car_sedan: ['A5', 'A6'], car_suv: ['Q5', 'Q7', 'Q6 e-tron'], car_sports: ['RS 3', 'RS 6 Avant'], car_electric_gt: ['RS e-tron GT'] },
  bmw: { car_hatch: ['1 Series'], car_sedan: ['3 Series', '5 Series', 'i5'], car_suv: ['X3', 'X5', 'iX'], car_minivan: ['2 Series Active Tourer'], car_sports: ['M4', 'Z4'], car_electric_gt: ['i4 M60', 'i7'] },
  byd: { car_hatch: ['Dolphin'], car_sedan: ['Seal'], car_suv: ['Atto 3', 'Seal U', 'Tang'], car_minivan: ['Denza D9'], car_electric_gt: ['Seal Performance'], car_supercar: ['Yangwang U9'] },
  cupra: { car_hatch: ['Born', 'León'], car_suv: ['Formentor', 'Terramar', 'Tavascan'], car_sports: ['Formentor VZ5'] },
  ferrari: { car_sports: ['Amalfi', '296 GTB'], car_supercar: ['SF90 Stradale', '12Cilindri'], car_suv: ['Purosangue'] },
  ford: { car_suv: ['Puma', 'Kuga', 'Explorer EV'], car_minivan: ['Tourneo Custom'], car_sports: ['Mustang', 'Mustang Dark Horse'], car_electric_gt: ['Mustang Mach-E GT'] },
  honda: { car_hatch: ['Civic', 'Jazz'], car_sedan: ['Accord'], car_suv: ['HR-V', 'ZR-V', 'CR-V'], car_minivan: ['Odyssey'], car_sports: ['Civic Type R'] },
  hyundai: { car_hatch: ['i20', 'i30'], car_sedan: ['Ioniq 6'], car_suv: ['Tucson', 'Santa Fe', 'Ioniq 5'], car_minivan: ['Staria'], car_sports: ['Ioniq 5 N'] },
  kia: { car_hatch: ['Picanto', 'Ceed'], car_sedan: ['EV4', 'K5'], car_suv: ['Sportage', 'Sorento', 'EV9'], car_minivan: ['Carnival'], car_electric_gt: ['EV6 GT'] },
  lamborghini: { car_supercar: ['Revuelto', 'Temerario'], car_suv: ['Urus SE'] },
  lexus: { car_sedan: ['ES', 'LS'], car_suv: ['NX', 'RX', 'LX'], car_minivan: ['LM'], car_sports: ['LC 500'] },
  'mg motor': { car_hatch: ['MG4'], car_sedan: ['MG7'], car_suv: ['ZS', 'HS'], car_electric_gt: ['Cyberster'] },
  mahindra: { car_suv: ['Thar', 'Scorpio-N', 'XUV700', 'XEV 9e', 'BE 6'] },
  'mercedes-benz': { car_hatch: ['A-Class'], car_sedan: ['C-Class', 'E-Class', 'S-Class'], car_suv: ['GLC', 'GLE', 'G-Class'], car_minivan: ['V-Class'], car_sports: ['AMG GT Coupé', 'SL'], car_electric_gt: ['EQS', 'CLA EV'], car_supercar: ['AMG ONE'] },
  porsche: { car_sports: ['911 Carrera', '718 Cayman'], car_suv: ['Macan', 'Cayenne'], car_sedan: ['Panamera'], car_electric_gt: ['Taycan'], car_supercar: ['911 Turbo S', '911 GT3 RS'] },
  'range rover': { car_suv: ['Evoque', 'Velar', 'Range Rover Sport', 'Range Rover'] },
  rivian: { car_suv: ['R2', 'R1S', 'R1T'] },
  'tata motors': { car_hatch: ['Tiago', 'Altroz'], car_sedan: ['Tigor'], car_suv: ['Punch', 'Nexon', 'Harrier', 'Safari'] },
  toyota: { car_hatch: ['Yaris', 'Corolla'], car_sedan: ['Camry'], car_suv: ['RAV4', 'bZ4X', 'Land Cruiser'], car_minivan: ['Proace Verso', 'Alphard'], car_sports: ['GR86', 'GR Supra'] },
  volvo: { car_hatch: ['EX30'], car_sedan: ['ES90'], car_suv: ['XC40', 'XC60', 'XC90', 'EX90'] },
};
const ALIASES = { mercedes: 'mercedes-benz', 'land rover': 'range rover', mg: 'mg motor', tata: 'tata motors' };

function lineupFor(brand) {
  const key = String(brand || '').trim().toLowerCase();
  return LINEUPS[key] || LINEUPS[ALIASES[key]] || null;
}

/** Does this brand make this type of car? Unknown brands (typed by hand) are taken as making every type but classics. */
function brandMakes(brand, catId) {
  if (catId === 'car_classic') return false;
  const l = lineupFor(brand);
  return l ? Boolean(l[catId]?.length) : true;
}

/** A model of this brand for this type (the n-th, to vary from year to year), or ''. */
function modelFor(brand, catId, n = 0) {
  const list = lineupFor(brand)?.[catId] || [];
  return list.length ? list[Math.abs(n) % list.length] : '';
}

module.exports = { LINEUPS, lineupFor, brandMakes, modelFor };
