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


def write_gamelogs(games, nights):
    """data/gamelogs.json: {norm name: [[date, team, opp, home, start, min, pts, reb, ast,
    stl, blk, to, tpm, dk, proj_min, proj_dk, salary], ...]} newest first."""
    opp = {}
    gdir = os.path.join(D, "games")
    for d in nights:
        for g in load_json(os.path.join(gdir, d + ".json"), []):
            opp[(d, g["away"])] = (g["home"], False)
            opp[(d, g["home"])] = (g["away"], True)
    snaps = {d: load_json(os.path.join(HIST, d + ".json"), {}) for d in nights}
    out = {}
    for k, g in games.items():
        rows = []
        for x in sorted(g, key=lambda r: r["date"], reverse=True):
            o, home = opp.get((x["date"], x["team"]), ("", False))
            pj = snaps.get(x["date"], {}).get(k) or {}
            rows.append([x["date"], x["team"], o, home, bool(x.get("start")), x["min"], x.get("pts", 0), x.get("reb", 0),
                         x.get("ast", 0), x.get("stl", 0), x.get("blk", 0), x.get("to", 0), x.get("tpm", 0), x["dk"],
                         pj.get("min"), pj.get("dk"), pj.get("salary")])
        out[k] = rows
    with open(os.path.join(D, "gamelogs.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)


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
    write_gamelogs(games, nights)
    out = {"through": nights[-1] if nights else None, "nights": len(nights), "players": rows}
    with open(os.path.join(D, "season.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=0, ensure_ascii=False)
    print("season:", out["through"], len(rows), "players")


if __name__ == "__main__":
    main()
