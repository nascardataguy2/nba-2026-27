"""Season stats for the Research tab.

Reads every night of box scores in data/proj_history/box/ and writes
data/season.json: games, starts, averages, DK points per minute and the last
three games for every player. Tonight's salary, matchup, total and spread are
joined on the site from data/projections.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import norm, load_json, D, HIST  # noqa: E402

STATS = ("min", "dk", "pts", "reb", "ast", "stl", "blk", "to", "tpm")


def main():
    bdir = os.path.join(HIST, "box")
    games = {}
    nights = sorted(f[:10] for f in os.listdir(bdir) if f.endswith(".json")) if os.path.isdir(bdir) else []
    for d in nights:
        for r in load_json(os.path.join(bdir, d + ".json"), []):
            games.setdefault(norm(r["player"]), []).append(r)
    rows = []
    for k, g in games.items():
        g = sorted(g, key=lambda x: x["date"])
        last = g[-1]
        n = len(g)
        row = {"player": last["player"], "team": last["team"], "pos": last.get("pos", ""), "gp": n,
               "gs": sum(1 for x in g if x.get("start"))}
        for s in STATS:
            row[s] = round(sum(x.get(s, 0) for x in g) / n, 1)
        tm = sum(x["min"] for x in g)
        row["fppm"] = round(sum(x["dk"] for x in g) / tm, 2) if tm else None
        l3 = g[-3:]
        row["l3_dk"] = round(sum(x["dk"] for x in l3) / len(l3), 1)
        row["l3_min"] = round(sum(x["min"] for x in l3) / len(l3), 1)
        row["last"] = {"date": last["date"], "min": last["min"], "dk": last["dk"]}
        rows.append(row)
    rows.sort(key=lambda r: -r["dk"])
    out = {"through": nights[-1] if nights else None, "nights": len(nights), "players": rows}
    with open(os.path.join(D, "season.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=0, ensure_ascii=False)
    print("season:", out["through"], len(rows), "players")


if __name__ == "__main__":
    main()
