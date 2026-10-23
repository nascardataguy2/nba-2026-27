"""Teammate splits for the Games tab ("players off the court").

Reads data/games/DATE.json (written by timelines.py) and writes one file per
team, data/wowy/TEAM.json, with every game's on-court stretches and DK scoring
events for that team's players, plus data/wowy/index.json. The site does the
math in the browser, so any set of players can be taken off the court at once.
A player who missed a game counts as off the court for that whole game.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D  # noqa: E402

GDIR = os.path.join(D, "games")
WDIR = os.path.join(D, "wowy")


def main():
    teams, through = {}, None
    for fn in sorted(os.listdir(GDIR)) if os.path.isdir(GDIR) else []:
        if not (fn.startswith("20") and fn.endswith(".json")):
            continue
        for g in load_json(os.path.join(GDIR, fn), []):
            through = fn[:10]
            for side, opp in ((g["away"], g["home"]), (g["home"], g["away"])):
                ps = {p["player"]: {"st": [[a, b] for a, b, _ in p["stints"]], "ev": p.get("ev", [])}
                      for p in g["players"] if p["team"] == side}
                if ps:
                    teams.setdefault(side, []).append({"date": fn[:10], "id": g["id"], "opp": opp, "players": ps})
    os.makedirs(WDIR, exist_ok=True)
    for t, games in teams.items():
        with open(os.path.join(WDIR, t + ".json"), "w", encoding="utf-8") as fh:
            json.dump({"team": t, "through": through, "games": games}, fh, separators=(",", ":"), ensure_ascii=False)
    with open(os.path.join(WDIR, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"through": through, "teams": {t: len(g) for t, g in sorted(teams.items())}}, fh, separators=(",", ":"))
    print("wowy:", through, len(teams), "teams")


if __name__ == "__main__":
    main()
