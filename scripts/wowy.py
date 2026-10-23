"""Teammate splits for the Games tab: how each player does with each teammate
on the floor and with him off it, added up over every game this season.

Reads data/games/DATE.json (written by timelines.py) and writes data/wowy.json:
{"through": date, "games": n, "teams": {team: {player: {"min": total minutes,
"dk": total DK, "gp": games, "mates": {teammate: [min with, DK with,
min without, DK without]}}}}}. DK here is from the play-by-play (no double-double
or triple-double bonus).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D  # noqa: E402

GDIR = os.path.join(D, "games")


def main():
    teams, n, through = {}, 0, None
    for fn in sorted(os.listdir(GDIR)) if os.path.isdir(GDIR) else []:
        if not (fn.startswith("20") and fn.endswith(".json")):
            continue
        for g in load_json(os.path.join(GDIR, fn), []):
            if "wowy" not in g:
                continue
            n += 1
            through = fn[:10]
            tm = {p["player"]: p["team"] for p in g["players"]}
            for pl, row in g["wowy"].items():
                t = teams.setdefault(tm.get(pl, ""), {})
                rec = t.setdefault(pl, {"min": 0.0, "dk": 0.0, "gp": 0, "mates": {}})
                rec["gp"] += 1
                first = next(iter(row.values()), None)
                if first:
                    rec["min"] += first[0] + first[2]
                    rec["dk"] += first[1] + first[3]
                for mate, v in row.items():
                    m = rec["mates"].setdefault(mate, [0.0, 0.0])
                    m[0] += v[0]
                    m[1] += v[1]
    for t in teams.values():
        for rec in t.values():
            rec["min"] = round(rec["min"], 1)
            rec["dk"] = round(rec["dk"], 2)
            # Without = everything else he played, including games the teammate missed.
            for mate, m in rec["mates"].items():
                rec["mates"][mate] = [round(m[0], 2), round(m[1], 2), round(rec["min"] - m[0], 2), round(rec["dk"] - m[1], 2)]
    out = {"through": through, "games": n, "teams": teams}
    with open(os.path.join(D, "wowy.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
    print("wowy:", through, n, "games")


if __name__ == "__main__":
    main()
