"""Weekly: this season's badges and rankings from our ESPN box scores (data/proj_history/box).

Badges (data/badges.json): gold = top 10 in the league, silver = 11-30, per game, in minutes,
usage, threes, rebounds, assists and stocks (steals + blocks). A player needs MIN_GAMES games.
Usage is the standard usage rate: the share of his team's possessions he used while on the floor,
    100 x (FGA + 0.44 x FTA + TO) x (team minutes / 5) / (minutes x (team FGA + 0.44 x team FTA + team TO)),
summed over the games he played, from the same box scores.

Rankings (data/rankings/season.json): every player with MIN_GAMES games, ordered by DK points a
game, with his preseason rank (NBA.com Top 250) to show how far he has moved.

Runs once a week (Monday), or any day with --force.
"""
import argparse
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import norm  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
BOX = os.path.join(D, "proj_history", "box")
MIN_GAMES = 5
ET = ZoneInfo("America/New_York")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    today = datetime.now(ET).date()
    try:
        last = json.load(open(os.path.join(D, "badges.json"))).get("updated", "")
    except Exception:
        last = ""
    if not a.force and today.weekday() != 0 and last and last >= str(today.fromordinal(today.toordinal() - 7)):
        return  # weekly: Mondays, or if the last update is over a week old
    if not a.force and last == str(today):
        return

    rows = []
    for fn in sorted(os.listdir(BOX)):
        rows += json.load(open(os.path.join(BOX, fn), encoding="utf-8"))
    # Team totals per game for usage.
    team = {}
    for r in rows:
        t = team.setdefault((r["date"], r["team"]), [0.0, 0.0, 0.0, 0.0])
        t[0] += r["min"]
        t[1] += r.get("fga") or 0
        t[2] += r.get("fta") or 0
        t[3] += r.get("to") or 0
    pl = {}
    for r in rows:
        k = norm(r["player"])
        p = pl.setdefault(k, {"player": r["player"], "g": 0, "gs": 0, "min": 0.0, "pts": 0.0, "reb": 0.0, "ast": 0.0,
                              "stl": 0.0, "blk": 0.0, "tpm": 0.0, "dk": 0.0, "use": 0.0, "teamuse": 0.0, "last": "", "team": "", "pos": ""})
        p["g"] += 1
        p["gs"] += 1 if r.get("start") else 0
        for f in ("min", "pts", "reb", "ast", "stl", "blk", "tpm", "dk"):
            p[f] += r.get(f) or 0
        t = team[(r["date"], r["team"])]
        if r.get("fga") is not None and t[0] > 0:
            p["use"] += ((r.get("fga") or 0) + 0.44 * (r.get("fta") or 0) + (r.get("to") or 0)) * (t[0] / 5.0)
            p["teamuse"] += r["min"] * (t[1] + 0.44 * t[2] + t[3])
        if r["date"] >= p["last"]:
            p["last"], p["team"], p["pos"] = r["date"], r["team"], r.get("pos") or p["pos"]
    players = []
    for k, p in pl.items():
        g = p["g"]
        players.append({"player": p["player"], "last_team": p["team"], "pos": p["pos"], "g": g, "gs": p["gs"],
                        "min": round(p["min"] / g, 1), "usg": round(100 * p["use"] / p["teamuse"], 1) if p["teamuse"] else 0.0,
                        "threes": round(p["tpm"] / g, 1), "reb": round(p["reb"] / g, 1), "ast": round(p["ast"] / g, 1),
                        "stocks": round((p["stl"] + p["blk"]) / g, 1), "pts": round(p["pts"] / g, 1), "dk": round(p["dk"] / g, 1)})

    stats = [("minutes", "min"), ("usage", "usg"), ("threes", "threes"), ("rebounds", "reb"), ("assists", "ast"), ("stocks", "stocks")]
    elig = [p for p in players if p["g"] >= MIN_GAMES]
    for p in players:
        p["badges"], p["ranks"] = {}, {}
    for name, key in stats:
        for i, p in enumerate(sorted(elig, key=lambda p: p[key], reverse=True)[:30]):
            p["badges"][name] = "gold" if i < 10 else "silver"
            p["ranks"][name] = i + 1
    through = max(r["date"] for r in rows)
    out = {"season": "2026-27", "updated": str(today), "through": through,
           "rule": "Gold = top 10, silver = 11-30, minimum %d games, games through %s" % (MIN_GAMES, through),
           "players": [p for p in players if p["badges"]]}
    json.dump(out, open(os.path.join(D, "badges.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    pre = {}
    try:
        for r in json.load(open(os.path.join(D, "rankings", "nba-top250-points-2026-27.json"), encoding="utf-8"))["rows"]:
            pre[norm(r["player"])] = r["rank"]
    except Exception:
        pass
    order = sorted(elig, key=lambda p: -p["dk"])
    ranks = [{"rank": i + 1, "player": p["player"], "team": p["last_team"], "pos": p["pos"], "g": p["g"], "dk": p["dk"],
              "min": p["min"], "pre": pre.get(norm(p["player"]))} for i, p in enumerate(order)]
    json.dump({"updated": str(today), "through": through, "min_games": MIN_GAMES, "rows": ranks},
              open(os.path.join(D, "rankings", "season.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("season badges: %d players with a badge, %d ranked, games through %s" % (len(out["players"]), len(ranks), through))


if __name__ == "__main__":
    main()
