# FC26 Manager Companion — v3

A browser-based reader for FC 26 career saves. Save parsing, games, snapshots and shortlists stay in your browser. The app does not modify FC save files.

## Run locally

Use Node.js 20.19+ or a current LTS version. From the `app` folder:

```sh
npm ci
npm run dev
```

Open the local address printed in the terminal. For a production build, run `npm run build`; the output is `dist`. This archive also includes a prebuilt `dist` directory. Serve it over HTTP (for example `python -m http.server 8080 --directory dist`); do not open `index.html` directly with a file URL.

To update an existing Vercel deployment, replace the source and deploy with build command `npm run build`, output directory `dist`. Keep the same site address/browser to retain existing browser data.

## Games: multiple saves in each career

1. Open **Games & saves** and create a named game, such as `Leverkusen career`.
2. Select that game before opening any FC career save. FC files are usually in `%LOCALAPPDATA%\EA SPORTS FC 26\settings`, named `CmMgrC…` or `CmMgrP…`.
3. Every newly opened FC file creates a snapshot and stores a byte-for-byte copy of the original file in that game. It is safe to open multiple saves with identical filenames or inferred dates; their IDs are distinct.
4. **Load save** reopens a stored file without creating another snapshot.
5. **Export entire game** downloads a `.fc26game.json` file containing all snapshots, original save files and the shortlist.
6. **Import game** restores an exported game as a separate copy. It never merges over another game, even if its name matches.

Data is saved automatically. Game names can be changed with **Save game name**. The most recently selected game is remembered. Exports are portable backups; clearing browser site data removes local games. Large careers need enough browser storage and memory for their original files and exports.

Existing v2 snapshots migrate into `My first game / existing snapshots`. They retain their comparison history but have no original FC file to reopen, since v2 never stored the bytes. Reopen the original save to add a full saved-file record. The landing page can browse old snapshots even without an open FC file. Existing snapshots cannot reliably be split into careers automatically.

## Player timeline

Click a player in a roster, search, youth list, shortlist or comparison table. The timeline covers every snapshot in the selected game:

- Switch between OVR, POT and estimated-value line charts.
- Hover or focus points for snapshot/date, club and all three values.
- Read exact values and club membership in the table below the chart.
- Missing players show as absent; missing observations break the line instead of inventing values.

Snapshots are sorted by inferred in-game date, then capture time. The horizontal axis represents successive snapshots, not equal elapsed days. Club is categorical, so it is shown at each observation instead of plotted on a numeric axis. Player matching uses FC player IDs within the selected game.

## My club → Youth

Displays `career_youthplayers`, including players without senior-club roster links. Available attributes include name, positions, age, OVR, POT, potential variance, low-potential swing, months in the academy and tier. Youth records without a matching player row remain visible with unknown attributes. Youth players are excluded from senior squad planning and free-agent search.

The scout table shows the recorded scout name, experience, knowledge, region ID and state code. **The bundled schema does not establish the displayed potential min/max formula or link individual youths to scouts.** The app shows the recorded potential/variance/swing separately, rather than presenting an invented range or scout assignment. This is the remaining limitation of the requested Youth view.

## My club → Squad planning & depth

Choose 4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-4-3 or 4-1-2-1-2.

The suggested XI uses registered primary/secondary positions. It first maximizes filled positions and then total OVR, assigning each player at most once. An optional filter excludes injured players. The view includes:

- A formation pitch with clickable suggested starters.
- Each position's complete options, ranked by OVR.
- Vacancies, missing cover outside the XI and cover shared between positions.
- Starters aged 30+ with no other eligible senior-squad player under 24.
- Contracts ending by the inferred current calendar year, including already-expired contracts.

Successor alerts use age and position eligibility, not an assumed development path. Academy players do not count as senior cover. This is an OVR-based planning suggestion, not a simulation of tactical suitability or the manager's actual selection.

## Transfer shortlist and advanced search

Star a player from search or their profile. The shortlist belongs to the current game and survives subsequent saves, reloads and game export/import. It compares the first and latest recorded OVR, POT and club and keeps targets visible if they are absent from the currently open save. Each target has a full timeline.

Search retains name/club/nation, gender, league, position, OVR, POT and age controls. New filters include:

- Not highest OVR at the selected position; highest OVR; saved substitutes/reserves; saved starting XI.
- Maximum estimated value in €M, contract ending by year, and minimum POT-minus-OVR growth.
- Preferred foot, minimum skill/weak-foot stars, fit-only and exclude loans.

**Example:** select `ST`, choose `Not highest OVR at position`, and sort OVR descending. Each result shows its rank and a clickable best club option with that player's OVR. The same works for every supported position.

Ranking includes secondary positions. Equal OVR shares first place; a POT tiebreak does not turn an equally rated player into a backup. If no position is selected, each player's primary position is used. The saved lineup is shown separately because rating hierarchy is not proof of who starts actual matches. Free agents are not assigned a club hierarchy.

## Accuracy and verification

Names use the bundled FC name pool and edited/generated names from the save. Unresolved names retain their player IDs. Market values are estimates, wages are shown only where present, and dates are inferred from the latest dated event/contract update. This inferred date may lag the actual in-game day.

The package includes tests using two synthetic binary saves; no personal save data is included. The updated app passed TypeScript, a production build, core data tests and Chromium workflow tests. A real user career save was not attached, so real-save regression validation remains outstanding.

To run the tests:

```sh
python tests/make-fixtures.py
npm test
npx playwright install chromium --only-shell
npm run test:browser
```

Browser tests start a local Vite server on port 5173 and write QA screenshots into `tests`. They exercise youth, formation uniqueness, backup search, starring, timeline changes, export/import, reopening without duplicates and career isolation. Core tests also cover v1 IndexedDB migration, byte-exact file roundtrips, invalid import rejection, deletion and parser bounds.

## Source map

- `src/parser.ts`: embedded T3DB/FBCHUNKS decoder and bounds checks.
- `src/model.ts`: club/player model, date inference, youth/scout extraction.
- `src/snapshots.ts`: versioned IndexedDB, game storage, snapshots, original files, export/import and shortlist persistence.
- `src/planning.ts`: position ranking and unique maximum-weight formation assignment.
- `src/Features.tsx`: games, timelines, academy, planner and shortlist UI.
- `src/App.tsx`: navigation, existing views and advanced player search.
- `src/Snapshots.tsx`: per-game comparison and clickable historical players.

Unofficial fan project, not affiliated with EA.
