"""Write the daily picks script for the nbadfs.com short video.

Reads data/projections.json (our projections) and writes data/shorts.txt and
data/shorts.json: 3 locks and 3 value plays with one plain reason each.
Only runs when the projections are for today (Eastern time).
"""
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
ET = ZoneInfo("America/New_York")
NAMES = {"ATL": "Hawks", "BOS": "Celtics", "BKN": "Nets", "CHA": "Hornets", "CHI": "Bulls", "CLE": "Cavaliers",
         "DAL": "Mavericks", "DEN": "Nuggets", "DET": "Pistons", "GSW": "Warriors", "HOU": "Rockets", "IND": "Pacers",
         "LAC": "Clippers", "LAL": "Lakers", "MEM": "Grizzlies", "MIA": "Heat", "MIL": "Bucks", "MIN": "Timberwolves",
         "NOP": "Pelicans", "NYK": "Knicks", "OKC": "Thunder", "ORL": "Magic", "PHI": "76ers", "PHX": "Suns",
         "POR": "Trail Blazers", "SAC": "Kings", "SAS": "Spurs", "TOR": "Raptors", "UTA": "Jazz", "WAS": "Wizards"}


def money(v):
    return "${:,}".format(v)


WHYS = {}


def reason(p, kind):
    bits = []
    if kind == "lock":
        bits.append("He projects for %.1f DraftKings points in %.0f minutes." % (p["dk"], p["min"]))
    else:
        bits.append("At %s, he projects for %.1f DraftKings points, which is %.1f times his salary." % (money(p["salary"]), p["dk"], p["value"]))
    if p.get("ou"):
        bits.append("His game has a %.1f-point total." % p["ou"])
    if WHYS.get(p["player"]):
        return bits[0] + " " + WHYS[p["player"]]
    if p.get("note") and not p["note"].startswith(("More minutes with", "Moved toward")):
        bits.append(p["note"])
    return " ".join(bits)


def main():
    doc = json.load(open(os.path.join(D, "projections.json"), encoding="utf-8"))
    today = datetime.now(ET).strftime("%Y-%m-%d")
    if doc.get("date") != today:
        print("projections are not for today yet; shorts not written")
        return
    pool = [p for p in doc["players"] if p.get("salary") and not p.get("q") and p.get("min", 0) >= 20]
    locks = sorted([p for p in pool if p["salary"] >= 7000], key=lambda p: -p["dk"])[:3]
    used = {p["player"] for p in locks}
    value = []
    for lo, hi in ((6000, 8000), (4000, 6000), (0, 4000)):
        tier = sorted([p for p in pool if lo <= p["salary"] < hi and p["player"] not in used], key=lambda p: -p["value"])
        if tier:
            value.append(tier[0])
            used.add(tier[0]["player"])
    # Use Stars & Scrubs when it is posted for today (same picks as the site tab, with our context).
    ss_path = os.path.join(D, "stars.json")
    ss = json.load(open(ss_path, encoding="utf-8")) if os.path.exists(ss_path) else {}
    whys = {}
    if ss.get("date") == today and ss.get("stars") and ss.get("scrubs"):
        locks = [p for p in ss["stars"] if not p.get("q")][:3]
        value = [p for p in ss["scrubs"] if not p.get("q")][:3]
        WHYS.update({p["player"]: p.get("why", "") for p in locks + value})
    d = datetime.strptime(today, "%Y-%m-%d")
    day = d.strftime("%A, %B ") + str(d.day)
    games = len(doc.get("games", []))
    now = datetime.now(ET).strftime("%-I:%M %p ET")
    out = {"date": today, "made": now, "games": games,
           "hook": "Tonight's NBA DFS locks and value plays in 30 seconds.",
           "locks": [{"player": p["player"], "team": p["team"], "salary": p["salary"], "dk": p["dk"], "reason": reason(p, "lock")} for p in locks],
           "value": [{"player": p["player"], "team": p["team"], "salary": p["salary"], "dk": p["dk"], "value": p["value"], "reason": reason(p, "value")} for p in value],
           "close": "Full projections, minutes and injury news are free at nbadfs.com.",
           "warning": "These are early picks, so check late injury news before lock."}
    with open(os.path.join(D, "shorts.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    L = ["NBADFS.COM SHORT SCRIPT", "Date: %s (%s), %d games. Made %s." % (today, day, games, now), "",
         "HOOK: " + out["hook"], ""]
    for i, p in enumerate(out["locks"], 1):
        L.append("LOCK %d: %s (%s), %s. %s" % (i, p["player"], NAMES.get(p["team"], p["team"]), money(p["salary"]), p["reason"]))
    L.append("")
    for i, p in enumerate(out["value"], 1):
        L.append("VALUE %d: %s (%s), %s. %s" % (i, p["player"], NAMES.get(p["team"], p["team"]), money(p["salary"]), p["reason"]))
    L += ["", "WARNING: " + out["warning"], "CLOSE: " + out["close"], "",
          "ON SCREEN: show each player's name, team and salary in big text, and keep nbadfs.com on screen the whole time."]
    with open(os.path.join(D, "shorts.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("shorts:", today, [p["player"] for p in locks], [p["player"] for p in value])


if __name__ == "__main__":
    main()
