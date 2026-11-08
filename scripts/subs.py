"""Who subs in for whom: every substitution in this season's games, from ESPN play-by-play.

Saves data/subs.json: {"games": {event_id: date}, "subs": [[date, team, player_in, player_out], ...]}.
Each run adds only games it has not read yet. Used by projections.py and brief.py to send a
missing player's minutes to the teammates who actually take his minutes.
"""
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, fix_team  # noqa: E402

OUT = os.path.join(D, "subs.json")
START = date(2026, 10, 20)
SB = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates="
SUM = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event="


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
        return json.load(r)


def main():
    data = load_json(OUT, {"games": {}, "subs": []})
    today = (datetime.now(timezone.utc) - timedelta(hours=5)).date()
    d = START
    while d < today:
        try:
            sb = get(SB + d.strftime("%Y%m%d"))
        except Exception as e:
            print("subs: scoreboard %s failed (%s)" % (d, e))
            d += timedelta(1)
            continue
        for e in sb.get("events", []):
            if e["id"] in data["games"] or not e["status"]["type"].get("completed"):
                continue
            try:
                s = get(SUM + e["id"])
            except Exception as ex:
                print("subs: game %s failed (%s)" % (e["id"], ex))
                continue
            tid = {}
            for c in s.get("header", {}).get("competitions", [{}])[0].get("competitors", []):
                tid[str(c["team"]["id"])] = fix_team(c["team"]["abbreviation"])
            n = 0
            for p in s.get("plays", []):
                t = p.get("text", "")
                if " enters the game for " not in t:
                    continue
                a, b = t.split(" enters the game for ", 1)
                team = tid.get(str((p.get("team") or {}).get("id", "")), "")
                data["subs"].append([d.isoformat(), team, a.strip(), b.strip().rstrip(".")])
                n += 1
            data["games"][e["id"]] = d.isoformat()
        d += timedelta(1)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
    print("subs: %d games, %d substitutions" % (len(data["games"]), len(data["subs"])))


if __name__ == "__main__":
    main()
