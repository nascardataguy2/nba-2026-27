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


def write_nights(nights, keep=14):
    """data/nights.json: the last nights' results for the Results tab. Each player row joins his
    box score with the projection, minutes, salary and Own% we had at lock."""
    out = {"dates": [], "nights": {}}
    for d in sorted(nights, reverse=True)[:keep]:
        box = load_json(os.path.join(HIST, "box", d + ".json"), [])
        snap = load_json(os.path.join(HIST, d + ".json"), {})
        glist = load_json(os.path.join(D, "games", d + ".json"), [])
        opp = {}
        for g in glist:
            opp[g["away"]] = g["home"]
            opp[g["home"]] = g["away"]
        rows, ou = [], {}
        for r in box:
            pj = snap.get(norm(r["player"])) or {}
            if pj.get("ou") is not None:
                ou.setdefault(r["team"], pj["ou"])
            sal = pj.get("salary")
            rows.append({"player": r["player"], "team": r["team"], "opp": pj.get("opp") or opp.get(r["team"], ""),
                         "pos": pj.get("pos") or r.get("pos", ""), "start": bool(r.get("start")),
                         "min": r["min"], "dk": r["dk"], "pts": r.get("pts", 0), "reb": r.get("reb", 0),
                         "ast": r.get("ast", 0), "stl": r.get("stl", 0), "blk": r.get("blk", 0), "to": r.get("to", 0),
                         "tpm": r.get("tpm", 0), "sal": sal, "proj": pj.get("dk"), "pmin": pj.get("min"),
                         "own": pj.get("own"), "slate": pj.get("slate"),
                         "val": round(r["dk"] / (sal / 1000.0), 2) if sal else None,
                         "diff": round(r["dk"] - pj["dk"], 1) if pj.get("dk") is not None else None})
        games = []
        for g in glist:
            f = g.get("final") or [None, None]
            games.append({"away": g["away"], "home": g["home"], "as": f[0], "hs": f[1],
                          "ou": ou.get(g["home"], ou.get(g["away"])), "time": g.get("time")})
        games.sort(key=lambda g: (g.get("time") or "", g["home"]))
        rows.sort(key=lambda x: -x["dk"])
        out["dates"].append(d)
        out["nights"][d] = {"games": games, "players": rows}
    with open(os.path.join(D, "nights.json"), "w", encoding="utf-8") as fh:
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
    write_nights(nights)
    out = {"through": nights[-1] if nights else None, "nights": len(nights), "players": rows}
    with open(os.path.join(D, "season.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=0, ensure_ascii=False)
    print("season:", out["through"], len(rows), "players")


if __name__ == "__main__":
    main()
