"""Game timelines for the Games tab: who was on the court, when, and what he did.

Reads ESPN play-by-play for every finished game on a date and writes
data/games/DATE.json (one entry per game) plus data/games/index.json (dates,
teams and scores for the two dropdowns).

Each player gets his stretches on the court with the minutes and DraftKings
points (points, threes, rebounds, assists, steals, blocks, turnovers) from that
stretch. Totals use the official box score, which also counts double-double and
triple-double bonuses.

Usage: python3 scripts/timelines.py [--date YYYY-MM-DD | --since YYYY-MM-DD]
Default: yesterday (Eastern time).
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import get, fix_team, load_json, D, ESPN_SB, ET  # noqa: E402
from results import dk_points, num, SUMMARY  # noqa: E402

GDIR = os.path.join(D, "games")
GARBAGE_LEAD = 20  # a lead this big in the fourth quarter or overtime counts as garbage time


def secs(per, clock):
    """Seconds elapsed in the game at this period and clock."""
    clock = str(clock or "0:00")
    m, s = clock.split(":") if ":" in clock else ("0", clock)
    left = int(m) * 60 + float(s)
    if per <= 4:
        return (per - 1) * 720 + (720 - left)
    return 2880 + (per - 5) * 300 + (300 - left)


def build_game(summary):
    comp = summary["header"]["competitions"][0]
    side = {c["homeAway"]: fix_team(c["team"]["abbreviation"]) for c in comp["competitors"]}
    name, team, starters, box_dk, box_min = {}, {}, {}, {}, {}
    for s in summary["boxscore"]["players"]:
        ab = fix_team(s["team"]["abbreviation"])
        starters[ab] = []
        st = s["statistics"][0]
        keys = st.get("keys") or st.get("names")
        for a in st.get("athletes", []):
            i = a["athlete"]["id"]
            name[i] = a["athlete"]["displayName"]
            team[i] = ab
            if a.get("starter"):
                starters[ab].append(i)
            if a.get("stats") and not a.get("didNotPlay"):
                v = dict(zip(keys, a["stats"]))
                box_min[i] = num(v.get("minutes", 0))
                box_dk[i] = dk_points((num(v.get("points")), num(v.get("rebounds")), num(v.get("assists")),
                                       num(v.get("steals")), num(v.get("blocks")), num(v.get("turnovers")),
                                       num(v.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "0-0"))))
    plays = summary.get("plays", [])
    if not plays:
        return None
    on = {ab: set(starters[ab]) for ab in starters}
    open_at = {i: 0.0 for ab in starters for i in starters[ab]}
    stints = {i: [] for i in name}
    events = {i: [] for i in name}
    margin = []
    score = []  # [seconds, away score, home score] each time the score changes

    def close(i, t):
        if i in open_at:
            stints[i].append([open_at.pop(i), t])

    def period_start(per, t, idx):
        # Players on the floor to start a period: anyone whose first event of the
        # period is not checking in.
        for ab in on:
            first = {}
            for p in plays[idx:]:
                if p["period"]["number"] != per:
                    break
                parts = [x["athlete"]["id"] for x in p.get("participants", []) if "athlete" in x]
                if p["type"]["text"] == "Substitution" and len(parts) == 2:
                    if team.get(parts[0]) == ab and parts[0] not in first:
                        first[parts[0]] = "in"
                    if team.get(parts[1]) == ab and parts[1] not in first:
                        first[parts[1]] = "on"
                else:
                    for x in parts:
                        if team.get(x) == ab and x not in first:
                            first[x] = "on"
            start = {x for x, v in first.items() if v == "on"}
            stay = [x for x in on[ab] if x not in first]
            while len(start) < 5 and stay:
                start.add(stay.pop())
            for x in on[ab] - start:
                close(x, t)
            for x in start - on[ab]:
                open_at[x] = t
            on[ab] = start

    cur = 1
    for idx, p in enumerate(plays):
        per = p["period"]["number"]
        t = secs(per, p.get("clock", {}).get("displayValue"))
        if per != cur:
            cur = per
            period_start(per, t, idx)
        margin.append((t, p.get("homeScore", 0) - p.get("awayScore", 0)))
        sc = [round(t), p.get("awayScore", 0), p.get("homeScore", 0)]
        if not score or score[-1][1:] != sc[1:]:
            score.append(sc)
        parts = [x["athlete"]["id"] for x in p.get("participants", []) if "athlete" in x]
        ty = p["type"]["text"].replace("\n", " ")
        tx = p.get("text", "")
        low = tx.lower()
        if ty == "Substitution" and len(parts) == 2:
            inn, out = parts
            ab = team.get(inn)
            if ab:
                close(out, t)
                on[ab].discard(out)
                on[ab].add(inn)
                open_at[inn] = t
            continue
        credit = []
        if p.get("scoringPlay") and parts:
            v = p.get("scoreValue", 0)
            credit.append((parts[0], v + (0.5 if v == 3 else 0)))
            if len(parts) > 1 and "assists" in low:
                credit.append((parts[1], 1.5))
        elif "rebound" in ty.lower() and parts:
            credit.append((parts[0], 1.25))
        elif "turnover" in low or "turnover" in ty.lower():
            if parts:
                credit.append((parts[0], -0.5))
            if len(parts) > 1 and "steals" in low:
                credit.append((parts[1], 2))
        elif " blocks " in tx and len(parts) > 1:
            credit.append((parts[1], 2))
        for i, v in credit:
            if i in events:
                events[i].append((t, v))
    end = max(m[0] for m in margin)
    for i in list(open_at):
        close(i, end)
    # Join stretches that touch (a player who stayed on across a period break).
    for i, sl in stints.items():
        merged = []
        for s in sorted(sl):
            if merged and s[0] - merged[-1][1] <= 1:
                merged[-1][1] = s[1]
            else:
                merged.append(s)
        stints[i] = merged

    # Garbage time: a big lead in the fourth quarter or overtime.
    garbage, g0 = [], None
    for t, m in margin:
        g = t >= 2160 and abs(m) >= GARBAGE_LEAD
        if g and g0 is None:
            g0 = t
        if not g and g0 is not None:
            garbage.append([g0, t])
            g0 = None
    if g0 is not None:
        garbage.append([g0, end])

    def gmin(s):
        return sum(max(0, min(s[1], g[1]) - max(s[0], g[0])) for g in garbage)

    players = []
    for i in name:
        if not stints[i]:
            continue
        sl = []
        for s in stints[i]:
            dk = sum(v for t, v in events[i] if s[0] <= t <= s[1])
            sl.append([round(s[0]), round(s[1]), round(dk, 2)])
        players.append({"player": name[i], "team": team[i], "start": i in starters[team[i]],
                        "min": round(box_min.get(i, sum(s[1] - s[0] for s in stints[i]) / 60), 1),
                        "dk": round(box_dk.get(i, sum(s[2] for s in sl)), 2),
                        "garbage_min": round(sum(gmin(s) for s in stints[i]) / 60, 1),
                        "stints": sl,
                        "ev": [[round(t), round(v, 2)] for t, v in events[i]]})
    final = [plays[-1].get("awayScore", 0), plays[-1].get("homeScore", 0)]
    return {"id": comp.get("id") or summary["header"].get("id"), "away": side["away"], "home": side["home"],
            "final": final, "end": round(end), "periods": cur, "garbage": [[round(a), round(b)] for a, b in garbage],
            "margin": thin(margin), "score": score, "caption": caption(side, final, margin, players, garbage, end), "players": players}


def thin(margin):
    """Keep only the points where the margin changes, to keep the file small."""
    out, last = [], None
    for t, m in margin:
        if m != last:
            out.append([round(t), m])
            last = m
    if margin and (not out or out[-1][0] != round(margin[-1][0])):
        out.append([round(margin[-1][0]), margin[-1][1]])
    return out


TEAM = {"ATL": "Atlanta", "BOS": "Boston", "BKN": "Brooklyn", "CHA": "Charlotte", "CHI": "Chicago", "CLE": "Cleveland",
        "DAL": "Dallas", "DEN": "Denver", "DET": "Detroit", "GSW": "Golden State", "HOU": "Houston", "IND": "Indiana",
        "LAC": "the Clippers", "LAL": "the Lakers", "MEM": "Memphis", "MIA": "Miami", "MIL": "Milwaukee", "MIN": "Minnesota",
        "NOP": "New Orleans", "NYK": "New York", "OKC": "Oklahoma City", "ORL": "Orlando", "PHI": "Philadelphia",
        "PHX": "Phoenix", "POR": "Portland", "SAC": "Sacramento", "SAS": "San Antonio", "TOR": "Toronto", "UTA": "Utah",
        "WAS": "Washington"}


def caption(side, final, margin, players, garbage, end):
    """A few plain sentences built only from the numbers."""
    a, h = side["away"], side["home"]
    win, lose = (h, a) if final[1] > final[0] else (a, h)
    ws, ls = max(final), min(final)
    hi = max(margin, key=lambda x: x[1])   # biggest home lead
    lo = min(margin, key=lambda x: x[1])   # biggest away lead
    lead = {h: hi[1], a: -lo[1]}
    half = [m for t, m in margin if t <= 1440]
    half = half[-1] if half else 0
    s = []
    if lead[lose] >= 10:
        s.append("%s led by as many as %d, but %s came back to win %d-%d." % (TEAM[lose], lead[lose], TEAM[win], ws, ls))
    else:
        s.append("%s beat %s %d-%d, and its biggest lead was %d." % (TEAM[win], TEAM[lose], ws, ls, lead[win]))
    if half:
        s.append("%s led by %d at halftime." % (TEAM[h] if half > 0 else TEAM[a], abs(half)))
    else:
        s.append("The game was tied at halftime.")
    if end > 2880:
        ot = int(round((end - 2880) / 300))
        s.append("It went to %s." % ("overtime" if ot == 1 else "%d overtimes" % ot))
    gm = round(sum(b - a2 for a2, b in garbage) / 60, 1)
    if gm >= 1:
        gp = sorted([p for p in players if p["garbage_min"] >= 1], key=lambda p: -p["garbage_min"])
        names = ", ".join("%s (%.1f)" % (p["player"], p["garbage_min"]) for p in gp[:3])
        late = "fourth quarter and overtime" if end > 2880 else "fourth quarter"
        s.append("%.1f minutes of the %s counted as garbage time, with a lead of %d or more." % (gm, late, GARBAGE_LEAD) +
                 (" The most garbage-time minutes went to %s." % names if names else ""))
    else:
        s.append("No stretch counted as garbage time.")
    top = max(players, key=lambda p: p["min"])
    s.append("%s played the most minutes, %.1f." % (top["player"], top["min"]))
    return " ".join(x[0].upper() + x[1:] for x in s)


def day_games(day):
    sb = json.loads(get(ESPN_SB + day.replace("-", "")))
    out = []
    for e in sb.get("events", []):
        if e["status"]["type"]["name"] != "STATUS_FINAL":
            continue
        g = build_game(json.loads(get(SUMMARY + e["id"])))
        if g:
            g["time"] = e.get("date", "")
            out.append(g)
    return sorted(out, key=lambda g: (g["time"], g["home"]))


def write_index():
    idx = []
    for fn in sorted(os.listdir(GDIR)):
        if fn.startswith("20") and fn.endswith(".json"):
            gs = load_json(os.path.join(GDIR, fn), [])
            idx.append({"date": fn[:10], "games": [{"id": g["id"], "away": g["away"], "home": g["home"], "final": g["final"]} for g in gs]})
    with open(os.path.join(GDIR, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(sorted(idx, key=lambda x: x["date"], reverse=True), fh, separators=(",", ":"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--since")
    args = ap.parse_args()
    yday = (datetime.now(ET) - timedelta(days=1)).strftime("%Y-%m-%d")
    days = [args.date or yday]
    if args.since:
        d0 = datetime.strptime(args.since, "%Y-%m-%d")
        days = []
        while d0.strftime("%Y-%m-%d") <= yday:
            days.append(d0.strftime("%Y-%m-%d"))
            d0 += timedelta(days=1)
    os.makedirs(GDIR, exist_ok=True)
    for day in days:
        path = os.path.join(GDIR, day + ".json")
        if not args.date and not args.since and os.path.exists(path):
            continue  # already built; the hourly runs do not need to fetch it again
        gs = day_games(day)
        if gs:
            with open(os.path.join(GDIR, day + ".json"), "w", encoding="utf-8") as fh:
                json.dump(gs, fh, separators=(",", ":"), ensure_ascii=False)
        print("timelines:", day, len(gs), "games")
    write_index()


if __name__ == "__main__":
    main()
