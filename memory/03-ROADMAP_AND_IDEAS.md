# Roadmap, Owner Ideas & Integration Notes (`BAL_lifelegendmod`)

## 1. Upstream `1.1.0` Features Already Present (Do Not Duplicate)
**Verified** in `CHANGELOG.md` and `src/` at `3686e1b`:
- Dynamic save table discovery (`src/save/layout.js`) for Lua-expanded saves (FL Mod Studio, GigaPack) — read-only safe guard.
- PNG card export to clipboard/file ("Partager en image" via `share:image` / `share:save`).
- Scoreline player comparator.
- Seasonal Rival (`rival.js`), Derbies (`derby.js`), Former-Club Reunions (`reunion.js`), Club POTM Fan Vote (`fanVote.js`), Fan Chant (`chant.js`), Exclusive Interview (`interview.js`).
- Quota-resilient fallback sync ("synchro de secours") saving non-AI progress when daily quota runs out.
- 43 automated unit tests (`npm test`) and portable Windows build script (`npm run dist`).

---

## 2. Owner's 12 Improvement Ideas (Tracked Scope)

1. **English-Based Core + More Translations:**
   - Currently French is the base key language in `src/store.js` (`language: 'fr'`), `lifelegend/app.js`, `src/i18n.js`, and error strings; `prompts.js` is mostly English with French examples/data cues.
   - Goal: make English (`en`) the default/base language, migrate prompts/cues cleanly, and make adding new translations easy.
2. **UI Improvements:**
   - Pure HTML/CSS/vanilla JS in `lifelegend/` (zero build step). Clean up UX, layouts, onboarding, and readability.
3. **Country-Specific Newspapers (`La Transversale` -> Regional Dailies):**
   - Map `snapshot.league.id` / country to a distinct national sports daily masthead, editorial tone, and writer desk per country (England, Spain, Italy, Germany, France, Brazil, Argentina, Portugal, Netherlands, etc.) while still covering world football.
4. **AI Usage & Token Efficiency:**
   - Optimize `FACTS` payload size, avoid sending unused fields, gate `factCheck` AI call behind deterministic pre-checks (e.g., `paperRules.js` / regex number-name verification), and consider structured output schemas (`responseSchema`) where supported.
5. **Privacy via Local Decoy Aliases / Variables:**
   - Never leak personal user identifiers (real player name, family/bio names, hometown, handles) to external AI APIs.
   - Preferred design: deterministic local alias substitution (swap personal names/places with language-appropriate decoy names before calling AI, then reverse-substitute back locally in the parsed result) so grammar/gender stays natural across all languages.
6. **Expanded AI Model & Free/Open-Source API Support:**
   - Add presets in `src/ai/providers.js` for local zero-key endpoints (Ollama, LM Studio) and additional free-tier/open-weight OpenAI-compatible providers (Mistral, Cerebras, SambaNova, GitHub Models, DeepSeek, etc.) + easy model refresh.
7. **Multi-Season Career History Reading (Beyond Current Season):**
   - `blReader.js` currently reads current-season matches + `readPlayerHistory` (first club, previous club, debuts) + `POTY_TABLE`.
   - Goal: research a real multi-season `BL00000000` save binary to locate PES/FL27's stored past-seasons stats & trophy history offsets so existing multi-year saves populate Panthéon/Scoreline completely on first sync.
8. **Game Image Imports & Optional Free Image Illustration:**
   - Extract stadium thumbnails (`common/render/thumbnail/stadium/...`) and additional game textures via `cpk.js` / `dds.js` to illustrate articles/posts, or optionally integrate free/local image generation.
9. **Richer Teammate & Squad Reading:**
   - Expand `gameDb.js` (`Player.bin` stride 312) to read overall rating, age, nationality, playing style, and merge with save roster/shirt numbers (`+0x2EA`) so unused bench teammates, position rivals, and captains are known to Vestiaire, tactical articles, and Influence.
10. **Custom Dates / Out-of-Football Life Events:**
    - Let the user schedule custom life events on specific in-game dates; inject them into `CHANGES` when `snapshot.gameDate` reaches those dates so press, fans, and teammates react.
11. **Seamless Auto-Read / Auto-Sync Flow:**
    - Enhance existing `setupAutoSync()` (optionally default-on, smoother non-blocking UX/notifications when the game writes `BL0000000*`).
12. **Auto-Load Latest Modified Save (Optional Toggle):**
    - Leverage `detectSaves()` (already sorted by `mtimeMs` descending) so LifeLegend can automatically watch and switch to whichever `BL0000000x` slot was saved most recently.

---

## 3. Integration with `pes2021-mod-studio`
- **Target repo:** `F:\_PES2021_STUDIO\pes2021-mod-studio` (C# / .NET 10 Avalonia MVVM; EN/ES/PT-BR).
- **Recommended integration (side-by-side packaging & launch):**
  - Package LifeLegend portable build inside a Mod Studio subfolder (or downloadable module) using `tools/build-portable.js`.
  - Add a Mod Studio launcher action that pre-populates `%APPDATA%\LiveTweet\data\settings.json` (and copies/registers `FL_key.bin` into `%APPDATA%\LiveTweet\data\keys/` if missing) with the game path, language, and active save path, then starts `LifeLegend.exe`.
  - Note: Check `update:check` URL in `main.js` before release so it points to `LimaDiogenes/BAL_lifelegendmod` instead of upstream `Saamz09/lifelegendmod`.
