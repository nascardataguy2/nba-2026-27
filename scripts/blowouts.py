"""Blowout notes for the player log: big or small DraftKings games that came from a blowout.

Reads the Games tab file (data/games/DATE.json, written by timelines.py from ESPN play-by-play).
Garbage time there = a lead of 20+ in the fourth quarter or overtime. For every game with at
least MIN_GARBAGE minutes of it:
  - Boosted: a player who scored at least 10 DK points AND at least 40% of his DK points in
    garbage time. His line looks better than his normal role.
  - Cut short: a player who started or averaged 24+ minutes over his previous 5 games, played at
    least 5 minutes under that average, and sat most of the garbage time. His line looks worse
    than his normal role.
Notes go into data/player_log.json (kind "minutes"), last 7 days, source PBP-MMDD.

Usage: python3 scripts/blowouts.py [--date YYYY-MM-DD]   (default: yesterday, Eastern time)
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, HIST, ET, norm  # noqa: E402

MIN_GARBAGE = 4.0     # minutes of garbage time before a game counts as a blowout
BOOST_DK = 10.0       # garbage-time DK points for a "boosted" note
BOOST_SHARE = 0.40    # and this share of his night
CUT_UNDER = 5.0       # minutes under his recent average for a "cut short" note
KEEP_DAYS = 7


def wday(day):
    return datetime.strptime(day, "%Y-%m-%d").strftime("%A")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    a = ap.parse_args()
    day = a.date or str((datetime.now(ET) - timedelta(days=1)).date())
    games = load_json(os.path.join(D, "games", day + ".json"), [])
    if not games:
        print("blowouts: no games file for", day)
        return
    recent = load_json(os.path.join(HIST, "results.json"), {})
    mmdd = day[5:7] + day[8:10]
    src = "PBP-" + mmdd
    exp = str(datetime.strptime(day, "%Y-%m-%d").date() + timedelta(days=KEEP_DAYS))
    out = []
    for g in games:
        win = g.get("garbage") or []
        gmin = sum(b - a_ for a_, b in win) / 60.0
        if gmin < MIN_GARBAGE:
            continue
        away, home = g["away"], g["home"]
        fa, fh = g["final"]
        margin = abs(fa - fh)
        winner = away if fa > fh else home
        for p in g.get("players", []):
            team, name = p["team"], p["player"]
            opp = home if team == away else away
            res = "win" if team == winner else "loss"
            gdk = sum(dk for t, dk in p.get("ev", []) if any(a_ <= t <= b for a_, b in win))
            dk, mins = p.get("dk") or 0.0, p.get("min") or 0.0
            what = "a %d-point %s against %s on %s" % (margin, res, opp, wday(day))
            if gdk >= BOOST_DK and dk > 0 and gdk / dk >= BOOST_SHARE:
                out.append({"player": name, "team": team, "date": day, "kind": "minutes", "expires": exp, "src": src,
                            "text": "%s scored %.1f of his %.1f DraftKings points in garbage time of %s, when the lead was 20 or more late. "
                                    "His line is bigger than his normal role; expect less in a close game." % (name, gdk, dk, what)})
                continue
            prev = sorted([x for x in recent.get(norm(name), []) if x.get("date", "") < day and x.get("min", 0) > 0],
                          key=lambda x: x["date"])[-5:]
            if len(prev) < 3:
                continue
            avg = sum(x["min"] for x in prev) / len(prev)
            sat = gmin - (p.get("garbage_min") or 0.0)
            if (p.get("start") or avg >= 24) and mins > 0 and avg - mins >= CUT_UNDER and sat >= 0.6 * gmin:
                out.append({"player": name, "team": team, "date": day, "kind": "minutes", "expires": exp, "src": src,
                            "text": "%s played %.0f minutes in %s, %.0f under his average over his previous %d games, and sat "
                                    "most of the %.0f minutes of garbage time. His %.1f DraftKings points likely undersell his normal role."
                                    % (name, mins, what, avg - mins, len(prev), gmin, dk)})
    srcs = load_json(os.path.join(D, "sources.json"), [])
    if out and not any(s.get("id") == src for s in srcs):
        srcs.append({"id": src, "date": str(datetime.now(ET).date()), "show": "ESPN play-by-play",
                     "title": "Blowout minutes and garbage-time scoring for %s" % day,
                     "url": "https://www.espn.com/nba/scoreboard/_/date/%s" % day.replace("-", "")})
        json.dump(srcs, open(os.path.join(D, "sources.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tmp = os.path.join(HIST, "_blowouts.json")
    json.dump(out, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if out:
        subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "playerlog.py"), "--add", tmp], check=False)
    os.remove(tmp)
    print("blowouts: %s %d notes" % (day, len(out)))


if __name__ == "__main__":
    main()
