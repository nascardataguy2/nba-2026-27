"""Build tonight's nbadfs projections.

Baseline: public SportsLine player projections (minutes and stat line) and
DailyFantasyFuel (DK salary, position, injury flag, starter flag, Vegas).
Our layer: live outs with minutes handed to teammates, manual notes from our
database (data/proj_adjust.json), recent actual minutes from box scores, and
each team scaled to 240 minutes. Stats and DK points scale with minutes.

Writes data/projections.json (public) and data/proj_history/DATE.json
(minutes only, used later to grade accuracy).

Usage: python3 scripts/projections.py [--date YYYY-MM-DD] [--sl file.html] [--dff file.html]
"""
import argparse
import html
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
HIST = os.path.join(D, "proj_history")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
SL_URL = "https://www.sportsline.com/nba/expert-projections/simulation/"
DFF_URL = "https://www.dailyfantasyfuel.com/nba/projections/"
ESPN_SB = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates="

TEAM = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "PHO": "PHX", "UTAH": "UTA", "WSH": "WAS",
        "BRK": "BKN", "BK": "BKN", "CHO": "CHA", "NOR": "NOP", "SAN": "SAS", "GSW": "GSW", "NYK": "NYK"}
STATS = ("pts", "reb", "ast", "stl", "blk", "to")
MAX_MIN = 42.0


def fix_team(t):
    t = (t or "").strip().upper()
    return TEAM.get(t, t)


ALIAS = {"ronald holland": "ron holland", "nicolas claxton": "nic claxton", "moe wagner": "mo wagner"}


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z ]", "", s.replace("-", " "))
    s = re.sub(r"\s+", " ", s).strip()
    for suf in (" iii", " ii", " iv", " jr", " sr"):
        if s.endswith(suf):
            s = s[: -len(suf)].strip()
    return ALIAS.get(s, s)


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def f(x, d=0.0):
    try:
        return float(str(x).replace(",", ""))
    except (TypeError, ValueError):
        return d


def parse_sl(page):
    """SportsLine table rows -> list of dicts."""
    body = re.search(r'<tbody class="sl-dt-tbody">(.*?)</tbody>', page, re.S)
    if not body:
        raise SystemExit("SportsLine table not found")
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", body.group(1), re.S):
        c = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(c) < 22:
            continue
        name = c[0].replace("`", "'")
        rows.append({"player": name, "pos": c[1], "team": fix_team(c[2]), "game": c[3],
                     "dk": f(c[5]), "pts": f(c[8]), "min": f(c[9]), "ast": f(c[12]), "reb": f(c[13]),
                     "blk": f(c[16]), "stl": f(c[17]), "to": f(c[18]), "fga": f(c[11]),
                     "fta": (f(c[19]) / f(c[20])) if f(c[20]) > 0 else 0.0})
    return rows


def parse_dff(page):
    out = []
    for attrs, body in re.findall(r'<tr class="[^"]*projections-listing[^"]*"([^>]*)>(.*?)</tr>', page, re.S):
        a = {k: html.unescape(v) for k, v in re.findall(r'data-([a-z_0-9]+)=\s*"([^"]*)"', attrs)}
        m = re.search(r'<td>\s*([^<]*?)\s*</td>\s*<td class="border-left-1', body)
        stxt = (m.group(1) if m else "").strip().upper()
        if not a.get("name"):
            continue
        pos = a.get("pos", "")
        if a.get("pos_alt") and a["pos_alt"] not in pos:
            pos = pos + "/" + a["pos_alt"]
        out.append({"player": a["name"], "team": fix_team(a.get("team")), "opp": fix_team(a.get("opp")),
                    "home": a.get("loc") == "vs", "date": a.get("start_date", ""), "pos": pos,
                    "salary": int(f(a.get("salary"))), "inj": a.get("inj", ""), "start": a.get("depth_rank") == "1" or stxt in ("EXP.", "EXP", "YES", "Y", "CONF.", "CONF", "CONFIRMED", "STARTER"),
                    "spread": f(a.get("spread"), None), "ou": f(a.get("ou"), None), "tm_pts": f(a.get("proj_score"), None)})
    return out


def espn_games(day):
    """Tonight's games from ESPN: {team: {opp, home, time}}."""
    games = {}
    try:
        d = json.loads(get(ESPN_SB + day.replace("-", "")))
    except Exception:
        return games
    for e in d.get("events", []):
        comp = e["competitions"][0]
        teams = {c["homeAway"]: fix_team(c["team"]["abbreviation"]) for c in comp["competitors"]}
        t = e.get("date", "")
        for side, other in (("home", "away"), ("away", "home")):
            games[teams[side]] = {"opp": teams[other], "home": side == "home", "time": t}
    return games


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def spread_minutes(team_rows, amount, skip, cap=None):
    """Give `amount` minutes to teammates in proportion to their minutes, capped at MAX_MIN."""
    cap = cap or MAX_MIN
    left = amount
    for _ in range(8):
        pool = [r for r in team_rows if r["min"] > 0 and r["player"] not in skip and r["min"] < cap]
        tot = sum(r["min"] for r in pool)
        if left <= 0.05 or tot <= 0:
            break
        given = 0.0
        for r in pool:
            add = min(left * r["min"] / tot, cap - r["min"])
            r["min"] += add
            given += add
        left -= given
    return amount - left


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--sl")
    ap.add_argument("--dff")
    args = ap.parse_args()
    et = datetime.now(ET)
    day = args.date or et.strftime("%Y-%m-%d")

    try:
        sl = parse_sl(open(args.sl).read() if args.sl else get(SL_URL))
    except SystemExit:
        if datetime.now(ET).hour >= 19:
            print("No baseline table after 7 PM ET (games under way); keeping the current file.")
            return
        raise
    dff = parse_dff(open(args.dff).read() if args.dff else get(DFF_URL))
    dff = [r for r in dff if r["date"] in ("", day)]
    games = espn_games(day)
    if not sl or not dff:
        raise SystemExit("missing data: sportsline %d rows, dff %d rows" % (len(sl), len(dff)))

    dmap = {(norm(r["player"]), r["team"]): r for r in dff}
    dname = {}
    for r in dff:
        dname.setdefault(norm(r["player"]), r)
    slate = set(games) or {r["team"] for r in dff}

    adjust = [a for a in load_json(os.path.join(D, "proj_adjust.json"), []) if a.get("until", "9999") >= day and a.get("from", "0000") <= day]
    amap = {norm(a["player"]): a for a in adjust}
    recent = load_json(os.path.join(HIST, "results.json"), {})
    ours = {norm(p["player"]): p for p in load_json(os.path.join(D, "players.json"), [])}

    def status_note(name):
        p = ours.get(norm(name))
        st = (p or {}).get("status", "")
        if st.lower().startswith("out"):
            return "Ruled out tonight (" + st[3:].strip(" ();.") + ")." if st[3:].strip(" ();.") else "Ruled out tonight."
        if st and st.lower() != "healthy":
            return "Ruled out tonight. " + st.rstrip(".") + "."
        return "Ruled out tonight."

    rows = []
    for s in sl:
        if s["team"] not in slate or s["min"] <= 0:
            continue
        k = norm(s["player"])
        d = dmap.get((k, s["team"])) or dname.get(k)
        r = dict(s)
        r["base"] = s["min"]
        r["why"] = []
        r["salary"] = d["salary"] if d else None
        r["dkpos"] = d["pos"] if d else s["pos"]
        r["start"] = bool(d and d["start"])
        r["inj"] = d["inj"] if d else ""
        r["spread"] = d["spread"] if d else None
        r["ou"] = d["ou"] if d else None
        rows.append(r)

    by_team = {}
    for r in rows:
        by_team.setdefault(r["team"], []).append(r)

    out_list = []
    # 1) Live outs and our notes.
    for team, tr in by_team.items():
        for r in tr:
            a = amap.get(norm(r["player"]))
            if r["inj"] == "O" or (a and a.get("out")):
                freed = r["min"]
                r["min"] = 0.0
                out_list.append({"player": r["player"], "team": team, "note": (a or {}).get("note") or status_note(r["player"]), "freed": freed > 0})
                if freed > 0:
                    spread_minutes(tr, freed, {r["player"]})
        for r in tr:
            a = amap.get(norm(r["player"]))
            if r["min"] > 0 and a and a.get("min"):
                target = float(a["min"])
                diff = r["min"] - target
                r["min"] = target
                r["fixed"] = True
                r["why"].append(a.get("note", "Adjusted from our notes."))
                if diff > 0:
                    spread_minutes(tr, diff, {r["player"]})
    # Players DFF lists as out who were not in the baseline at all.
    seen = {norm(o["player"]) for o in out_list}
    for d in dff:
        if d["inj"] == "O" and d["team"] in slate and norm(d["player"]) not in seen:
            out_list.append({"player": d["player"], "team": d["team"], "note": status_note(d["player"])})
            seen.add(norm(d["player"]))

    # 2) Recent actual minutes (once games have been played).
    for r in rows:
        if r["min"] <= 0 or r.get("fixed"):
            continue
        g = [x for x in recent.get(norm(r["player"]), []) if x.get("team") == r["team"] and x.get("date", "") < day]
        g = sorted(g, key=lambda x: x["date"])[-3:]
        if not g:
            continue
        avg = sum(x["min"] for x in g) / len(g)
        w = min(len(g), 3) * 0.12
        r["min"] = r["min"] * (1 - w) + avg * w
        r["recent"] = round(avg, 1)

    # 3) Each team plays 240 minutes.
    for team, tr in by_team.items():
        live = [r for r in tr if r["min"] > 0]
        tot = sum(r["min"] for r in live)
        if tot < 170 or len(live) < 7:
            continue
        fixed = sum(r["min"] for r in live if r.get("fixed"))
        free = [r for r in live if not r.get("fixed")]
        ftot = sum(r["min"] for r in free)
        if tot < 240:
            # Short of 240: hand the gap out without pushing anyone past 36.
            spread_minutes(tr, 240.0 - tot, {r["player"] for r in live if r.get("fixed")}, cap=36.0)
            continue
        if ftot > 0:
            k = (240.0 - fixed) / ftot
            for r in free:
                r["min"] = min(MAX_MIN, r["min"] * k)

    # 4) Scale the stat line and DK points to the new minutes.
    for r in rows:
        ratio = r["min"] / r["base"] if r["base"] else 0
        for st in STATS + ("dk", "fga", "fta"):
            r[st] = r[st] * ratio
        delta = r["min"] - r["base"]
        if r["min"] > 0 and not r.get("fixed") and abs(delta) >= 2.0:
            outs = [o["player"] for o in out_list if o["team"] == r["team"] and o.get("freed")]
            if delta > 0 and outs:
                r["why"].append("More minutes with " + " and ".join(outs[:2]) + " out.")
            elif r.get("recent") is not None:
                r["why"].append("Moved toward his recent minutes (%s a game)." % r["recent"])

    # Games block.
    gm = {}
    for d in dff:
        if d["team"] not in slate:
            continue
        home = d["home"]
        h, a = (d["team"], d["opp"]) if home else (d["opp"], d["team"])
        g = gm.setdefault((a, h), {"away": a, "home": h, "ou": d["ou"], "away_pts": None, "home_pts": None, "time": ""})
        if home:
            g["home_pts"] = d["tm_pts"]
        else:
            g["away_pts"] = d["tm_pts"]
    for g in gm.values():
        info = games.get(g["home"])
        if info:
            g["time"] = info["time"]
        if g["home_pts"] is not None and g["away_pts"] is not None:
            diff = round(g["home_pts"] - g["away_pts"], 1)
            g["fav"] = g["home"] if diff > 0 else g["away"] if diff < 0 else ""
            g["line"] = abs(diff)

    opp = {}
    for (a, h) in gm:
        opp[a], opp[h] = h, a

    # Usage rate (Basketball-Reference formula) from the projected box score.
    tpl = {}
    for r in rows:
        if r["min"] > 0:
            t = tpl.setdefault(r["team"], [0.0, 0.0])
            t[0] += r["fga"] + 0.44 * r["fta"] + r["to"]
            t[1] += r["min"]
    for r in rows:
        t = tpl.get(r["team"])
        poss = r["fga"] + 0.44 * r["fta"] + r["to"]
        r["usg"] = round(100.0 * poss * (t[1] / 5.0) / (r["min"] * t[0]), 1) if (t and r["min"] > 0 and t[0] > 0) else None

    pub = []
    for r in rows:
        if r["min"] <= 0:
            continue
        sal = r["salary"]
        pub.append({"player": r["player"], "team": r["team"], "opp": opp.get(r["team"], ""), "pos": r["dkpos"],
                    "salary": sal, "start": r["start"], "q": r["inj"] == "Q", "min": round(r["min"], 1), "usg": r["usg"],
                    "ou": r["ou"], "spread": r["spread"],
                    "pts": round(r["pts"], 1), "reb": round(r["reb"], 1), "ast": round(r["ast"], 1),
                    "stl": round(r["stl"], 1), "blk": round(r["blk"], 1), "to": round(r["to"], 1),
                    "dk": round(r["dk"], 1), "value": round(r["dk"] / (sal / 1000.0), 2) if sal else None,
                    "note": " ".join(r["why"])})
    games_out = list(gm.values())
    outs_pub = [{"player": o["player"], "team": o["team"], "note": o["note"]} for o in out_list]
    hist = {norm(r["player"]): {"player": r["player"], "team": r["team"], "base_min": r["base"], "min": round(r["min"], 1),
                                "dk": round(r["dk"], 1)} for r in rows}

    # Games that have tipped keep the last projection made before tip.
    utcnow = os.environ.get("NOW_UTC") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    locked = {t for t, g in games.items() if g["time"] and g["time"] <= utcnow}
    prev = load_json(os.path.join(D, "projections.json"), {})
    if locked and prev.get("date") == day:
        cur = {(p["player"], p["team"]): p for p in pub}
        gprev = {}
        for g in prev.get("games", []):
            gprev[g["home"]] = gprev[g["away"]] = g
        kept = []
        for p in prev.get("players", []):
            if p["team"] not in locked:
                continue
            p = dict(p)
            c = cur.get((p["player"], p["team"])) or {}
            for k in ("usg", "ou", "spread"):
                if k not in p:
                    p[k] = c.get(k)
            g = gprev.get(p["team"])
            if g and p.get("ou") is None:
                p["ou"] = g.get("ou")
            if g and p.get("spread") is None and g.get("line") is not None:
                p["spread"] = -g["line"] if g.get("fav") == p["team"] else (g["line"] if g.get("fav") else 0.0)
            kept.append(p)
        pub = [p for p in pub if p["team"] not in locked] + kept
        outs_pub = [o for o in outs_pub if o["team"] not in locked] + [o for o in prev.get("out", []) if o["team"] in locked]
        games_out = [g for g in games_out if g["home"] not in locked] + [g for g in prev.get("games", []) if g["home"] in locked]
        ph = load_json(os.path.join(HIST, day + ".json"), {})
        hist = {k: v for k, v in hist.items() if v["team"] not in locked}
        hist.update({k: v for k, v in ph.items() if v["team"] in locked})

    pub.sort(key=lambda x: -x["dk"])
    now = datetime.now(ET)
    doc = {"date": day, "updated": now.strftime("%-I:%M %p ET"),
           "games": sorted(games_out, key=lambda g: (g["time"], g["home"])),
           "players": pub, "out": sorted(outs_pub, key=lambda o: (o["team"], o["player"]))}
    acc = load_json(os.path.join(HIST, "accuracy.json"), None)
    if acc:
        doc["accuracy"] = acc.get("summary")
    with open(os.path.join(D, "projections.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    os.makedirs(HIST, exist_ok=True)
    with open(os.path.join(HIST, day + ".json"), "w", encoding="utf-8") as fh:
        json.dump(hist, fh, indent=1, ensure_ascii=False)
    print("projections:", day, len(pub), "players,", len(gm), "games,", len(out_list), "out")


if __name__ == "__main__":
    main()
