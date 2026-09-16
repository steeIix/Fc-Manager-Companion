# FC26 Manager Companion — v4

A browser-based reader for FC 26 career saves. The app preserves original save files and never edits them.

## Run

From the app folder, run `npm ci` and `npm run dev`. For deployment, use `npm run build` with output directory `dist`. A prebuilt dist is included; serve it over HTTP, for example `python -m http.server 8080 --directory dist`. Keep the same browser and site address when upgrading to retain browser data.

## Saves in import order

Create a game in **Games & saves**, then open your CmMgr files in the order you want to compare them. Each import is a separate Save 1, Save 2, Save 3 observation, even if the filename is reused. Loading a stored save does not create a duplicate. Renaming a snapshot does not change its order.

All comparisons and timelines use this sequence. There are no inferred in-game dates or elapsed-time claims. Career season numbers are read from each save; the first imported save is not necessarily career season 1.

Existing snapshots migrate using their original capture order. Old estimated dates, ages and market values are cleared; player observations, raw files and shortlists remain. Older snapshots that never retained raw files cannot be reopened, and may lack birth dates, contracts or history fields until their original file is available.

**Export entire game** backs up snapshots, original files, shortlist and labelled manual history corrections in one `.fc26game.json` file. **Import game** restores a separate copy. Browser storage is local to the site: export before clearing it or moving browsers.

## Recorded player information

The mapped player data contains birth dates and contract end years. It does not provide a verified current-age or market-value field. Without an established current date, the app displays birth dates and contract end years, and omits current ages, estimated market values, ageing alerts and automatic “expires this year” warnings.

Player timelines chart OVR, POT or contract end year across saves, with club changes in the observation table. Missing observations break the chart line. Individual attributes are read from the save. Wages appear where recorded.

## Manager history

A zero league position is not a finishing place. Earlier-season zeroes display **Not recorded**; current-season zeroes display **In progress**. A recorded result from another snapshot can fill the gap only when season, club and league match and that snapshot records the season as completed. Conflicting results remain unresolved.

A club's previous-season position is not used to fill a different season after a club change. Use **Set known finish** if you know the actual result. Manual entries are labelled **User-entered**, persist in game exports, and can be removed with **Use recorded result**. Original FC bytes stay unchanged.

## Search and squad depth

Primary-position matching is the default: a primary CAM does not block an RM merely because RM is a secondary preference. Secondary matching is optional. All strictly higher-rated peers are listed; equal OVR is not counted as ahead.

Starting-slot counts use a complete recorded XI (11 players, one goalkeeper), or your explicit slot-count selection. There are no fallback formation guesses. When the XI is incomplete, choose the count before using outside-starting-slots or buried filters. With two CM slots, two CMs can start and the third is behind both. Recorded starters elsewhere are excluded from blockers when a complete XI is available. These indicators describe rating and recorded lineup data, not guaranteed playing time.

Search supports position, club, nation, league, OVR/POT, growth, contract end year, preferred foot, skill moves, weak foot, injury, loan records and squad role. Star players to keep a per-game shortlist and compare their ratings and club changes.

The squad planner offers six formations, assigning each player at most once and ranking options by OVR. It flags vacancies, missing cover and cover shared between positions. Suggested formations use eligible primary and secondary positions. Contract alerts require you to choose an end year; no current year is assumed.

## Youth academy

My club → Youth includes career_youthplayers even without senior roster links. It shows available player attributes, recorded potential, variance, low-potential swing, academy months and tier, plus recorded scout information. The bundled mapping does not establish exact potential-range formulas or individual youth-to-scout links; these are not invented. Youth records missing a player row remain visible with unavailable attributes.

## Verification

Run `python tests/make-fixtures.py`, `npm test`, and `npm run build`. For browser workflows, install Playwright Chromium with `npx playwright install chromium --only-shell`, then run `npm run test:browser`. An optional REAL_SAVE environment variable loads an external save for a final browser check. Personal saves and test screenshots are not included in this archive.

Tests cover binary parsing, migration, sequential saves, raw-file export/import, game isolation, primary-position blockers, explicit slot counts, unique formations, missing history, manual finishes and table alignment.

Unofficial fan project, not affiliated with EA.

## Market values (v6)

The save doesn't store market values (the game computes them live), so the app estimates them with a model fitted on FC 26's own launch values: a rating curve × age curve × position group, plus terms for potential gap and youth (high-potential teenagers are valued much more aggressively, as in the game). Typical error is under 5%; top players land within ~10%. Values are rounded to game-like steps (€1M above €50M). Women's players currently use the same curve.

The in-game date is inferred from the latest past event the game wrote into the save; contract dates are only used when they are within a month of that, so pre-contract agreements can't push the date forward.

## Dark mode

Toggle from the landing page or the sidebar; the choice is remembered in the browser and defaults to your system setting.

## Archetypes

Every player is labelled with an archetype derived from their attributes, NBA 2K-style (e.g. "Roaming Shadow Striker", "Ball-Playing Cover Defender"). `src/archetypes.ts` defines 30 archetypes across eight position groups (keepers, centre-backs, full-backs, defensive / central / attacking midfielders, wingers, strikers), each as a weighted attribute signature. Scores are z-normalised against every player in the same position group in the save, so the label describes a player's *shape* rather than how good they are; a close second archetype becomes a hybrid prefix, and a player strong across the board gets "Complete …". The profile shows the fit percentage and the scores for every archetype in the group.

Style tags ("Finesse Shot", "Tiki Taka", "Deflector", …) are attribute-threshold badges modelled on PlayStyles. They are derived, not read from the game: the save only stores legacy trait bits and not the PlayStyle table.

Search can filter by archetype and by style tag.

## Design

The UI follows the "Modernist" design handoff (`src/styles.css`): Archivo, zero-radius, 2px rules, and a club-colour accent. `useClubTheme` in `App.tsx` reads the viewed club's kit colours from the save and sets `--club` / `--club-ink` / `--club-tint` on `<html>`, so opening a club page (or switching clubs from the rail) rethemes the app. Near-white and near-black kit colours are skipped; with no club the accent falls back to the system red. Dark mode is unchanged (`[data-theme=dark]`); the rail's Active club switcher lists your club plus the rest of its league. Animations respect `prefers-reduced-motion`.

## Club crests

Crests are shown in the club header, league tables, rosters, search, the player profile and the rail switcher. Sources, in order:

1. **Local pack** — `public/logos/{teamId}.png` (or `.svg`). Build it from the free packs at https://football-logos.cc/collections/:
   download the leagues you want, unzip them into one folder, then run `node scripts/import-logos.mjs ./packs`.
   Files are matched to EA team ids by club name using `public/data/teams-ref.json`; the script lists any clubs it
   couldn't match so you can pin them in `scripts/logo-overrides.json` (`"teamId": "file-slug"`). Commit `public/logos`
   and redeploy. Logo copyright belongs to the clubs; the pack site's licence notes apply.
2. **CDN fallback** — `public/data/logos.json` maps ~480 EA team ids to sofifa's crest images, used when no local file exists.
   This makes requests to `cdn.sofifa.net` from the visitor's browser; turn it off with the "Club crests" checkbox in the sidebar.
3. **Kit-colour swatch** — always available, drawn from the save.

## Rankings, classifications and trends

- **Rank** — world rank within the player's ranking group: Goalkeepers, Defenders, Midfielders, Wingers (LW/RW/LM/RM) and Strikers (ST/CF). Men and women are ranked separately (women carry a "W" suffix) and the search defaults to men. Ties break on potential, then value, so a rating-sorted list always matches the rank order. Hover for the rank at the exact position and the group rank inside their league. Icons, free agents and placeholder teams are excluded.
- **Classification** — strictly rank-based at the top, each tier with its own muted colour:
  - `#1` -> **World's Best Goalkeeper / Defender / Midfielder / Winger / Striker**, or **One of the Greats** if 32+
  - `#2-10` -> **World-Class**, or **World-Class Legend** if 32+
  - `#11-30` -> **Elite**
  - then talent/age tiers: Generational Talent, Wonderkid, Rising Star, Evergreen, In His Prime, Top Prospect, Established, Late Bloomer, Prospect, Squad Player, Veteran, Journeyman, Developing. Hover a tag for the reason.
- **Trends** — with an earlier save in the game, arrows show movement in group rank and market value; ratings stay plain. The profile lists the previous OVR/POT/rank and old club.
- **Seasons** — careers start in 2026/27, so Season 3 = 2028/29 in the rail, manager history and snapshots.
- Placeholder club names are replaced with real ones (Inter, AC Milan, Lazio, Atalanta).

## Naming unknown players

Players whose name ID isn't in the bundled pool show as *Unknown #id* with a pencil next to the name (in search, rosters, league boards and the profile header). Click it, type the name, done — it applies immediately and is remembered in this browser (`localStorage`), so it carries over to every save you open afterwards. Leave the prompt empty to reset. The profile always shows the pencil, so you can also correct a resolved name.

## Clubs that could use this player

Each player profile lists clubs where he would be an upgrade: for every club of the chosen calibre, the app finds their best option at each of the player's positions and keeps the club when that incumbent is weaker (or the slot is empty). Results are ordered by club rating, since a place at a stronger club matters more than the size of the gap, and show the incumbent's rating and age plus a "younger" flag when the player is at least four years younger. Filters: minimum club stars (5, 4.5, 4 or 3 stars), all leagues or the player's own league, and whether to consider secondary positions. Clicking a row opens that club. Women's and men's clubs are matched separately.
