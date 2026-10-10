"""Work out gold/silver badges from last season's Basketball-Reference tables.
Gold = top 10 in the league in that stat, silver = 11-30. Players need 20+ games."""
import csv, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, "data", "stats")
MIN_GAMES = 20
CODE = {"BRK": "BKN", "CHO": "CHA", "PHO": "PHX"}

def first_rows(path):
    out = {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["Rk"] and r["Rk"] not in out:
            out[r["Rk"]] = r  # first row per player is the full-season (combined) row
    return out

def last_team(path):
    t = {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["Rk"] and r["Team"] not in ("2TM", "3TM", "4TM", "5TM"):
            t[r["Rk"]] = CODE.get(r["Team"], r["Team"])  # last listed single team
    return t

pg = first_rows(os.path.join(S, "bbref-2025-26-per-game.csv"))
adv = first_rows(os.path.join(S, "bbref-2025-26-advanced.csv"))
teams = last_team(os.path.join(S, "bbref-2025-26-per-game.csv"))
f = lambda v: float(v) if v not in ("", None) else 0.0

players = []
for rk, r in pg.items():
    a = next((x for x in adv.values() if x["Player"] == r["Player"]), None)
    players.append({
        "player": r["Player"], "last_team": teams.get(rk, ""), "pos": r["Pos"], "g": int(r["G"]), "gs": int(r["GS"]),
        "min": f(r["MP"]), "usg": f(a["USG%"]) if a else 0.0, "threes": f(r["3P"]), "reb": f(r["TRB"]),
        "ast": f(r["AST"]), "stocks": round(f(r["STL"]) + f(r["BLK"]), 1), "pts": f(r["PTS"]),
    })

STATS = [("minutes", "min"), ("usage", "usg"), ("threes", "threes"), ("rebounds", "reb"), ("assists", "ast"), ("stocks", "stocks")]
elig = [p for p in players if p["g"] >= MIN_GAMES]
for p in players:
    p["badges"] = {}
for name, key in STATS:
    ranked = sorted(elig, key=lambda p: p[key], reverse=True)
    for i, p in enumerate(ranked[:30]):
        p["badges"][name] = "gold" if i < 10 else "silver"
        p.setdefault("ranks", {})[name] = i + 1

out = {"season": "2025-26", "rule": "Gold = top 10, silver = 11-30, minimum 20 games", "players": [p for p in players if p["badges"]]}
json.dump(out, open(os.path.join(ROOT, "data", "badges.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out["players"]), "players with at least one badge")
