"""Save last night's actual minutes and DK points from ESPN box scores, then grade
our projections against the public baseline.

Writes data/proj_history/results.json and data/proj_history/accuracy.json.
Usage: python3 scripts/results.py [--date YYYY-MM-DD]   (default: yesterday, ET)
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import get, norm, fix_team, load_json, HIST, ESPN_SB, ET  # noqa: E402

SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event="


def dk_points(s):
    pts, reb, ast, stl, blk, to, tpm = s
    dk = pts + 0.5 * tpm + 1.25 * reb + 1.5 * ast + 2 * stl + 2 * blk - 0.5 * to
    tens = sum(1 for v in (pts, reb, ast, stl, blk) if v >= 10)
    if tens >= 3:
        dk += 3
    elif tens >= 2:
        dk += 1.5
    return round(dk, 2)


def num(x):
    try:
        return float(str(x).split("-")[0])
    except ValueError:
        return 0.0


def day_box(day):
    out = []
    sb = json.loads(get(ESPN_SB + day.replace("-", "")))
    for e in sb.get("events", []):
        if e["status"]["type"]["name"] != "STATUS_FINAL":
            continue
        box = json.loads(get(SUMMARY + e["id"])).get("boxscore", {})
        for side in box.get("players", []):
            team = fix_team(side["team"]["abbreviation"])
            st = side["statistics"][0]
            keys = st.get("keys") or st.get("names")
            for a in st.get("athletes", []):
                if a.get("didNotPlay") or not a.get("stats"):
                    continue
                v = dict(zip(keys, a["stats"]))
                mins = num(v.get("minutes", 0))
                if mins <= 0:
                    continue
                line = (num(v.get("points")), num(v.get("rebounds")), num(v.get("assists")), num(v.get("steals")),
                        num(v.get("blocks")), num(v.get("turnovers")),
                        num(v.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "0-0")))
                out.append({"player": a["athlete"]["displayName"], "team": team, "date": day, "min": mins,
                            "dk": dk_points(line), "start": bool(a.get("starter")),
                            "pos": (a["athlete"].get("position") or {}).get("abbreviation", ""),
                            "pts": line[0], "reb": line[1], "ast": line[2], "stl": line[3], "blk": line[4],
                            "to": line[5], "tpm": line[6]})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    args = ap.parse_args()
    et = datetime.now(ET)
    day = args.date or (et - timedelta(days=1)).strftime("%Y-%m-%d")
    os.makedirs(HIST, exist_ok=True)
    res = load_json(os.path.join(HIST, "results.json"), {})
    rows = day_box(day)
    # Full box score lines for the season stats table (one file per night).
    if rows:
        os.makedirs(os.path.join(HIST, "box"), exist_ok=True)
        with open(os.path.join(HIST, "box", day + ".json"), "w", encoding="utf-8") as fh:
            json.dump(rows, fh, indent=0, ensure_ascii=False)
    rows = [{k: r[k] for k in ("player", "team", "date", "min", "dk", "start")} for r in rows]
    for r in rows:
        lst = [x for x in res.get(norm(r["player"]), []) if x["date"] != day]
        lst.append(r)
        res[norm(r["player"])] = sorted(lst, key=lambda x: x["date"])[-15:]
    with open(os.path.join(HIST, "results.json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=0, ensure_ascii=False)

    # Grade every day that has both a projection snapshot and results.
    acc = load_json(os.path.join(HIST, "accuracy.json"), {"days": {}})
    for fn in sorted(os.listdir(HIST)):
        if len(fn) != 15 or not fn.startswith("20"):
            continue
        d = fn[:10]
        proj = load_json(os.path.join(HIST, fn), {})
        n = eb = eo = ed = 0
        for k, p in proj.items():
            act = next((x for x in res.get(k, []) if x["date"] == d), None)
            if not act:
                continue
            n += 1
            eb += abs(p["base_min"] - act["min"])
            eo += abs(p["min"] - act["min"])
            ed += abs(p["dk"] - act["dk"])
        if n:
            acc["days"][d] = {"players": n, "base_min_miss": round(eb / n, 2), "our_min_miss": round(eo / n, 2), "dk_miss": round(ed / n, 2)}
    days = acc["days"]
    if days:
        tot = sum(v["players"] for v in days.values())
        acc["summary"] = {"days": len(days), "players": tot,
                          "our_min_miss": round(sum(v["our_min_miss"] * v["players"] for v in days.values()) / tot, 1),
                          "base_min_miss": round(sum(v["base_min_miss"] * v["players"] for v in days.values()) / tot, 1),
                          "dk_miss": round(sum(v["dk_miss"] * v["players"] for v in days.values()) / tot, 1)}
    with open(os.path.join(HIST, "accuracy.json"), "w", encoding="utf-8") as fh:
        json.dump(acc, fh, indent=1)
    print("results:", day, len(rows), "players;", acc.get("summary"))


if __name__ == "__main__":
    main()
