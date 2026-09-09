# FC26 Manager Companion

A browser-based reader for EA SPORTS FC 26 career saves. Drop in a `CmMgr*` save file and browse every league, club roster and player — ratings, potential, positions, estimated values, contracts and wages — without opening the game or Live Editor.

Everything is decoded client-side; the save never leaves your machine.

## Deploy to Vercel

1. Push this folder to a Git repo (or run `vercel` from it).
2. Import the repo in Vercel — it detects Vite automatically (`npm run build`, output `dist`).

## Run locally

```
npm install
npm run dev
```

## Where is my save?

`%LOCALAPPDATA%\EA SPORTS FC 26\settings` — files named `CmMgrC…` (club career) or `CmMgrP…` (player career).

## Snapshots & compare

Every save you open is stored as a snapshot in your browser (IndexedDB - nothing is uploaded). Open later saves from the same career, then use **Snapshots & compare** to pick any two and see:

- who left and who joined any club between the two dates (and where leavers went)
- development of the players who stayed
- biggest improvers and drop-offs in the whole game world, potential re-ratings
- new faces (youth / regens) and players no longer in the game
- club ratings and squad values that moved

Snapshots can be renamed or deleted from the same page. Clearing site data in the browser removes them.

## How it works

- `src/parser.ts` decodes the two `fifa_ng_db` (T3DB) databases embedded in the FBCHUNKS save container: table directory, bit-packed integer fields, UTF-8 strings, floats.
- `public/data/meta.json` maps EA's 4-character table/field short names to real names (players, teams, leagues, links, contracts, loans, career tables).
- Player names are stored in the game install's name table, not the save. `public/data/names.json` is a reconstructed name pool keyed by EA name IDs (built by cross-referencing public FC 26 datasets), plus a fallback by player ID. About 95% of players resolve; the rest show as `Unknown #id`.
- Market value is not stored in the save; `public/data/valuemodel.json` is a lookup model fitted on FC 26's own values (rating × age × position × potential gap), typically within 5%.
- Wages come from `career_playercontract`, which the save only holds for your own club.
- The in-game date is inferred from the latest dated event/contract change in the save.

Unofficial fan project, not affiliated with EA.
