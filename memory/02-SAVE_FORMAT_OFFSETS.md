# Save Format & Game DB Offsets (Verified in 1.1.0 Source)

All offsets below are **verified** directly in `src/save/*.js` of LifeLegend `1.1.0`. Do not guess offsets outside this list—verify against a real save binary before relying on new fields.

---

## 1. Save File Container (`pesCrypt.js`)
- **Encryption Header:** `320` bytes (`0x000..0x13F`):
  - `0x000..0x0FF` (256 B): Encrypted SHA-512 digests of `[desc, logo, data, serial]`.
  - `0x100..0x13F` (64 B): Random tail / seed (`parts.tail`).
- **File Header:** `208` bytes (`0x140..0x20F`):
  - `+64` (`u32`): `data` section size.
  - `+68` (`u32`): `logo` section size.
  - `+72` (`u32`): `desc` section size.
  - `+76` (`u32`): `serial` word count (`bytes = val * 2`).
  - `+144..+175`: `fileType` (`"BL"`, `"REPLAY"`, `"TEMBLEM"`, etc.).
  - `+176..+207`: `gameVersion`.
- **Master Keys:** PES 2021 key is embedded in `pesCrypt.js`; FL27 uses a separate 64-byte key (`FL_key.bin`, loaded from `%APPDATA%\LiveTweet\data\keys\`).

---

## 2. Standard vs. Dynamic Layout (`src/save/layout.js`)
In vanilla PES 2021 and standard Football Life 2026/2027, decrypted `data` uses fixed offsets (`STANDARD`). When Lua modules expand team/competition/match tables (e.g., FL Mod Studio, GigaPack), `layout.js` locates shifted tables automatically (`standard: false`), and **all save-write modules refuse to write** (`assertStandard()`).

| Table / Record | Standard Offset | Stride / Size | Dynamic Discovery (`detectLayout`) |
|---|---|---|---|
| Teams | `0x0` (team 0) | `0x690` (up to 4096) | Starts at `0x0` |
| Coaches | `0x133A38` | `0x258` | 40 consecutive records with `u32` slot `0, 1, 2...` at `name - 8` |
| Competitions | `0x1F1DFE` | `0x314` | 30+ consecutive records with printable name + `u16` id `< 0x1000` at `name - 2` |
| Matches | `0x329B08` (`13001` slots) | `0x254` | Longest run (`>= 50`) of records starting with valid LE date |
| Calendar | `0xA8D6CC` (365 days) | `0x2C4` (variable in expanded saves!) | Inferred from mercato event spacing (`types 3..8`), 365 days starting with `0xFFFFFFFF` |
| Player Record (`PLAYER_REC`) | `0xB7E2C4` | — | Searches UTF-8 `<playerName>\0` with plausible `u32` ID 8 bytes earlier |
| Career Start (`CAREER_START_REC`) | `0x10C0078` | — | Scans from `L.player` for `u32` player ID at `+0x1C` and valid date at `+4` |

*Relative offsets from `L.player` stay constant across expanded saves (**verified** in `blReader.js` and `training.js`).*

---

## 3. Detailed `BL00000000` Record Layouts (Verified)

### Team Block (base `k * 0x690`)
- `+0x50` (`u32`): `ref` (`id = ref >>> 14`, `slot = ref & 0x3FFF`)
- `+0x54` (`0x46` B): Team name (`utf8` cstr)
- `+0x9A` (`4` B): Short name
- `+0xA0` (`0x80` B): Stadium name
- `+0x19C` (`40 * 8` B): Roster pairs `[u32 internalSlot][u32 playerId]` (`0xFFFF` ends list)
- `+0x2E8` (`u16`): Custom `TEMBLEM` slot (`0xFFFF` = none)
- `+0x2EA` (`40 * u16`): Shirt numbers (parallel to roster)
- `+0x476` (`u8`): Roster player count
- `+0x4B0` & `+0x550`: Tactics A & B (3 phases of 33 bytes each `[11 roles][11 x,y pairs]` + 61 bytes settings)

### Coach Block (base `L.coach + slot * 0x258`, record starts at `name - 0x10`)
- `name - 8` (`u32`): Team `slot`
- `name` (`0x40` B): Coach name
- `rec + 0x48`, `+0xE8`, `+0x188`: 3 coach tactic phase blocks (`3 * 33` B each)

### Competition Block (`L.comp + n * 0x314`)
- `o - 2` (`u16`): Competition ID
- `o` (`0x46` B): Competition name
- `o + 0x7E` (`u16`): `emblemLc` logo ID

### Match Block (`L.match + i * 0x254`)
- `o - 4` (`u32`): Competition ID (`& 0xFFFF`) + Round (`(val >>> 16) & 0xFF`)
- `+0x00`: Date (`u16` year, `u8` month, `u8` day)
- `+0x08` (`u32`): Kickoff hour
- `+0x0C` (`u32`): Home `teamRef`; `+0x10` (`u32`): Away `teamRef`
- `+0x14` (`u8`): Home score; `+0x17` (`u8`): Away score
- `+0x1C`: Home lineup (`17 * 16` B), followed immediately by Away lineup (`17 * 16` B):
  - `+0` (`u32` slot), `+4` (`u32` playerId), `+8` (`u32` events: goals `bits 0-7`, assists `bits 8-15`), `+12` (`u32` packed: minutes `bits 0-6`, raw rating `bits 8-13`, pos `bits 14-17`, starter `bit 21`)

### Player Record (`P = L.player`, `PC = P + 0xFC`, i.e., `0xB7E3C0` in standard)
- `P + 0` (`u32`): Player ID; `P + 8` (`61` B): Player name
- `PC + 0x00` (`u32`): Current club `teamRef`; `PC + 0x04` (`u32`): National team `teamRef`
- `PC + 0x0C` (`4` B date): Contract end date; `PC + 0x30` (`u32`): Annual salary / 100 EUR
- `PC + 0x34` (`u32`): Previous club ref; `PC + 0x38` (`u32`): First club ref; `PC + 0x3C` (`4` B date): Joined current club
- `PC + 0x70`, `+0xA0` (`0x30` B stride): Debut records (`type` `0`=club / `2`=NT, `year`, `month`, `compId`, `teamRef`, `opponentRef`)

### Player Profile (`profileAt = P - 48`, length `376` B, `playerProfile.js`)
- `+0`: height (cm), `+1`: weight (kg), `+3` bit 7: strong foot (`1`=left), `+7` bits 4-7: position (`0..12`), `+28` bits 0-5: age, `+29` bits 3-7: playing style, `+28..`: skill bits (`code = 67..107`, bit `profileAt + 28 + (code >> 3)` bit `code & 7`), `abilities`: 25 packed 7-bit stats, `+318`: affection, `+327` bits 0-2: form arrow, `+328`: `unavailableDays` (injury/suspension), `+330` bit 1/2: transfer/loan listed, `+336` bits 0-4: team role, `+372` (`i32`): market value / 100 EUR.

### Training (`P + (0xC7DCEC - 0xB7E2C4)`, `training.js`)
- `17` bytes (`0x11`): `0..7` = 8 focus bars (`0..6`), `8` = skill points, `9` = position points, `10` = remaining points, `11` = total points, `12` = skill code (`67..107`, `108`=none), `16` = position code (`1..13`, `108`=none).

### Last Match Events, POTY, Messages, Offers
- **Last Match Events (`P + (0xBE6388 - 0xB7E2C4)`, span `0x2000`):** `matchKey` (`u32`), `year` (`u16`), then 40-byte goal records (`minute`, `type`, `scorerSlot/Id`, `assistSlot/Id`, `f32 distance`).
- **Player of the Year (`P + (0xBEE290 - 0xB7E2C4)`):** `6` slots of `0x17D8` bytes (`slotIndex`, `year`, 3 podium entries of 16 bytes `[?, playerId, teamRef, points]`).
- **BAL Messages (`influenceWrite.js` / `offerRedirect.js`):** `128` rows of `0x50` bytes (`~0xBE8B84` / `0xBE8BCC` in standard saves), located via empty-message pattern (`ARRIVAL = 35`, `DEPARTURE = 33`, `OFFER = 0x47`).
- **Offers / Negotiations / Interests / Deadlines (`blReader.js` / `offerRedirect.js`):** Located dynamically after `OFFER_MARKER` (`74 45 07 00` + 12 zero bytes):
  - Offers at `m + 0x10` (`40 * 0x30` B)
  - Club negotiations at `m + 0x14 + 0xD5B8` (`64 * 0x3C` B)
  - Interested clubs at `m + 0x14 + 0x56294` (`32..64 * 0x2C` B)
  - Offer deadlines at `m + 0x57F70` (`20 * 100` B)
  - Active offer club list at `0xC01638` (standard saves)

### Game DB Tables & Assets (`gameDb.js`, `emblems.js`, `faces.js`, `boots.js`)
- `common/etc/pesdb/Player.bin`: first record at `+8`, stride `312` B (`+0` `u32` id, `+46` bits 2-5 position, `+0xF3` `61` B name).
- `common/etc/pesdb/PlayerAssignment.bin`: stride `16` B (`+4` `u32` playerId, `+8` `u32` teamId).
- `common/etc/pesdb/Boots.bin`: stride `304` B (`+0` `u16` id, `+204` `100` B brand).
- `common/etc/pesdb/Coach.bin`: stride `100` B (`+0` `u32` id, `+8` `46` B name).
- `common/etc/pesdb/TacticsFormation.bin`: stride `12` B (`u32` tacticId, `u32` role, `u8` x, `u8` y, `u8` slot).
- Textures: `common/render/symbol/player/<id>.dds`, `coach/coach_<id>.png`, `flag/e_<id>_r.png`, `emblemLc/emb_<id>_l.png`, `thumbnail/spike/k<id>_[tl].dds`.
