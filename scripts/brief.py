#!/usr/bin/env python3
"""Slate brief for the front page (data/brief.json): what you need to know about tonight's slate.

Everything is built from the day's data on every run, so nothing goes stale:
  - games: total, spread, implied points, tags (highest total, blowout risk, close game,
    back-to-back), key outs and questionable players, and one line on what matters
  - changed: injury statuses that appeared or changed after the first report of the day
  - sits: tonight's outs that matter, the teammates who pick up minutes, newest first
  - trending: hot and cold players and minutes up or down (box scores, last 3 games vs before)
  - field: our top Own% plays and low-owned leverage plays
  - last: a short recap of the last game night (top DK games, in-game injuries, minutes surprises)
State for "changed" is kept in data/brief_state.json.
"""
import glob
import json
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, norm  # noqa: E402

ET = ZoneInfo("America/New_York")


def r1(x):
    return round(float(x), 1)


def main():
    doc = load_json(os.path.join(D, "projections.json"), {})
    day = doc.get("date")
    if not day:
        return
    games = [g for g in doc.get("games", []) if g.get("slate") in ("main", "late", None)]
    teams = {t for g in games for t in (g["away"], g["home"])}
    players = [p for p in doc.get("players", []) if p["team"] in teams]
    byname = {norm(p["player"]): p for p in players}

    # Box scores: every game this season, by (team, player).
    box, dates = {}, set()
    for f in glob.glob(os.path.join(D, "proj_history", "box", "*.json")):
        for x in load_json(f, []):
            if x.get("date", "") < day:
                box.setdefault((x["team"], norm(x["player"])), []).append(x)
                dates.add(x["date"])
    for v in box.values():
        v.sort(key=lambda x: x["date"])

    def games_of(team, name):
        k = (team, norm(name))
        if k not in box:
            c = [kk for kk in box if kk[0] == team and kk[1].split(" ")[-1] == k[1].split(" ")[-1]]
            k = c[0] if len(c) == 1 else k
        return box.get(k, [])

    def recent_min(team, name, n=3):
        g = [x for x in games_of(team, name) if x["min"] > 0][-n:]
        return sum(x["min"] for x in g) / len(g) if g else 0.0

    yday = str(datetime.strptime(day, "%Y-%m-%d").date() - timedelta(days=1))
    played_yday = {x["team"] for v in box.values() for x in v if x["date"] == yday}
    base = load_json(os.path.join(D, "proj_history", day + ".json"), {})
    plog = load_json(os.path.join(D, "player_log.json"), [])
    official = load_json(os.path.join(D, "injury_report.json"), {})
    offp = official.get("players", []) if official.get("date") == day else []
    pending = [t for t in official.get("pending", []) if t in teams] if official.get("date") == day else sorted(teams)

    def last_injury(name):
        e = [x for x in plog if norm(x["player"]) == norm(name) and x["kind"] == "injury"]
        return max(e, key=lambda x: x["date"])["text"] if e else ""

    # --- what changed: statuses first seen after the first run of the day ---
    now = datetime.now(ET)
    spath = os.path.join(D, "brief_state.json")
    st = load_json(spath, {})
    if st.get("date") != day:
        st = {"date": day, "first": now.strftime("%-I:%M %p"), "seen": {}, "log": []}
        first_run = True
    else:
        first_run = False
    cur = {}
    for o in offp:
        if o["team"] in teams and not o.get("reason", "").startswith("G League"):
            cur[o["player"]] = (o["team"], o["status"], o.get("reason", ""))
    for o in doc.get("out", []):
        if o["team"] in teams and o["player"] not in cur:
            cur[o["player"]] = (o["team"], "Out", "")
    for name, (team, status, why) in cur.items():
        old = st["seen"].get(name)
        if old != status:
            if not first_run:
                st["log"].append({"player": name, "team": team, "status": status, "was": old or "", "why": why,
                                  "time": now.strftime("%-I:%M %p")})
            st["seen"][name] = status
    json.dump(st, open(spath, "w"), indent=1, ensure_ascii=False)
    changed = list(reversed(st["log"]))[:10]
    new_today = {c["player"] for c in st["log"]}

    # --- outs that matter tonight (played 12+ minutes a game recently) ---
    outs = []
    for o in doc.get("out", []):
        if o["team"] not in teams:
            continue
        m = recent_min(o["team"], o["player"])
        if m >= 12:
            outs.append({"player": o["player"], "team": o["team"], "min": r1(m), "note": last_injury(o["player"]) or o.get("note", "")})
    outs.sort(key=lambda o: -o["min"])

    # --- If he sits: per team, tonight's outs and the teammates projected above their recent minutes ---
    sits = []
    for t in sorted({o["team"] for o in outs if o["min"] >= 15}):
        tout = [o for o in outs if o["team"] == t and o["min"] >= 15]
        gain = []
        for p in players:
            if p["team"] != t or p["min"] <= 0:
                continue
            g = [x for x in games_of(t, p["player"]) if x["min"] > 0][-3:]
            if len(g) >= 2:
                ref = sum(x["min"] for x in g) / len(g)
            else:
                ref = (base.get(norm(p["player"])) or {}).get("base_min") or p["min"]
            d = p["min"] - ref
            if d >= 3:
                gain.append((d, ref, p))
        gain.sort(key=lambda x: -x[0])
        if not gain:
            continue
        sits.append({"team": t, "outs": [{"player": o["player"], "min": o["min"], "note": o["note"], "new": o["player"] in new_today} for o in tout],
                     "new": any(o["player"] in new_today for o in tout), "lost": r1(sum(o["min"] for o in tout)),
                     "benefits": [{"player": p["player"], "plus": r1(d), "recent": r1(ref), "min": r1(p["min"]), "dk": r1(p["dk"]), "salary": p.get("salary")} for d, ref, p in gain[:3]]})
    sits.sort(key=lambda s: (not s["new"], -s["lost"]))

    # --- game cards ---
    maxou = max((g.get("ou") or 0) for g in games) if games else 0
    minou = min((g.get("ou") or 999) for g in games) if games else 0
    cards = []
    for g in sorted(games, key=lambda g: (g.get("time") or "", -(g.get("ou") or 0))):
        tags = []
        if g.get("ou") == maxou and len(games) > 1:
            tags.append("Highest total")
        if g.get("ou") == minou and len(games) > 2:
            tags.append("Lowest total")
        if (g.get("line") or 0) >= 9:
            tags.append("Blowout risk")
        elif (g.get("line") or 99) <= 2.5:
            tags.append("Close game")
        b2b = [t for t in (g["away"], g["home"]) if t in played_yday]
        if b2b:
            tags.append(("Both teams" if len(b2b) == 2 else b2b[0]) + " on a back-to-back")
        side = {}
        for t in (g["away"], g["home"]):
            side[t] = {
                "out": [{"player": o["player"], "min": o["min"]} for o in outs if o["team"] == t][:4],
                "q": [{"player": p["player"], "min": r1(p["min"])} for p in players if p["team"] == t and p.get("q")][:4],
            }
        gp = [p for p in players if p["team"] in (g["away"], g["home"]) and p.get("dk")]
        line = ""
        gs = sorted([s for s in sits if s["team"] in (g["away"], g["home"])], key=lambda s: -s["lost"])
        if gs:
            s = gs[0]
            names = [b["player"] for b in s["benefits"][:2]]
            who = " and ".join(o["player"] for o in s["outs"][:2])
            line = "%s %s out, so %s should play more than usual." % (who, "are" if len(s["outs"]) > 1 else "is", " and ".join(names))
        elif gp:
            top = max(gp, key=lambda p: p["dk"])
            line = "%s has the top projection in this game at %.1f DK points." % (top["player"], top["dk"])
        cards.append({"away": g["away"], "home": g["home"], "time": g.get("time"), "slate": g.get("slate"),
                      "ou": g.get("ou"), "fav": g.get("fav"), "line": g.get("line"),
                      "away_pts": g.get("away_pts"), "home_pts": g.get("home_pts"),
                      "tags": tags, "teams": side, "key": line})

    # --- trending: last 3 games vs before (needs 2+ earlier games) ---
    hot, mins = [], []
    for p in players:
        if p["min"] < 10:
            continue
        g = [x for x in games_of(p["team"], p["player"]) if x["min"] > 0]
        if len(g) < 5:
            continue
        a, b = g[-3:], g[:-3]
        ad, bd = sum(x["dk"] for x in a) / 3, sum(x["dk"] for x in b) / len(b)
        am, bm = sum(x["min"] for x in a) / 3, sum(x["min"] for x in b) / len(b)
        if abs(ad - bd) >= 8 and bd > 0 and abs(ad - bd) / bd >= 0.25:
            hot.append({"player": p["player"], "team": p["team"], "kind": "hot" if ad > bd else "cold",
                        "last": r1(ad), "before": r1(bd), "n": len(b)})
        if abs(am - bm) >= 5:
            mins.append({"player": p["player"], "team": p["team"], "kind": "up" if am > bm else "down",
                         "last": r1(am), "before": r1(bm), "n": len(b)})
    hot.sort(key=lambda x: -abs(x["last"] - x["before"]))
    mins.sort(key=lambda x: -abs(x["last"] - x["before"]))

    # --- where the field is going (our Own% estimate) ---
    owned = [p for p in players if p.get("own") is not None and p.get("salary")]
    chalk = sorted(owned, key=lambda p: -p["own"])[:4]
    lev = sorted([p for p in owned if p["own"] < 10 and p["min"] >= 22], key=lambda p: -(p["dk"] / p["salary"]))[:3]
    fp = lambda p: {"player": p["player"], "team": p["team"], "own": p["own"], "dk": r1(p["dk"]), "salary": p["salary"]}

    # --- last night ---
    last = {}
    prev = max([d for d in dates if d < day] or [""])
    if prev:
        rows = [x for v in box.values() for x in v if x["date"] == prev]
        top = sorted(rows, key=lambda x: -x["dk"])[:5]
        pb = load_json(os.path.join(D, "proj_history", prev + ".json"), {})
        surprise = []
        for x in rows:
            b = pb.get(norm(x["player"]))
            if b and b.get("min", 0) > 0 and abs(x["min"] - b["min"]) >= 12:
                surprise.append({"player": x["player"], "team": x["team"], "min": x["min"], "proj": r1(b["min"])})
        surprise.sort(key=lambda s: -abs(s["min"] - s["proj"]))
        import re
        hurt = re.compile(r"\b(left (the game|the floor|early|in the|after|with|on [A-Z]|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|leaving|exited|did not return|hurt his|got hurt|was hurt|went down|helped off|tweaked|rolled his)", re.I)
        inj = [{"player": e["player"], "team": e["team"], "text": e["text"]} for e in plog
               if e["date"] in (prev, day) and e["kind"] == "injury" and hurt.search(e["text"])]
        last = {"date": prev, "top": [{"player": x["player"], "team": x["team"], "dk": x["dk"], "min": x["min"],
                                       "pts": x["pts"], "reb": x["reb"], "ast": x["ast"]} for x in top],
                "surprise": surprise[:4], "injuries": inj[:4]}

    out = {"date": day, "updated": doc.get("updated"), "games": len(games), "pending": pending,
           "first_report": st.get("first"), "cards": cards, "changed": changed, "sits": sits[:6],
           "hot": hot[:5], "minutes": mins[:5], "chalk": [fp(p) for p in chalk], "leverage": [fp(p) for p in lev],
           "last": last}
    json.dump(out, open(os.path.join(D, "brief.json"), "w"), indent=1, ensure_ascii=False)
    print("brief:", day, len(cards), "games,", len(sits), "if-he-sits,", len(changed), "changes,", len(hot), "hot/cold,", len(mins), "minutes")


if __name__ == "__main__":
    main()
