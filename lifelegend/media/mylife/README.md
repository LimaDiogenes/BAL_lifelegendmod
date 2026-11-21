# My Life — Complete Custom Image Generation & Drop-In Guide

You can customize every illustration in **My Life** simply by dropping `.png`, `.jpg`, or `.webp` files into:
`lifelegend/media/mylife/`

The app scans `lifelegend/media/mylife/` automatically on startup — no manual upload required. You can also override any individual asset or sponsor per-career using the `📷` camera button inside the app.

## Priority Order (How the App Resolves Each Image)
1. **Per-Career In-App Upload (`📷` button):** `%APPDATA%\LiveTweet\data\careers\<careerId>\life-media\`
2. **Exact ID Drop-In (`lifelegend/media/mylife/<id>.png|.jpg|.webp`):** Matches the exact item ID below (e.g., `luxury_villa.png`, `recovery.png`, `watch_lux.png`).
3. **Custom Name Slug Drop-In (`lifelegend/media/mylife/<name_slug>.png`):** For custom assets or custom sponsor brands you type in yourself, the app slugifies the name (lowercase, spaces/symbols replaced by `_`).
   - Example: A custom asset named `"Custom Chopper Bike"` automatically loads `custom_chopper_bike.png`!
   - Example: A custom asset named `"Nissan Elgrand"` automatically loads `nissan_elgrand.png`!
   - Example: A sponsor named `"Rolex"` or `"Konami"` automatically loads `rolex.png` or `konami.png`!
4. **Category Fallback Drop-In (`cat_<category>.png` or `sponsor_<category>.png`):** Used for any item in that category that doesn't have a specific file.
5. **Built-In Editorial SVG / Monogram:** Clean vector fallback if no image file is present.

---

## 1. Hero Banner (1 image — `16:5` or `16:9` widescreen, recommended `1600×500` or `1280×720`)

| Filename | Where it appears | Suggested Generation Prompt |
| :--- | :--- | :--- |
| `hero.png` | Top banner of **My Life** | *Cinematic wide-angle view of an elite floodlit European football stadium at dusk, tunnel and pitch glow, dramatic atmosphere, editorial sports photography, no text, 16:9* |

---

## 2. Built-In Lifestyle & Assets Catalog (16 images — `16:9` landscape, recommended `960×540` or `1280×720`)
*Shown in **My Life › Lifestyle & Net Worth**, in the **Dashboard** showcase strip, and in purchase scene modals.*

| Filename | Category | In-App Name (EN) | Suggested Generation Prompt |
| :--- | :--- | :--- | :--- |
| `rented_studio.png` | Housing (`home`) | Rented studio | *Cozy modern studio apartment near a football training ground, warm evening lamp light, gym bag and football boots by the sofa, realistic interior photography, 16:9* |
| `city_apartment.png` | Housing (`home`) | City apartment | *Sleek contemporary city-center apartment living room with floor-to-ceiling windows overlooking European city lights at dusk, minimalist luxury, 16:9* |
| `penthouse.png` | Housing (`home`) | Panoramic penthouse | *Ultra-luxury duplex penthouse terrace at night overlooking a metropolitan skyline, glass balustrade, warm architectural lighting, 16:9* |
| `luxury_villa.png` | Housing (`home`) | Luxury villa | *Modern architectural footballer's gated hillside villa at twilight with illuminated infinity pool, private gym glass wall, palm and cypress trees, 16:9* |
| `sport_coupe.png` | Vehicles (`car`) | Sport coupe | *Sleek metallic dark-blue two-door sports coupe parked in a private training ground car park at golden hour, dynamic three-quarter angle, automotive photography, 16:9* |
| `luxury_gt.png` | Vehicles (`car`) | Luxury GT | *Bespoke matte-silver luxury grand tourer coupe parked outside an upscale hotel portico at dusk, glowing headlights, wet asphalt reflections, 16:9* |
| `exotic_supercar.png` | Vehicles (`car`) | Exotic supercar | *Low-slung carbon and crimson V12 mid-engine supercar under moody garage rim lighting, scissor doors, dramatic reflections, 16:9* |
| `personal_chef.png` | Private Staff (`staff`) | Private nutritionist chef | *Private athlete nutrition chef plating a vibrant high-protein recovery meal in a modern dark-marble kitchen, warm editorial food photography, 16:9* |
| `personal_physio.png` | Private Staff (`staff`) | Private physio / trainer | *Private home athlete recovery room with sports massage table, cryotherapy compression boots, and warm indirect lighting, 16:9* |
| `pr_manager.png` | Private Staff (`staff`) | Image & PR manager | *High-end media agency war room with press clippings, tablet dashboards, and studio microphones prepared for a pro football star, 16:9* |
| `social_team.png` | Private Staff (`staff`) | Social media team | *Creative content studio with cinema cameras, dual editing monitors showing football highlights, framed match shirts, and subtle RGB key lights, 16:9* |
| `youth_academy_fund.png` | Investments (`investment`) | Youth & pitches fund | *Brand-new floodlit community 5-a-side artificial turf football cage pitch in an urban neighborhood at sunset, warm inviting glow, 16:9* |
| `brand_portfolio.png` | Investments (`investment`) | Brand & equity portfolio | *Executive glass boardroom table overlooking a financial district at dusk, lifestyle brand lookbooks, equity charts on a tablet, espresso cup, 16:9* |
| `real_estate_fund.png` | Investments (`investment`) | Real estate fund | *Modern glass-and-steel commercial high-rise towers and architectural scale model in a European business district at golden hour, 16:9* |
| `local_clinic_gift.png` | Charity (`charity`) | Local hospital donation | *Bright, modern pediatric rehabilitation wing in a community hospital with warm wood accents and a framed signed football shirt on the wall, 16:9* |
| `foundation_launch.png` | Charity (`charity`) | Youth foundation | *Elegant charity gala stage and community youth academy crest banner celebrating a footballer's charitable foundation launch, warm spotlights, 16:9* |

---

## 3. Off-Pitch / Days-Off Actions (8 images — `16:9` landscape `960×540` or `1:1` square `512×512`)
*Shown on action buttons in **My Life › Dashboard** and as the hero stage image when the action's narrative scene modal opens.*

| Filename | Action Name (EN) | Suggested Generation Prompt |
| :--- | :--- | :--- |
| `recovery.png` | Recovery & Cryo | *Elite athlete cryotherapy chamber and hydrotherapy recovery pool with cool blue and warm spa ambient lighting, 16:9* |
| `extra_training.png` | Extra Pitch Session | *Footballer practicing free kicks over a mannequin wall alone on a misty floodlit training pitch after sunset, bag of footballs on wet grass, 16:9* |
| `team_dinner.png` | Team Dinner | *Private long table at an upscale moody restaurant reserved for a football squad dinner, warm pendant lighting and camaraderie atmosphere, 16:9* |
| `inner_circle.png` | Family & Inner Circle Time | *Warm private terrace dinner evening with family and close friends overlooking city lights, string lights, cozy home atmosphere, 16:9* |
| `sponsor_shoot.png` | Commercial Shoot | *Professional commercial photography studio set with softboxes, atmospheric haze, and cinema camera aimed at a footballer's mark, 16:9* |
| `charity_visit.png` | Community Charity Visit | *Community youth center football court with gift boxes, signed footballs, and warm daylight, editorial documentary photography, 16:9* |
| `media_feature.png` | Long-Form Media Feature | *Editorial magazine interview setup in a leather armchair with a studio microphone, moody key light, and rain-streaked city window, 16:9* |
| `vip_night.png` | VIP Night Out | *Exclusive velvet-rope VIP rooftop lounge at night overlooking city skyline, ambient purple and gold club lighting, 16:9* |

---

## 4. Interactive Dilemma Scene Cards (8 images — `16:9` landscape, recommended `960×540`)
*Shown in the narrative scene modal and recent activity log after resolving a dilemma.*

| Filename | Dilemma Situation | Suggested Generation Prompt |
| :--- | :--- | :--- |
| `late_party.png` | Post-Win Nightclub Invite | *Neon-lit upscale nightclub VIP entrance late at night with wet pavement reflections outside, moody cinematic shot, 16:9* |
| `tabloid_deal.png` | Glossy Magazine Cover Offer | *Flashy celebrity lifestyle magazine studio set with bright ring lights, cameras, and luxury wardrobe rack, 16:9* |
| `youth_club_plea.png` | Boyhood Club in Trouble | *Worn-down grassroots youth football pitch with peeling goalpost paint and muddy touchline under dramatic evening clouds, 16:9* |
| `teammate_vent.png` | Dressing-Room Friction | *Quiet pro football locker room after training, jerseys hanging in wooden cubbies, tactical board in soft dramatic lighting, 16:9* |
| `edgy_campaign.png` | Bold Global Ad Campaign | *Giant illuminated high-contrast athlete billboard in a busy European city square at night, wet street reflections, 16:9* |
| `training_gate.png` | Crowd at the Training Gate | *Dozens of young football supporters holding shirts and pens outside a training ground gate in the rain at dusk, 16:9* |
| `agent_leak.png` | Transfer Rumor Storm | *Football agent's smartphone glowing with breaking transfer notifications on a dark walnut desk beside contract folders, 16:9* |
| `docu_crew.png` | Documentary Crew Request | *Cinema camera on a gimbal rig following a footballer down a stadium tunnel towards the pitch floodlights, documentary style, 16:9* |

---

## 5. Sponsor Presets & Sponsor Category Logos (Square `1:1` — recommended `400×400` or `512×512`)
*Shown in the sponsor medallion badge on **My Life › Sponsors** cards.*

### 5A. Specific Sponsor Presets (or Custom Brand Names)
| Filename | Default Brand | Category | Suggested Generation Prompt |
| :--- | :--- | :--- | :--- |
| `boots_pro.png` | Nike Football | Boots / Apparel | *Minimalist gold-and-crimson pro football boot crest emblem on a dark carbon background, vector luxury sports badge, 1:1* |
| `apparel_ath.png` | Adidas Originals | Apparel / Boots | *Minimalist royal-blue and silver athletic streetwear monogram crest on a dark background, clean vector emblem, 1:1* |
| `puma_pack.png` | Puma Sport | Boots / Apparel | *Sleek predatory cat silhouette sports emblem in brushed silver on dark slate background, clean vector badge, 1:1* |
| `beverage_fuel.png` | Gatorade Fuel | Beverage / Health | *Dynamic electric-emerald and orange sports hydration lightning emblem on dark background, clean vector badge, 1:1* |
| `auto_drive.png` | Porsche Motorsport | Automotive / Lifestyle | *Prestigious metallic gold and racing-red motorsport shield crest on dark brushed steel background, 1:1* |
| `watch_lux.png` | TAG Heuer Chrono | Watches / Lifestyle | *Swiss haute horlogerierose-gold Tourbillon watch gear crest on deep obsidian background, luxury emblem, 1:1* |
| `tech_game.png` | EA / HyperStrike Gaming | Tech / Media | *Futuristic neon-teal and silver esports football controller crest on dark background, sleek gaming emblem, 1:1* |
| `global_air.png` | Emirates Fly | Travel / Global | *Luxury gold calligraphic wing emblem on a rich burgundy and dark navy background, flagship airline crest, 1:1* |

*(Tip: If you create a custom sponsor named `Konami`, dropping `konami.png` into `lifelegend/media/mylife/` will automatically match it!)*

### 5B. Sponsor Category Fallbacks (Optional — used for any sponsor in that category without a brand-specific file)
| Filename | Category Covered |
| :--- | :--- |
| `sponsor_boots.png` | Technical Boot Deals (`boots`) |
| `sponsor_apparel.png` | Sportswear & Apparel (`apparel`) |
| `sponsor_beverage.png` | Sports Drinks & Hydration (`beverage`) |
| `sponsor_automotive.png` | Automotive & Supercars (`automotive`) |
| `sponsor_watches.png` | Luxury Watches (`watches`) |
| `sponsor_lifestyle.png` | Fashion & Lifestyle (`lifestyle`) |
| `sponsor_tech.png` | Gaming, Audio & Tech (`tech`) |
| `sponsor_travel.png` | Airlines & Luxury Travel (`travel`) |
| `sponsor_finance.png` | Banking, FinTech & Crypto (`finance`) |
| `sponsor_grooming.png` | Fragrance & Grooming (`grooming`) |
| `sponsor_media.png` | Broadcast & Streaming (`media`) |
| `sponsor_health.png` | Fitness & Recovery (`health`) |
| `sponsor_global.png` | Global Flagship Ambassador (`global`) |

---

## 6. Asset Category Fallbacks & Custom Assets (Optional — `16:9` landscape `960×540`)
If you buy custom assets in **Lifestyle & Net Worth › Buy a custom asset**, you can either:
1. Name the file after your custom item in snake_case (e.g. `custom_chopper_bike.png`, `nissan_elgrand.png`, `private_jet.png`, `superyacht.png`), **OR**
2. Drop category fallback images so any custom asset in that category gets a rich photo instead of an SVG:

| Filename | Used as fallback for any custom asset in category... |
| :--- | :--- |
| `cat_home.png` | Housing / Real Estate (`home`) |
| `cat_car.png` | Vehicles / Garage (`car`) |
| `cat_staff.png` | Private Staff / Entourage (`staff`) |
| `cat_investment.png` | Business & Investments (`investment`) |
| `cat_charity.png` | Charity & Foundations (`charity`) |
| `cat_custom.png` | Custom / Other (`custom`) |
