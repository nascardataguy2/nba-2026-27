# Processing queue

One chunk is processed per day at about 4:30 PM ET. Each episode is read in full, and only facts actually said are added. Private transcript copies live in `transcripts/` (not published).

## Done
- Chunk 0 (10/6): Locked On — Lakers preview
- Chunk 1 (10/6): Locked On — Top 9 new teams, Risers/fallers (usage), Amen Thompson (HOU), Hawks starter (ATL), Regression risks
- Chunk 2 (10/7): Locked On — Bounceback, Summer League West, Summer League East, Rookies, Second-year breakouts
- Chunk 3 (10/8): Locked On — Year 3 breakouts, Schedule, DAL, DEN, GSW
- Chunk 4 (10/9): Locked On — IND, DET, LAC, BKN, CHA
- Chunk 5 (10/10): Locked On — CHI, CLE, ATL full preview, SAS, PHX
- Chunk 6 (10/11): Locked On — MEM, MIN, TOR, PHI, POR
- Chunk 7 (10/12): Locked On — NYK, HOU full preview, MIL, OKC, BOS
- Chunk 8 (10/12): Locked On — SAC, ORL, NOP, UTA, WAS
- Chunk 12 (10/13): 10/12 batch, Locked On — MIN, must-draft list, MIL, MIA, MEM
- Chunk 9 (10/13): RotoWire — safest players, expert risers, must-draft guards, sleepers, do-not-draft
- Chunk 10 (10/14): Old Man Squad — steals and busts (x2), safest players, breakouts
- Chunk 11 (10/15): Old Man Squad + Number Two Sports — must-drafts, busts, sleepers, breakouts
- Chunk 13 (10/15): 10/12 batch, Locked On + RotoWire — busts, draft comparisons, forwards, centers, most important players
- Chunk 14 (10/17): 10/13 batch, Locked On + RotoWire — NOP preview, do-not-draft, sleepers, hardest to rank
- Chunk 15 (10/18): 10/13 batch, Old Man Squad + Number Two Sports — draft targets, hidden gems, league winners, ADP risers, do-not-draft, polarizing names
- Chunk 16 (10/18): 10/17 batch — TOR preview, cheat sheet, boom or bust, winners, late-round targets

## Locked On Fantasy Basketball (files in transcripts/lockedon/)

## Extra channels, added 10/7 (files in transcripts/extra/)

## Daily batch, added 10/12 (files in transcripts/extra/; undated episodes were posted before 10/12)

## Daily batch, added 10/13 (files in transcripts/extra/; undated episodes were posted before 10/13)

## Daily batch, added 10/17 (files in transcripts/extra/; all undated, posted 10/14-10/17 — treat as 2026-10-15)

## Daily batch, added 10/20 (bundle dated 10/18; undated episodes treated as 2026-10-16)
- Chunk 17 (Locked On + Old Man Squad + RotoWire): WAS preview (x43, 10/17), UTA preview (x44, 10/17), 16 league winners (x45, 10/17), Last must-drafts or do-not-drafts (x46, 10/17), NYK preview (x47), 10 rookies, sleepers and busts (x48)

## Notes
- Season data (from 10/20): Grok uploads one season-data_DATE.txt (DailyFantasyFuel projections, Basketball-Reference advanced, TeamRankings pace; RotoWire minutes is subscriber-only and unavailable). Saved privately in data/season/ (gitignored). The daily site table is not built yet; waiting on Pearce's go.
- Storylines (added 10/15): `quickhits.json` key `storylines` = {date, items[player, team, text, source]}, shown at the top of Quick Hits. Every run replaces it with the 5-8 biggest current news items (newest injuries, starting-job changes, minutes changes) and sets date to the run date. Same writing rules: complete sentences, no show or host names.
- Raw daily bundles are kept in transcripts/bundles/ (private).
- Run order (set 10/12, extended 10/13): two chunks a day, at 4:30 PM and 11:00 PM ET, in this order: 7, 8, 12, 9, 10, 11, 13, 14, 15, 16, 17.
- The Miami preview arrived in the 10/12 batch (x17).
- The extra-channel episodes are mostly draft-value talk (sleepers, busts, safe picks). Their role, minutes, injury and usage facts go into the main tables, and each host's target/fade calls go into the player notes with the show named.
- Every chunk also updates `data/quickhits.json` (If He Sits, Role Up, Role Down, Rest Watch, Out to Start) with any new facts from that chunk's episodes, then purges the jsDelivr cache with curl from the shell (network is open as of 10/15; never use WebFetch for it) (https://purge.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/db.json and .../ai.txt) so the Blogger site shows the update.
- The Blogger theme lives in `blogger/race4theprize-nba-theme.xml`. It loads data/db.json from GitHub Pages (falling back to jsDelivr), so the theme itself does not need re-uploading when data changes.
- Writing style for all public notes (players, teams, quickhits, moves): never name hosts, shows or episodes in the note text (no "Josh Lloyd thinks", no "the 8/27 episode"). State the projection plainly ("He is expected to start", "a return around Thanksgiving is the guess"). Sources stay only in the hidden `source` id field.

## Ranking sources (stored, not on the site yet)
- `data/rankings/nba-top250-points-2026-27.csv` / `.json`: NBA.com Top 250 points-league rankings (published 9/29/2026), added 10/9. Base for the planned preseason ranking tab. Not built yet; wait for the user's go.
- Conflict to resolve: Mikel Brown Jr. is BKN in our player data but FA on the NBA.com list.

## Favicon rule (user request, 10/9)
- The live nbadfs.com theme has two favicon `<link>` lines that Grok added right after `<b:include data='blog' name='all-head-content'/>`, pointing to the Blogger-hosted `.../s256/nbadfs-favicon-3.png`. The embedded data-URI favicon did not work.
- Grok's two lines (now in blogger/race4theprize-nba-theme.xml, right after all-head-content): the apple-touch-icon 180x180 link and the icon 192x192 link to the Blogger-hosted nbadfs-favicon-3.png. Keep both exactly as they are, keep the all-head-content line, and keep the old data:image/png;base64 icon line unless the user says to drop it.
- Any theme code given to the user must keep Grok's two favicon lines. Get the exact lines from the user/Grok before handing over new theme code, and never send a full-theme replacement without them.

## Badges (built 10/10; Picks tab was merged into Rankings the same day)
- Six badges from last season's player stats: Minutes, Usage, Threes, Rebounds, Assists, Stocks (steals plus blocks).
- Gold = top 10 in the league in that stat, silver = 11 to 30, no badge otherwise. Rerun daily once the season's stats come in.
- Icons are final in assets/badges (stopwatch, pig, flaming 3, backboard, basketball dime, padlock), with clear backgrounds.
- Box style: solid filled rounded box. Gold fill #E8B21E, light silver fill #E2E5EA.
- Tab must be tight: one compact row per player (name, team box, starter/bench, earned badges, one key number), default sort by most gold then silver badges, controls for Sort, Team and Role.
- Data still needed: Grok pulls last season's Basketball-Reference per-game and advanced tables. Wait for the user's "go" before writing that request or any code.

## Site code layout (since 10/10)
- nbadfs.com runs the small shell theme in blogger/nbadfs-shell-theme.xml. It keeps the favicon lines and loads the real site from GitHub: site/app.css, site/body.html and site/app.js (GitHub Pages first, jsDelivr fallback).
- To change the site design, edit the files in site/, commit and push. No Blogger paste is needed. Purge jsDelivr for site/ files too if possible.
- blogger/race4theprize-nba-theme.xml is the old full theme, kept only as a reference.

- 10/10: The separate Picks tab was removed at the user's request. Badge icons now show on Rankings (with a badge filter row) and next to player names on Quick Hits, Players, Injuries and Moves.
