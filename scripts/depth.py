#!/usr/bin/env python3
"""Rebuild each team's depth chart (data/teams.json) from real games.

Starters: who started the team's most recent game, with anyone ruled out
tonight swapped for the player who most recently started in his place (or the
top bench player by minutes). Bench: everyone else who has played, ordered by
average minutes over the team's last three games. The numbers in parentheses
are average minutes in the games each player played this season.

Keeps each team's coach and notes. Writes "depth_through" (last game date) and
"out" (players ruled out tonight). Runs after results.py has saved last night's
box scores and after official_injuries.py.
"""
import glob
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
BOX = os.path.join(D, "proj_history", "box")
ET = ZoneInfo("America/New_York")


def norm(s):
    import re
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z ]", "", s.replace("-", " "))
    s = re.sub(r"\s+", " ", s).strip()
    for suf in (" iii", " ii", " iv", " jr", " sr"):
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
    return s


def load(p, d):
    try:
        return json.load(open(p))
    except Exception:
        return d


def outs_tonight(day):
    out = set()
    ir = load(os.path.join(D, "injury_report.json"), {})
    if ir.get("date") == day:
        for p in ir.get("players", []):
            if p["status"] in ("Out", "Doubtful"):
                out.add(norm(p["player"]))
    for a in load(os.path.join(D, "proj_adjust.json"), []):
        if a.get("out") and a.get("from", "0000") <= day <= a.get("until", "9999"):
            out.add(norm(a["player"]))
    # Long injuries from our notes (a one-night "Out Friday" note should not stick).
    import re
    for p in load(os.path.join(D, "players.json"), []):
        st = str(p.get("status", "")).lower()
        if st.startswith("out") and re.search(r"week|month|season|surgery|indefinite|timeline", st):
            out.add(norm(p["player"]))
    return out


def main():
    day = datetime.now(ET).strftime("%Y-%m-%d")
    files = sorted(glob.glob(os.path.join(BOX, "*.json")))
    rows = []
    for f in files:
        rows += load(f, [])
    if not rows:
        print("depth: no box scores yet")
        return
    out = outs_tonight(day)
    alias = {"ronald holland": "ron holland", "nicolas claxton": "nic claxton", "moe wagner": "mo wagner"}
    site_names = {norm(p["player"]): p["player"] for p in load(os.path.join(D, "players.json"), [])}
    teams = load(os.path.join(D, "teams.json"), [])
    by_team = {}
    for r in rows:
        if r.get("min", 0) > 0:
            by_team.setdefault(r["team"], []).append(r)
    changed = 0
    for t in teams:
        g = by_team.get(t["team"])
        if not g:
            continue
        dates = sorted({r["date"] for r in g})
        last3 = set(dates[-3:])
        name = dict(site_names)
        mins, recent, pos = {}, {}, {}
        for r in g:
            k = alias.get(norm(r["player"]), norm(r["player"]))
            name.setdefault(k, r["player"])
            mins.setdefault(k, []).append(r["min"])
            if r["date"] in last3:
                recent.setdefault(k, []).append(r["min"])
            pos[k] = r.get("pos", "")
        avg = {k: sum(v) / len(v) for k, v in mins.items()}
        rec = {k: sum(v) / len(v) for k, v in recent.items()}
        # most recent game this player started
        last_start = {}
        for r in g:
            if r.get("start"):
                k = alias.get(norm(r["player"]), norm(r["player"]))
                last_start[k] = max(last_start.get(k, ""), r["date"])
        lastgame = dates[-1]
        # Regular starters: most starts over the last three games (rest nights do not
        # reset the lineup), then most recent start, then minutes.
        starts3 = {}
        for r in g:
            if r.get("start") and r["date"] in last3:
                k = alias.get(norm(r["player"]), norm(r["player"]))
                starts3[k] = starts3.get(k, 0) + 1
        cand = [k for k in avg if k not in out and (k in starts3 or k in rec)]
        cand.sort(key=lambda k: (starts3.get(k, 0), last_start.get(k, ""), rec.get(k, 0)), reverse=True)
        keep = cand[:5]
        bench = [k for k in rec if k not in keep and k not in out and rec[k] >= 8]
        bench.sort(key=lambda k: -rec[k])
        bench = bench[:7]
        fmt = lambda k: "%s (%d)" % (name[k], round(avg[k]))
        t["starters"] = ", ".join(fmt(k) for k in keep)
        t["bench"] = ", ".join(fmt(k) for k in bench)
        bc = [k for k in bench if pos.get(k) == "C"]
        if bc:
            t["backup_c"] = name[bc[0]]
        team_out = sorted({name[k] for k in avg if k in out})
        t["out"] = ", ".join(team_out)
        t["depth_through"] = lastgame
        t["games"] = len(dates)
        changed += 1
    json.dump(teams, open(os.path.join(D, "teams.json"), "w"), indent=1, ensure_ascii=False)
    print("depth: updated", changed, "teams through", max(r["date"] for r in rows))


if __name__ == "__main__":
    main()
