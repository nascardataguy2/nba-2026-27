# Task: extract a player news log from NBA podcast transcripts (2026-27 season)

Repo: /home/claude/nba-2026-27 (read only — do NOT edit anything in the repo, do not run git).
Transcripts: /home/claude/nba-2026-27/transcripts/extra/<file>.txt (first line = title | date | show | url).
Box scores for checking numbers: /home/claude/nba-2026-27/data/proj_history/box/YYYY-MM-DD.json
  (list of {player, team, date, min, pts, reb, ast, stl, blk, to, tpm, start, dk}). Games on date D are in box/D.json.
  Note: a show dated D usually talks about games played the night before (D-1) or that same night.
Site player names: /home/claude/nba-2026-27/data/players.json (field "player"). Use that exact spelling when the player is in it
  (watch curly apostrophes, e.g. Ja’Kobe Walter, and suffixes like Jr.). If he is not there, use the box-score spelling.

## What to do
Read EVERY line of each assigned transcript (no skimming). Pull out every useful, factual mention about a specific NBA player
that a DFS player would want: 
- role: starting / bench / closing / spot start / moved to bench / lineup change
- minutes: minutes played or trend, minutes limits, back-to-back rest plans
- injury/status: injury, diagnosis, timeline, questionable/out/returning, left game
- usage/shots: big shot volume, usage jumps or drops, who gets the ball
- coach comments or team decisions about rotation
- notable game lines (points/rebounds/assists/steals/blocks/minutes) — CHECK every number against the box score.
  If the show's number is wrong, use the box-score number. If you cannot find the game in the box files, leave numbers out.

Do NOT include: season-long fantasy advice (add/drop, hold, sell high, buy low, ADP, rankings, "top 50 player", burger boards),
jokes, hype with no fact behind it, betting picks, DFS ownership guesses, salary talk, or anything you are not sure is true.
If two shows say the same thing, one entry is enough. Opinions only count if they describe a concrete basketball fact
(e.g. "he closed the game over X").

## Output
Write a JSON array to the output file you are given. Each entry:
{"player": "...", "team": "ABC", "date": "YYYY-MM-DD", "kind": "injury|role|minutes|usage|stat|news",
 "text": "One or two complete plain sentences.", "expires": "YYYY-MM-DD or null", "tid": "x58"}
- date = the date the fact is about (game date for a game line; transcript date for status/news).
- text: complete sentences, no fragments. Never name a show, host, podcast, website or writer. Use the player's name or "He".
  Say game days by weekday or date ("Sunday", "Oct. 25"), not "last night" or "today".
- expires: for one-night statuses ("questionable Monday", "sits the second night of the back-to-back") set it to that game date.
  For an injury with a stated timeline, set the expected return date if one is stated. Otherwise null.
- team = the player's current team abbreviation (3 letters, as in the box files: ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS).
Be thorough: a recap show usually yields 40-80 entries. Validate the file is valid JSON (python3 -c "import json;json.load(open(PATH))").
Finish with one line: the count of entries written.
