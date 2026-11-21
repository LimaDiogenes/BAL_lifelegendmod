'use strict';
// Catalogue complet des sponsors par catégorie, règles d'exclusivité, partenariats mondiaux (addon),
// offres ponctuelles (cover jeu vidéo, shooting, pub TV…) et restrictions légales (paris sportifs).

const EXCLUSIVE_CATEGORIES = [
  'boots', 'apparel', 'fashion', 'eyewear', 'watches',
  'automotive', 'beverage', 'phones', 'telecom', 'airlines',
  'hospitality', 'appliances', 'grooming', 'finance', 'betting',
];

const MULTI_BRAND_CATEGORIES = [
  'health', 'healthy_beverage', 'gaming', 'media', 'lifestyle', 'local',
];

const SPONSOR_CATEGORIES = [...EXCLUSIVE_CATEGORIES, ...MULTI_BRAND_CATEGORIES];

const CATEGORY_ALIASES = {
  travel: 'airlines',
  tech: 'gaming',
};

function canonicalCategory(raw) {
  const clean = String(raw || '').trim();
  const low = clean.toLowerCase();
  if (!low || low === '__custom__' || low === 'global') return low === 'global' ? 'lifestyle' : '';
  if (CATEGORY_ALIASES[low]) return CATEGORY_ALIASES[low];
  if (SPONSOR_CATEGORIES.includes(low)) return low;
  return clean;
}

const CATEGORY_META = {
  boots: { exclusive: true, tierBias: 'all' },
  apparel: { exclusive: true, tierBias: 'all' },
  fashion: { exclusive: true, tierBias: 'high' },
  eyewear: { exclusive: true, tierBias: 'mid' },
  watches: { exclusive: true, tierBias: 'high' },
  automotive: { exclusive: true, tierBias: 'mid' },
  beverage: { exclusive: true, tierBias: 'all' },
  phones: { exclusive: true, tierBias: 'mid' },
  telecom: { exclusive: true, tierBias: 'mid' },
  airlines: { exclusive: true, tierBias: 'high' },
  hospitality: { exclusive: true, tierBias: 'mid' },
  appliances: { exclusive: true, tierBias: 'mid' },
  grooming: { exclusive: true, tierBias: 'all' },
  finance: { exclusive: true, tierBias: 'mid' },
  betting: { exclusive: true, tierBias: 'all', regulated: true },
  health: { exclusive: false, tierBias: 'all' },
  healthy_beverage: { exclusive: false, tierBias: 'all' },
  gaming: { exclusive: false, tierBias: 'all' },
  media: { exclusive: false, tierBias: 'mid' },
  lifestyle: { exclusive: false, tierBias: 'mid' },
  local: { exclusive: false, tierBias: 'starter' },
};

const BRAND_CATALOG = [
  // 1. Boots & Sportswear (umbrella boots + apparel ; Adidas optionally bundles grooming)
  { brand: 'Nike', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rising', baseFee: 240000, bonus: 4000, globalEligible: true, umbrellaNote: 'Boots + Apparel' },
  { brand: 'Adidas', category: 'boots', categories: ['boots', 'apparel', 'grooming'], minStage: 'rising', baseFee: 250000, bonus: 4200, globalEligible: true, umbrellaNote: 'Boots + Apparel + Adidas Body Care' },
  { brand: 'Puma', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 175000, bonus: 3200, globalEligible: true, umbrellaNote: 'Boots + Apparel' },
  { brand: 'New Balance', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 145000, bonus: 2800, globalEligible: true, umbrellaNote: 'Boots + Apparel' },
  { brand: 'Under Armour', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 135000, bonus: 2500, globalEligible: true },
  { brand: 'Mizuno', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 115000, bonus: 2200, globalEligible: false },
  { brand: 'Skechers Football', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rising', baseFee: 155000, bonus: 2800, globalEligible: false },
  { brand: 'Umbro', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 90000, bonus: 1800, globalEligible: false },
  { brand: 'Lotto', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 80000, bonus: 1500, globalEligible: false },
  { brand: 'Diadora', category: 'boots', categories: ['boots', 'apparel'], minStage: 'rookie', baseFee: 82000, bonus: 1600, globalEligible: false },

  // 2. Sportswear standalone (blocks cross-brand conflict with boots)
  { brand: 'Nike Sportswear', category: 'apparel', categories: ['apparel', 'boots'], minStage: 'rising', baseFee: 210000, bonus: 3500, globalEligible: true },
  { brand: 'Adidas Originals', category: 'apparel', categories: ['apparel', 'boots', 'grooming'], minStage: 'rising', baseFee: 220000, bonus: 3600, globalEligible: true },
  { brand: 'Puma Sport', category: 'apparel', categories: ['apparel', 'boots'], minStage: 'rookie', baseFee: 150000, bonus: 2800, globalEligible: true },
  { brand: 'Kappa', category: 'apparel', categories: ['apparel'], minStage: 'rookie', baseFee: 75000, bonus: 1500, globalEligible: false },
  { brand: 'Macron', category: 'apparel', categories: ['apparel'], minStage: 'rookie', baseFee: 70000, bonus: 1400, globalEligible: false },

  // 3. Luxury Fashion (separated from sportswear)
  { brand: 'Louis Vuitton', category: 'fashion', categories: ['fashion'], minStage: 'superstar', baseFee: 580000, bonus: 7500, globalEligible: true },
  { brand: 'Dior', category: 'fashion', categories: ['fashion', 'grooming'], minStage: 'established', baseFee: 520000, bonus: 7000, globalEligible: true, umbrellaNote: 'Fashion + Dior Sauvage grooming' },
  { brand: 'Gucci', category: 'fashion', categories: ['fashion'], minStage: 'established', baseFee: 460000, bonus: 6000, globalEligible: true },
  { brand: 'Prada', category: 'fashion', categories: ['fashion', 'eyewear'], minStage: 'established', baseFee: 440000, bonus: 5800, globalEligible: true, umbrellaNote: 'Fashion + Prada Eyewear' },
  { brand: 'Giorgio Armani', category: 'fashion', categories: ['fashion'], minStage: 'established', baseFee: 410000, bonus: 5500, globalEligible: true },
  { brand: 'Hugo Boss', category: 'fashion', categories: ['fashion', 'grooming'], minStage: 'rising', baseFee: 290000, bonus: 4200, globalEligible: true },
  { brand: 'Balenciaga', category: 'fashion', categories: ['fashion'], minStage: 'established', baseFee: 390000, bonus: 5000, globalEligible: false },
  { brand: 'Versace', category: 'fashion', categories: ['fashion'], minStage: 'established', baseFee: 380000, bonus: 4800, globalEligible: false },
  { brand: 'Burberry', category: 'fashion', categories: ['fashion'], minStage: 'rising', baseFee: 310000, bonus: 4000, globalEligible: true },
  { brand: 'Ralph Lauren', category: 'fashion', categories: ['fashion'], minStage: 'rising', baseFee: 260000, bonus: 3500, globalEligible: false },

  // 4. Eyewear
  { brand: 'Oakley', category: 'eyewear', categories: ['eyewear'], minStage: 'rookie', baseFee: 130000, bonus: 2200, globalEligible: true },
  { brand: 'Ray-Ban', category: 'eyewear', categories: ['eyewear'], minStage: 'rising', baseFee: 185000, bonus: 3000, globalEligible: true },
  { brand: 'Persol', category: 'eyewear', categories: ['eyewear'], minStage: 'established', baseFee: 210000, bonus: 3200, globalEligible: false },
  { brand: 'Police', category: 'eyewear', categories: ['eyewear'], minStage: 'rookie', baseFee: 110000, bonus: 2000, globalEligible: false },
  { brand: 'Carrera', category: 'eyewear', categories: ['eyewear'], minStage: 'rookie', baseFee: 105000, bonus: 1800, globalEligible: false },
  { brand: 'Maui Jim', category: 'eyewear', categories: ['eyewear'], minStage: 'rising', baseFee: 140000, bonus: 2400, globalEligible: false },
  { brand: 'Gentle Monster', category: 'eyewear', categories: ['eyewear'], minStage: 'established', baseFee: 230000, bonus: 3400, globalEligible: true },

  // 5. Watches
  { brand: 'Rolex', category: 'watches', categories: ['watches'], minStage: 'superstar', baseFee: 680000, bonus: 8500, globalEligible: true },
  { brand: 'Audemars Piguet', category: 'watches', categories: ['watches'], minStage: 'superstar', baseFee: 640000, bonus: 8000, globalEligible: true },
  { brand: 'TAG Heuer', category: 'watches', categories: ['watches'], minStage: 'established', baseFee: 420000, bonus: 6000, globalEligible: true },
  { brand: 'Hublot', category: 'watches', categories: ['watches'], minStage: 'established', baseFee: 450000, bonus: 6200, globalEligible: true },
  { brand: 'Omega', category: 'watches', categories: ['watches'], minStage: 'established', baseFee: 430000, bonus: 5800, globalEligible: true },
  { brand: 'Richard Mille', category: 'watches', categories: ['watches'], minStage: 'superstar', baseFee: 720000, bonus: 9000, globalEligible: false },
  { brand: 'Tissot', category: 'watches', categories: ['watches'], minStage: 'rising', baseFee: 210000, bonus: 3200, globalEligible: true },
  { brand: 'Breitling', category: 'watches', categories: ['watches'], minStage: 'established', baseFee: 360000, bonus: 4800, globalEligible: false },
  { brand: 'Jacob & Co.', category: 'watches', categories: ['watches'], minStage: 'superstar', baseFee: 540000, bonus: 7000, globalEligible: false },

  // 6. Automotive
  { brand: 'Porsche', category: 'automotive', categories: ['automotive'], minStage: 'established', baseFee: 420000, bonus: 5800, globalEligible: true },
  { brand: 'Mercedes-Benz', category: 'automotive', categories: ['automotive'], minStage: 'established', baseFee: 440000, bonus: 6000, globalEligible: true },
  { brand: 'Audi', category: 'automotive', categories: ['automotive'], minStage: 'rising', baseFee: 320000, bonus: 4500, globalEligible: true },
  { brand: 'BMW', category: 'automotive', categories: ['automotive'], minStage: 'rising', baseFee: 330000, bonus: 4600, globalEligible: true },
  { brand: 'Ferrari', category: 'automotive', categories: ['automotive'], minStage: 'superstar', baseFee: 620000, bonus: 8000, globalEligible: false },
  { brand: 'Range Rover', category: 'automotive', categories: ['automotive'], minStage: 'established', baseFee: 360000, bonus: 4800, globalEligible: true },
  { brand: 'Cupra', category: 'automotive', categories: ['automotive'], minStage: 'rookie', baseFee: 165000, bonus: 2600, globalEligible: false },
  { brand: 'Hyundai', category: 'automotive', categories: ['automotive'], minStage: 'rookie', baseFee: 155000, bonus: 2500, globalEligible: true },
  { brand: 'Volvo', category: 'automotive', categories: ['automotive'], minStage: 'rising', baseFee: 220000, bonus: 3200, globalEligible: true },

  // 7. Soft & Energy Beverages
  { brand: 'Gatorade', category: 'beverage', categories: ['beverage'], minStage: 'rookie', baseFee: 145000, bonus: 2500, globalEligible: true },
  { brand: 'Powerade', category: 'beverage', categories: ['beverage'], minStage: 'rookie', baseFee: 135000, bonus: 2400, globalEligible: true },
  { brand: 'Red Bull', category: 'beverage', categories: ['beverage'], minStage: 'rising', baseFee: 280000, bonus: 4500, globalEligible: true },
  { brand: 'Pepsi', category: 'beverage', categories: ['beverage'], minStage: 'established', baseFee: 390000, bonus: 5500, globalEligible: true },
  { brand: 'Coca-Cola', category: 'beverage', categories: ['beverage'], minStage: 'established', baseFee: 410000, bonus: 5800, globalEligible: true },
  { brand: 'Monster Energy', category: 'beverage', categories: ['beverage'], minStage: 'rising', baseFee: 210000, bonus: 3400, globalEligible: true },
  { brand: 'Prime Hydration', category: 'beverage', categories: ['beverage'], minStage: 'rising', baseFee: 230000, bonus: 3600, globalEligible: false },
  { brand: 'BodyArmor', category: 'beverage', categories: ['beverage'], minStage: 'rookie', baseFee: 120000, bonus: 2000, globalEligible: false },

  // 8. Healthy Beverages (multi-brand allowed)
  { brand: 'Oi Ocha (Ito En)', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rising', baseFee: 180000, bonus: 3000, globalEligible: true },
  { brand: 'Evian', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rising', baseFee: 150000, bonus: 2400, globalEligible: true },
  { brand: 'San Pellegrino', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rising', baseFee: 145000, bonus: 2300, globalEligible: false },
  { brand: 'Vita Coco', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rookie', baseFee: 95000, bonus: 1700, globalEligible: false },
  { brand: 'AG1', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rising', baseFee: 175000, bonus: 2800, globalEligible: true },
  { brand: 'Pocari Sweat', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'rookie', baseFee: 110000, bonus: 1900, globalEligible: false },
  { brand: 'Fiji Water', category: 'healthy_beverage', categories: ['healthy_beverage'], minStage: 'established', baseFee: 165000, bonus: 2500, globalEligible: false },

  // 9. Health, Nutrition & Recovery (multi-brand allowed)
  { brand: 'Herbalife Nutrition', category: 'health', categories: ['health'], minStage: 'established', baseFee: 320000, bonus: 4500, globalEligible: true },
  { brand: 'Science in Sport (SiS)', category: 'health', categories: ['health'], minStage: 'rookie', baseFee: 115000, bonus: 2000, globalEligible: false },
  { brand: 'Whoop', category: 'health', categories: ['health'], minStage: 'rising', baseFee: 195000, bonus: 3200, globalEligible: true },
  { brand: 'Therabody', category: 'health', categories: ['health'], minStage: 'rising', baseFee: 185000, bonus: 3000, globalEligible: true },
  { brand: 'Hyperice', category: 'health', categories: ['health'], minStage: 'rising', baseFee: 165000, bonus: 2700, globalEligible: false },
  { brand: 'Optimum Nutrition', category: 'health', categories: ['health'], minStage: 'rookie', baseFee: 125000, bonus: 2200, globalEligible: false },
  { brand: 'Myprotein', category: 'health', categories: ['health'], minStage: 'rookie', baseFee: 105000, bonus: 1800, globalEligible: false },
  { brand: 'Oura', category: 'health', categories: ['health'], minStage: 'established', baseFee: 210000, bonus: 3400, globalEligible: true },

  // 10. Smartphones (separated from gaming)
  { brand: 'Samsung Galaxy', category: 'phones', categories: ['phones', 'appliances'], minStage: 'established', baseFee: 450000, bonus: 6000, globalEligible: true, umbrellaNote: 'Smartphones + Appliances' },
  { brand: 'Apple iPhone', category: 'phones', categories: ['phones'], minStage: 'superstar', baseFee: 560000, bonus: 7200, globalEligible: true },
  { brand: 'Google Pixel', category: 'phones', categories: ['phones'], minStage: 'rising', baseFee: 290000, bonus: 4200, globalEligible: true },
  { brand: 'Xiaomi', category: 'phones', categories: ['phones'], minStage: 'rising', baseFee: 240000, bonus: 3600, globalEligible: true },
  { brand: 'Oppo', category: 'phones', categories: ['phones'], minStage: 'rising', baseFee: 220000, bonus: 3400, globalEligible: true },
  { brand: 'Vivo', category: 'phones', categories: ['phones'], minStage: 'rookie', baseFee: 175000, bonus: 2800, globalEligible: true },
  { brand: 'OnePlus', category: 'phones', categories: ['phones'], minStage: 'rookie', baseFee: 145000, bonus: 2300, globalEligible: false },
  { brand: 'Honor', category: 'phones', categories: ['phones'], minStage: 'rookie', baseFee: 140000, bonus: 2200, globalEligible: false },

  // 11. Gaming (separated from phones; multi-brand allowed)
  { brand: 'EA Sports', category: 'gaming', categories: ['gaming'], minStage: 'rising', baseFee: 260000, bonus: 4000, globalEligible: true },
  { brand: 'PlayStation', category: 'gaming', categories: ['gaming'], minStage: 'established', baseFee: 310000, bonus: 4600, globalEligible: true },
  { brand: 'Xbox', category: 'gaming', categories: ['gaming'], minStage: 'established', baseFee: 290000, bonus: 4400, globalEligible: true },
  { brand: 'Konami eFootball', category: 'gaming', categories: ['gaming'], minStage: 'rising', baseFee: 220000, bonus: 3500, globalEligible: true },
  { brand: 'Nintendo', category: 'gaming', categories: ['gaming'], minStage: 'established', baseFee: 250000, bonus: 3800, globalEligible: true },
  { brand: 'Razer', category: 'gaming', categories: ['gaming'], minStage: 'rookie', baseFee: 120000, bonus: 2000, globalEligible: false },
  { brand: 'HyperX', category: 'gaming', categories: ['gaming'], minStage: 'rookie', baseFee: 110000, bonus: 1900, globalEligible: false },
  { brand: 'SteelSeries', category: 'gaming', categories: ['gaming'], minStage: 'rookie', baseFee: 105000, bonus: 1800, globalEligible: false },

  // 12. Telecommunication
  { brand: 'Starlink', category: 'telecom', categories: ['telecom'], minStage: 'established', baseFee: 460000, bonus: 6000, globalEligible: true },
  { brand: 'T-Mobile', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 280000, bonus: 4000, globalEligible: true },
  { brand: 'Vodafone', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 270000, bonus: 3900, globalEligible: true },
  { brand: 'Orange', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 240000, bonus: 3500, globalEligible: true },
  { brand: 'Movistar', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 235000, bonus: 3400, globalEligible: true },
  { brand: 'Vivo Telecom', category: 'telecom', categories: ['telecom'], minStage: 'rookie', baseFee: 180000, bonus: 2800, globalEligible: false },
  { brand: 'TIM', category: 'telecom', categories: ['telecom'], minStage: 'rookie', baseFee: 175000, bonus: 2700, globalEligible: false },
  { brand: 'BT / EE', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 225000, bonus: 3300, globalEligible: false },
  { brand: 'NTT Docomo', category: 'telecom', categories: ['telecom'], minStage: 'rising', baseFee: 230000, bonus: 3400, globalEligible: false },
  { brand: 'Claro', category: 'telecom', categories: ['telecom'], minStage: 'rookie', baseFee: 165000, bonus: 2600, globalEligible: false },

  // 13. Airlines (Top 25+ global carriers, separated from hospitality)
  { brand: 'Emirates', category: 'airlines', categories: ['airlines'], minStage: 'superstar', baseFee: 650000, bonus: 8500, globalEligible: true },
  { brand: 'Qatar Airways', category: 'airlines', categories: ['airlines'], minStage: 'superstar', baseFee: 640000, bonus: 8400, globalEligible: true },
  { brand: 'Turkish Airlines', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 460000, bonus: 6200, globalEligible: true },
  { brand: 'Lufthansa', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 440000, bonus: 5900, globalEligible: true },
  { brand: 'ANA (All Nippon Airways)', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 430000, bonus: 5800, globalEligible: true },
  { brand: 'Japan Airlines', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 420000, bonus: 5700, globalEligible: true },
  { brand: 'Air France / KLM', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 410000, bonus: 5500, globalEligible: true },
  { brand: 'Iberia', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 310000, bonus: 4200, globalEligible: true },
  { brand: 'TUI', category: 'airlines', categories: ['airlines'], minStage: 'rookie', baseFee: 195000, bonus: 3000, globalEligible: false },
  { brand: 'Asiana Airlines', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 285000, bonus: 3900, globalEligible: false },
  { brand: 'Singapore Airlines', category: 'airlines', categories: ['airlines'], minStage: 'superstar', baseFee: 560000, bonus: 7200, globalEligible: true },
  { brand: 'British Airways', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 420000, bonus: 5600, globalEligible: true },
  { brand: 'Etihad Airways', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 480000, bonus: 6400, globalEligible: true },
  { brand: 'Korean Air', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 390000, bonus: 5200, globalEligible: true },
  { brand: 'Cathay Pacific', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 380000, bonus: 5100, globalEligible: true },
  { brand: 'Swiss International Air Lines', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 300000, bonus: 4100, globalEligible: false },
  { brand: 'Qantas', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 360000, bonus: 4900, globalEligible: true },
  { brand: 'Delta Air Lines', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 430000, bonus: 5800, globalEligible: true },
  { brand: 'United Airlines', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 415000, bonus: 5600, globalEligible: true },
  { brand: 'American Airlines', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 410000, bonus: 5500, globalEligible: true },
  { brand: 'LATAM Airlines', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 275000, bonus: 3800, globalEligible: true },
  { brand: 'Azul Linhas Aéreas', category: 'airlines', categories: ['airlines'], minStage: 'rookie', baseFee: 185000, bonus: 2900, globalEligible: false },
  { brand: 'TAP Air Portugal', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 245000, bonus: 3500, globalEligible: false },
  { brand: 'EVA Air', category: 'airlines', categories: ['airlines'], minStage: 'rising', baseFee: 260000, bonus: 3600, globalEligible: false },
  { brand: 'Virgin Atlantic', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 350000, bonus: 4700, globalEligible: false },
  { brand: 'Saudia', category: 'airlines', categories: ['airlines'], minStage: 'established', baseFee: 450000, bonus: 6000, globalEligible: true },

  // 14. Hospitality (separated from airlines)
  { brand: 'Marriott Bonvoy', category: 'hospitality', categories: ['hospitality'], minStage: 'established', baseFee: 340000, bonus: 4600, globalEligible: true },
  { brand: 'Hilton', category: 'hospitality', categories: ['hospitality'], minStage: 'rising', baseFee: 290000, bonus: 4000, globalEligible: true },
  { brand: 'Four Seasons', category: 'hospitality', categories: ['hospitality'], minStage: 'superstar', baseFee: 480000, bonus: 6400, globalEligible: true },
  { brand: 'Accor / Fairmont', category: 'hospitality', categories: ['hospitality'], minStage: 'rising', baseFee: 260000, bonus: 3600, globalEligible: true },
  { brand: 'Mandarin Oriental', category: 'hospitality', categories: ['hospitality'], minStage: 'superstar', baseFee: 450000, bonus: 6000, globalEligible: false },
  { brand: 'Ritz-Carlton', category: 'hospitality', categories: ['hospitality'], minStage: 'superstar', baseFee: 460000, bonus: 6100, globalEligible: false },
  { brand: 'Hyatt', category: 'hospitality', categories: ['hospitality'], minStage: 'rising', baseFee: 240000, bonus: 3400, globalEligible: false },
  { brand: 'Rosewood', category: 'hospitality', categories: ['hospitality'], minStage: 'established', baseFee: 330000, bonus: 4500, globalEligible: false },

  // 15. House Appliances
  { brand: 'Bosch', category: 'appliances', categories: ['appliances'], minStage: 'rising', baseFee: 220000, bonus: 3200, globalEligible: true },
  { brand: 'LG', category: 'appliances', categories: ['appliances'], minStage: 'rising', baseFee: 250000, bonus: 3600, globalEligible: true },
  { brand: 'Samsung Home', category: 'appliances', categories: ['appliances', 'phones'], minStage: 'established', baseFee: 310000, bonus: 4400, globalEligible: true },
  { brand: 'Dyson', category: 'appliances', categories: ['appliances'], minStage: 'established', baseFee: 290000, bonus: 4100, globalEligible: true },
  { brand: 'Philips', category: 'appliances', categories: ['appliances'], minStage: 'rookie', baseFee: 165000, bonus: 2600, globalEligible: true },
  { brand: 'Siemens', category: 'appliances', categories: ['appliances'], minStage: 'rising', baseFee: 215000, bonus: 3100, globalEligible: false },
  { brand: 'Miele', category: 'appliances', categories: ['appliances'], minStage: 'established', baseFee: 240000, bonus: 3400, globalEligible: false },
  { brand: 'Whirlpool', category: 'appliances', categories: ['appliances'], minStage: 'rookie', baseFee: 145000, bonus: 2200, globalEligible: false },
  { brand: 'Haier', category: 'appliances', categories: ['appliances'], minStage: 'rising', baseFee: 210000, bonus: 3000, globalEligible: true },
  { brand: 'Electrolux', category: 'appliances', categories: ['appliances'], minStage: 'rookie', baseFee: 150000, bonus: 2300, globalEligible: false },

  // 16. Grooming & Personal Care
  { brand: 'Gillette', category: 'grooming', categories: ['grooming'], minStage: 'rookie', baseFee: 175000, bonus: 2900, globalEligible: true },
  { brand: 'Clear', category: 'grooming', categories: ['grooming'], minStage: 'rising', baseFee: 210000, bonus: 3300, globalEligible: true },
  { brand: 'Head & Shoulders', category: 'grooming', categories: ['grooming'], minStage: 'rising', baseFee: 195000, bonus: 3100, globalEligible: true },
  { brand: 'Dior Sauvage', category: 'grooming', categories: ['grooming', 'fashion'], minStage: 'established', baseFee: 430000, bonus: 5800, globalEligible: true },
  { brand: 'Nivea Men', category: 'grooming', categories: ['grooming'], minStage: 'rookie', baseFee: 160000, bonus: 2600, globalEligible: true },
  { brand: 'Braun', category: 'grooming', categories: ['grooming'], minStage: 'rookie', baseFee: 145000, bonus: 2400, globalEligible: false },
  { brand: 'Paco Rabanne', category: 'grooming', categories: ['grooming'], minStage: 'established', baseFee: 320000, bonus: 4400, globalEligible: true },
  { brand: 'Chanel Bleu', category: 'grooming', categories: ['grooming'], minStage: 'superstar', baseFee: 460000, bonus: 6200, globalEligible: true },
  { brand: 'Dove Men+Care', category: 'grooming', categories: ['grooming'], minStage: 'rookie', baseFee: 135000, bonus: 2200, globalEligible: false },
  { brand: 'Adidas Body Care', category: 'grooming', categories: ['grooming', 'boots', 'apparel'], minStage: 'rookie', baseFee: 150000, bonus: 2500, globalEligible: true },

  // 17. Finance & Banking
  { brand: 'Visa', category: 'finance', categories: ['finance'], minStage: 'established', baseFee: 410000, bonus: 5500, globalEligible: true },
  { brand: 'Mastercard', category: 'finance', categories: ['finance'], minStage: 'established', baseFee: 420000, bonus: 5600, globalEligible: true },
  { brand: 'American Express', category: 'finance', categories: ['finance'], minStage: 'superstar', baseFee: 490000, bonus: 6500, globalEligible: true },
  { brand: 'Santander', category: 'finance', categories: ['finance'], minStage: 'rising', baseFee: 280000, bonus: 4000, globalEligible: true },
  { brand: 'Revolut', category: 'finance', categories: ['finance'], minStage: 'rookie', baseFee: 190000, bonus: 3000, globalEligible: true },
  { brand: 'HSBC', category: 'finance', categories: ['finance'], minStage: 'established', baseFee: 350000, bonus: 4700, globalEligible: true },
  { brand: 'Nubank', category: 'finance', categories: ['finance'], minStage: 'rising', baseFee: 250000, bonus: 3700, globalEligible: false },
  { brand: 'Itaú', category: 'finance', categories: ['finance'], minStage: 'rising', baseFee: 240000, bonus: 3600, globalEligible: false },

  // 18. Betting (subject to isBettingAllowed)
  { brand: 'Bet365', category: 'betting', categories: ['betting'], minStage: 'rising', baseFee: 360000, bonus: 5000, globalEligible: true },
  { brand: 'Betano', category: 'betting', categories: ['betting'], minStage: 'rookie', baseFee: 290000, bonus: 4200, globalEligible: true },
  { brand: 'Superbet', category: 'betting', categories: ['betting'], minStage: 'rookie', baseFee: 270000, bonus: 4000, globalEligible: false },
  { brand: 'Stake', category: 'betting', categories: ['betting'], minStage: 'rising', baseFee: 380000, bonus: 5200, globalEligible: true },
  { brand: 'Betway', category: 'betting', categories: ['betting'], minStage: 'rookie', baseFee: 250000, bonus: 3700, globalEligible: true },
  { brand: 'Sportingbet', category: 'betting', categories: ['betting'], minStage: 'rookie', baseFee: 220000, bonus: 3300, globalEligible: false },
  { brand: 'Betfair', category: 'betting', categories: ['betting'], minStage: 'rising', baseFee: 310000, bonus: 4500, globalEligible: false },
  { brand: 'Codere', category: 'betting', categories: ['betting'], minStage: 'rookie', baseFee: 210000, bonus: 3100, globalEligible: false },

  // 19. Media & Audio (multi-brand allowed)
  { brand: 'Beats by Dre', category: 'media', categories: ['media'], minStage: 'rising', baseFee: 260000, bonus: 3800, globalEligible: true },
  { brand: 'Spotify', category: 'media', categories: ['media'], minStage: 'established', baseFee: 340000, bonus: 4800, globalEligible: true },
  { brand: 'Netflix', category: 'media', categories: ['media'], minStage: 'established', baseFee: 380000, bonus: 5200, globalEligible: true },
  { brand: 'DAZN', category: 'media', categories: ['media'], minStage: 'rising', baseFee: 240000, bonus: 3500, globalEligible: true },
  { brand: 'Sony Audio', category: 'media', categories: ['media'], minStage: 'rookie', baseFee: 165000, bonus: 2600, globalEligible: true },
  { brand: 'Bose', category: 'media', categories: ['media'], minStage: 'rising', baseFee: 195000, bonus: 3000, globalEligible: false },
  { brand: 'Amazon Prime Video', category: 'media', categories: ['media'], minStage: 'established', baseFee: 350000, bonus: 4900, globalEligible: true },

  // 20. Lifestyle & Luxury Accessories (multi-brand allowed)
  { brand: 'Rimowa', category: 'lifestyle', categories: ['lifestyle'], minStage: 'established', baseFee: 280000, bonus: 4000, globalEligible: true },
  { brand: 'Bang & Olufsen', category: 'lifestyle', categories: ['lifestyle'], minStage: 'established', baseFee: 250000, bonus: 3600, globalEligible: true },
  { brand: 'Technogym', category: 'lifestyle', categories: ['lifestyle'], minStage: 'rising', baseFee: 210000, bonus: 3200, globalEligible: true },
  { brand: 'Nespresso', category: 'lifestyle', categories: ['lifestyle'], minStage: 'established', baseFee: 270000, bonus: 3900, globalEligible: true },
  { brand: 'Tumi', category: 'lifestyle', categories: ['lifestyle'], minStage: 'rising', baseFee: 190000, bonus: 2900, globalEligible: false },
  { brand: 'Montblanc', category: 'lifestyle', categories: ['lifestyle'], minStage: 'superstar', baseFee: 330000, bonus: 4500, globalEligible: true },
];

const ONE_TIME_DEALS = [
  { id: 'videogame_cover', category: 'gaming', defaultBrand: 'EA Sports', fee: 180000, mediaBoost: 8, fanBoost: 6, followerBoost: 0.03, minStage: 'established', durationDays: 1 },
  { id: 'magazine_shoot', category: 'fashion', defaultBrand: 'GQ / Sports Style', fee: 75000, mediaBoost: 6, fanBoost: 3, followerBoost: 0.015, minStage: 'rising', durationDays: 1 },
  { id: 'tv_commercial', category: 'media', defaultBrand: 'Prime Commercial', fee: 95000, mediaBoost: 5, fanBoost: 4, followerBoost: 0.02, minStage: 'rising', durationDays: 1 },
  { id: 'tournament_promo', category: 'airlines', defaultBrand: 'Tournament Global Spot', fee: 120000, mediaBoost: 6, fanBoost: 5, followerBoost: 0.02, minStage: 'established', durationDays: 1 },
  { id: 'podcast_feature', category: 'media', defaultBrand: 'Matchday Inside Podcast', fee: 35000, mediaBoost: 5, fanBoost: 4, followerBoost: 0.01, minStage: 'rookie', durationDays: 1 },
  { id: 'store_launch', category: 'lifestyle', defaultBrand: 'Flagship Concept Opening', fee: 55000, mediaBoost: 4, fanBoost: 3, followerBoost: 0.01, minStage: 'rookie', durationDays: 1 },
  { id: 'charity_match', category: 'health', defaultBrand: 'All-Star Benefit Kickoff', fee: 45000, mediaBoost: 6, fanBoost: 8, followerBoost: 0.02, minStage: 'rising', durationDays: 1 },
  { id: 'limited_capsule', category: 'eyewear', defaultBrand: 'Signature Capsule Drop', fee: 85000, mediaBoost: 5, fanBoost: 4, followerBoost: 0.015, minStage: 'rising', durationDays: 1 },
];

const LEAGUE_COUNTRY_RULES = [
  { re: /premier league|efl|championship|league one|league two|fa cup|carabao|community shield|scottish|premiership/i, country: 'United Kingdom', bettingAllowed: false },
  { re: /serie [abc]|coppa italia|supercoppa italiana/i, country: 'Italy', bettingAllowed: false },
  { re: /laliga|la liga|segunda|copa del rey/i, country: 'Spain', bettingAllowed: false },
  { re: /ligue [12]|coupe de france|troph[eé]e des champions/i, country: 'France', bettingAllowed: false },
  { re: /bundesliga|dfb[- ]?pokal/i, country: 'Germany', bettingAllowed: false },
  { re: /eredivisie|eerste divisie|knvb/i, country: 'Netherlands', bettingAllowed: false },
  { re: /jupiler|pro league|croky|belg/i, country: 'Belgium', bettingAllowed: false },
  { re: /saudi|roshn|king'?s cup/i, country: 'Saudi Arabia', bettingAllowed: false },
  { re: /qatar|uae|adnoc|s[uü]per lig|turkey|j\.?\s?league|j1|k[- ]?league|chinese super league|indonesia|malaysia/i, country: 'Restricted Jurisdiction', bettingAllowed: false },
  { re: /brasileir|s[eé]rie [ab] brasil|copa do brasil|paulista|carioca/i, country: 'Brazil', bettingAllowed: true },
  { re: /liga portugal|liga nos|ta[çc]a de portugal|primeira liga/i, country: 'Portugal', bettingAllowed: true },
  { re: /liga profesional|copa argentina|primera divisi[oó]n/i, country: 'Argentina', bettingAllowed: true },
  { re: /\bmls\b|us open cup|liga mx/i, country: 'North America', bettingAllowed: true },
];

const LEAGUE_ID_COUNTRIES = {
  0x11: { country: 'United Kingdom', bettingAllowed: false },
  0x12: { country: 'Italy', bettingAllowed: false },
  0x13: { country: 'Spain', bettingAllowed: false },
  0x14: { country: 'France', bettingAllowed: false },
  0x32: { country: 'Germany', bettingAllowed: false },
  0x15: { country: 'Netherlands', bettingAllowed: false },
  0x16: { country: 'Portugal', bettingAllowed: true },
};

function isBettingAllowed(snapshot) {
  const lid = snapshot?.league?.id;
  const lname = String(snapshot?.league?.name || '');
  const cname = String(snapshot?.club?.name || '');
  const text = `${lname} ${cname}`;
  for (const rule of LEAGUE_COUNTRY_RULES) {
    if (rule.re.test(text)) {
      return {
        allowed: rule.bettingAllowed,
        country: rule.country,
        reason: rule.bettingAllowed ? '' : `Betting sponsorships restricted by ${rule.country} league regulations.`,
      };
    }
  }
  if (lid !== undefined && LEAGUE_ID_COUNTRIES[lid]) {
    const info = LEAGUE_ID_COUNTRIES[lid];
    return {
      allowed: info.bettingAllowed,
      country: info.country,
      reason: info.bettingAllowed ? '' : `Betting sponsorships restricted by ${info.country} league regulations.`,
    };
  }
  return { allowed: true, country: lname || 'International', reason: '' };
}

function generateLocalSponsors(state, snapshot) {
  const club = String(snapshot?.club?.name || '').trim();
  const hometown = String(state?.persona?.roots?.hometown || '').trim();
  const place = hometown || club || 'Hometown';
  const clubCity = club ? club.replace(/\b(FC|CF|AC|AS|SC|CD|CA|SS|SSC|Olympique|Real|Atl[eé]tico|Sporting|United|City|Town|Rovers)\b/gi, '').replace(/\s+/g, ' ').trim() : '';
  const cityLabel = clubCity && clubCity.length >= 3 ? clubCity : place;
  return [
    { brand: `${place} Sports Clinic`, category: 'local', categories: ['local', 'health'], minStage: 'rookie', baseFee: 32000, bonus: 750, globalEligible: false, localOrigin: place },
    { brand: `Café ${place}`, category: 'local', categories: ['local', 'healthy_beverage'], minStage: 'rookie', baseFee: 28000, bonus: 600, globalEligible: false, localOrigin: place },
    { brand: `${cityLabel} Auto Dealers`, category: 'local', categories: ['local'], minStage: 'rookie', baseFee: 45000, bonus: 900, globalEligible: false, localOrigin: cityLabel },
    { brand: `${place} Fiber Net`, category: 'local', categories: ['local'], minStage: 'rookie', baseFee: 38000, bonus: 800, globalEligible: false, localOrigin: place },
    { brand: `${cityLabel} Heritage Bakery`, category: 'local', categories: ['local'], minStage: 'rookie', baseFee: 24000, bonus: 500, globalEligible: false, localOrigin: cityLabel },
    { brand: `${place} Credit Union`, category: 'local', categories: ['local'], minStage: 'rookie', baseFee: 42000, bonus: 850, globalEligible: false, localOrigin: place },
  ];
}

function findCatalogBrand(brandName) {
  const low = String(brandName || '').trim().toLowerCase();
  if (!low) return null;
  return BRAND_CATALOG.find((b) => b.brand.toLowerCase() === low || low.startsWith(`${b.brand.toLowerCase()} `) || low === b.brand.toLowerCase().replace(/\s+football$/i, '')) || null;
}

function brandsForCategory(category, { state = null, snapshot = null, stage = null } = {}) {
  const cat = canonicalCategory(category);
  const stageOrder = { rookie: 0, rising: 1, established: 2, superstar: 3 };
  const sRank = stage && stageOrder[stage] !== undefined ? stageOrder[stage] : 3;
  if (cat === 'local') return generateLocalSponsors(state, snapshot);
  const direct = BRAND_CATALOG.filter((b) => {
    const matchCat = b.category === cat || (Array.isArray(b.categories) && b.categories.includes(cat));
    if (!matchCat) return false;
    return !stage || (stageOrder[b.minStage] ?? 0) <= sRank;
  });
  return direct;
}

const SPORTS_GEAR_PAIR = new Set(['boots', 'apparel']);

function findSponsorConflicts(activeSponsors = [], incoming = {}, { ignoreId = null } = {}) {
  const inBrand = String(incoming?.brand || '').trim().toLowerCase();
  const inCats = (Array.isArray(incoming?.categories) && incoming.categories.length ? incoming.categories : [incoming?.category])
    .map(canonicalCategory)
    .filter(Boolean);
  const inExcl = inCats.filter((c) => EXCLUSIVE_CATEGORIES.includes(c));
  const inHasGear = inCats.some((c) => SPORTS_GEAR_PAIR.has(c));

  const conflicts = [];
  for (const sp of activeSponsors || []) {
    if (!sp || !sp.brand) continue;
    if (ignoreId && sp.id === ignoreId) continue;
    const spBrand = String(sp.brand || '').trim().toLowerCase();
    if (inBrand && spBrand === inBrand) continue; // same brand expanding bundle / upgrading Global Partner never conflicts

    const spCats = (Array.isArray(sp.categories) && sp.categories.length ? sp.categories : [sp.category])
      .map(canonicalCategory)
      .filter(Boolean);
    const sharedExcl = inExcl.filter((c) => spCats.includes(c));
    const spHasGear = spCats.some((c) => SPORTS_GEAR_PAIR.has(c));
    const gearClash = inHasGear && spHasGear;

    if (sharedExcl.length || gearClash) {
      conflicts.push({
        sponsor: sp,
        categories: sharedExcl.length ? sharedExcl : ['boots', 'apparel'],
      });
    }
  }
  return conflicts;
}

function catalogForUi(state = null, snapshot = null) {
  const byCategory = {};
  for (const cat of SPONSOR_CATEGORIES) {
    byCategory[cat] = brandsForCategory(cat, { state, snapshot }).map((b) => ({
      brand: b.brand,
      category: b.category,
      categories: b.categories,
      minStage: b.minStage,
      baseFee: b.baseFee,
      bonus: b.bonus,
      globalEligible: Boolean(b.globalEligible),
      umbrellaNote: b.umbrellaNote || '',
      localOrigin: b.localOrigin || '',
    }));
  }
  return {
    categories: SPONSOR_CATEGORIES,
    exclusiveCategories: EXCLUSIVE_CATEGORIES,
    multiBrandCategories: MULTI_BRAND_CATEGORIES,
    meta: CATEGORY_META,
    betting: isBettingAllowed(snapshot),
    byCategory,
    oneTimeDeals: ONE_TIME_DEALS,
  };
}

module.exports = {
  EXCLUSIVE_CATEGORIES,
  MULTI_BRAND_CATEGORIES,
  SPONSOR_CATEGORIES,
  CATEGORY_ALIASES,
  CATEGORY_META,
  BRAND_CATALOG,
  ONE_TIME_DEALS,
  canonicalCategory,
  isBettingAllowed,
  generateLocalSponsors,
  findCatalogBrand,
  brandsForCategory,
  findSponsorConflicts,
  catalogForUi,
};
