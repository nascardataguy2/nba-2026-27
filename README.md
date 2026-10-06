# NBA 2026-27 Database

A public, plain-English database of NBA 2026-27 offseason knowledge for DFS: projected starters, rotations, minutes and usage changes, injuries, and offseason moves.

- **Website:** https://nascardataguy2.github.io/nba-2026-27/
- **AI-ready text (give this link to any AI):** https://nascardataguy2.github.io/nba-2026-27/ai.txt
- **Raw data:** `data/players.csv`, `data/teams.csv`, `data/injuries.csv`, `data/moves.csv`, and `data/db.json`

Every row links back to the podcast episode it came from. Projections are the host's opinions, not official team news.

## How it is updated
1. New podcast transcripts are read in full.
2. Facts are added to `data/players.json`, `teams.json`, `moves.json`, and `sources.json`.
3. `python3 scripts/build.py` rebuilds `db.json`, the CSV files, and `ai.txt`.
