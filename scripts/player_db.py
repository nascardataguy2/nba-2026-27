"""Keep data/players.json (the Players database) current every run.

Before 11/19 this file was the 344-player preseason list and nothing ever added players or
changed teams; only the daily context run edited existing statuses and notes. This script
rebuilds every field from real data each run:

  team    - the team he played for in his most recent game (box scores), so trades show up
  role    - starter or bench over his last five games, with box position
  minutes - average over his last five games plus his last game
  usage   - our estimate from box scores over his last five games:
            (FGA + 0.44*FTA + TO) share of the team's, scaled to his minutes
  status  - the NBA's official injury report when he is listed; otherwise a recent hand-written
            status (dated within 2 days) is kept; otherwise "Not on today's injury report"
  note    - the newest current player-log note (the one that gives a reason); if he has none,
            a hand-written note from the last 7 days is kept
  source  - where that note came from

Everyone who played in the last 21 days is included, plus everyone already in the file.
Usage: python3 scripts/player_db.py
"""
import glob
import json
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, HIST, ET, norm  # noqa: E402

RECENT_DAYS = 21
WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def md(d):
    return "%d/%d" % (int(d[5:7]), int(d[8:10]))


def src_date(src):
    """Date of a source id like ESPN-1119 or WEB-1118b, or None."""
    try:
        tail = src.rsplit("-", 1)[1][:4]
        y = datetime.now(ET).year
        d = datetime(y, int(tail[:2]), int(tail[2:4])).date()
        if d > datetime.now(ET).date() + timedelta(days=1):
            d = d.replace(year=y - 1)
        return d
    except Exception:
        return None


def main():
    today = datetime.now(ET).date()
    old = load_json(os.path.join(D, "players.json"), [])
    old_by = {norm(p["player"]): p for p in old}

    # Every box score row, newest first per player; team totals per game for usage.
    rows, team_tot = {}, {}
    for f in sorted(glob.glob(os.path.join(HIST, "box", "*.json"))):
        for r in load_json(f, []):
            if not r.get("min"):
                continue
            rows.setdefault(norm(r["player"]), []).append(r)
            k = (r["date"], r["team"])
            t = team_tot.setdefault(k, [0.0, 0.0])
            t[0] += (r.get("fga") or 0) + 0.44 * (r.get("fta") or 0) + (r.get("to") or 0)
            t[1] += r["min"]
    for k in rows:
        rows[k].sort(key=lambda r: r["date"], reverse=True)
    team_dates = {}
    for (d, t) in team_tot:
        team_dates.setdefault(t, []).append(d)

    rep = load_json(os.path.join(D, "injury_report.json"), {})
    inj = {}
    if rep.get("date") == str(today):
        for x in rep.get("players", []):
            inj[norm(x["player"])] = x

    log = load_json(os.path.join(D, "player_log.json"), [])
    newest = {}
    for e in log:
        if e.get("expires") and e["expires"] < str(today):
            continue
        k = norm(e["player"])
        if k not in newest or e["date"] >= newest[k]["date"]:
            newest[k] = e

    cutoff = str(today - timedelta(days=RECENT_DAYS))
    keys = [norm(p["player"]) for p in old]
    keys += [k for k, v in rows.items() if v[0]["date"] >= cutoff and k not in old_by]

    out, added, moved = [], [], []
    for k in keys:
        o = old_by.get(k, {})
        g = rows.get(k, [])
        name = g[0]["player"] if g else o.get("player")
        p = {"player": name}
        if g:
            last5 = g[:5]
            p["team"] = g[0]["team"]
            if o and o.get("team") and o["team"] != p["team"]:
                moved.append("%s %s->%s" % (name, o["team"], p["team"]))
            st = sum(1 for r in last5 if r.get("start"))
            pos = g[0].get("pos") or ""
            if st >= 4:
                role = "Starter"
            elif st == 0:
                role = "Bench"
            else:
                role = "Started %d of last %d" % (st, len(last5))
            p["role"] = role + (" (%s)" % pos if pos else "")
            avg = sum(r["min"] for r in last5) / len(last5)
            d0 = g[0]["date"]
            wd = WD[datetime.strptime(d0, "%Y-%m-%d").weekday()]
            p["minutes"] = "%.0f avg last %d; %.0f on %s %s" % (avg, len(last5), g[0]["min"], wd, md(d0))
            num = den = 0.0
            for r in last5:
                t = team_tot.get((r["date"], r["team"]))
                if t and t[0] and r["min"]:
                    num += ((r.get("fga") or 0) + 0.44 * (r.get("fta") or 0) + (r.get("to") or 0)) * (t[1] / 5.0)
                    den += r["min"] * t[0]
            p["usage"] = ("%.0f%% (our estimate, last %d games)" % (100 * num / den, len(last5))) if den else "Not enough games"
            missed = [d for d in team_dates.get(p["team"], []) if d > g[0]["date"]]
            if missed:
                gone = "last game" if len(missed) == 1 else "last %d games" % len(missed)
                p["minutes"] = "Missed his team's %s; before that %s" % (gone, p["minutes"])
        else:
            p["team"] = o.get("team", "")
            p["role"] = o.get("role", "")
            p["minutes"] = "No games this season in our box scores"
            p["usage"] = o.get("usage", "")

        x = inj.get(k)
        osd = src_date(o.get("source", ""))
        if x:
            reason = (x.get("reason") or "").strip()
            p["status"] = "%s%s (NBA injury report, %s)" % (x["status"], (": " + reason) if reason else "", rep.get("report", ""))
        elif o.get("status") and osd and (today - osd).days <= 2:
            p["status"] = o["status"]
        else:
            p["status"] = "Not on today's injury report"

        # The daily context run sometimes re-dates "source" when it only edits status, so the
        # hand-written note's own age is unknown; the newest player-log note wins when it is recent.
        e = newest.get(k)
        if e and e["date"] >= str(today - timedelta(days=7)):
            p["note"], p["source"] = e["text"], e.get("src", "")
        elif o.get("note") and osd and (today - osd).days <= 7:
            p["note"], p["source"] = o["note"], o.get("source", "")
        elif e:
            p["note"], p["source"] = e["text"], e.get("src", "")
        else:
            p["note"], p["source"] = "", ""
        if k not in old_by:
            added.append(name)
        out.append(p)

    out.sort(key=lambda p: (p.get("team") or "ZZZ", p["player"]))
    json.dump(out, open(os.path.join(D, "players.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("player_db: %d players (%d added, %d team changes)%s" % (
        len(out), len(added), len(moved), ("; moved: " + ", ".join(moved[:10])) if moved else ""))


if __name__ == "__main__":
    main()
