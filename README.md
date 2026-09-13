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
