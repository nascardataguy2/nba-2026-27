#!/usr/bin/env python3
"""Read the NBA's official injury report (a PDF posted every 15 minutes) and
write data/injury_report.json for today's games:

  {"date": "YYYY-MM-DD", "report": "04:15 PM", "url": ...,
   "players": [{"player": "First Last", "team": "PHI", "status": "Out", "reason": "..."}],
   "pending": ["LAL", ...]}   # teams that have not submitted yet

projections.py uses it: Out and Doubtful count as out, Questionable sets the
"q" flag. Needs pdftotext (poppler-utils). Exits quietly if anything fails, so
the rest of the run carries on with the other injury sources.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
PAGE = "https://official.nba.com/nba-injury-report-2026-27-season/"
UA = {"User-Agent": "Mozilla/5.0 (compatible; nbadfs.com)"}
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

TEAMS = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE", "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET", "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}
STATUS = r"(Out|Doubtful|Questionable|Probable|Available)"


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        b = r.read()
    return b if binary else b.decode("utf-8", "replace")


def flip(name):
    # "Udeh, Jr., Ernest" -> "Ernest Udeh Jr."; "Porter Jr., Michael" -> "Michael Porter Jr."
    parts = [p.strip() for p in name.split(",")]
    if len(parts) == 3:
        return "%s %s %s" % (parts[2], parts[0], parts[1])
    if len(parts) == 2:
        return "%s %s" % (parts[1], parts[0])
    return name.strip()


def parse(text, day):
    mdy = datetime.strptime(day, "%Y-%m-%d").strftime("%m/%d/%Y")
    players, pending = [], []
    cur_date, cur_team = None, None
    for line in text.splitlines():
        if not line.strip() or line.strip().startswith(("Injury Report:", "Page ", "Game Date")):
            continue
        m = re.search(r"\b(\d\d/\d\d/\d{4})\b", line)
        if m:
            cur_date = m.group(1)
        for full, ab in TEAMS.items():
            if re.search(r"(^|\s{2,})" + re.escape(full) + r"(\s{2,}|$)", line):
                cur_team = ab
                break
        if cur_date != mdy:
            continue
        if "NOT YET SUBMITTED" in line:
            if cur_team and cur_team not in pending:
                pending.append(cur_team)
            continue
        # Strip the date, time, matchup and team columns so only the player columns are left.
        rest = re.sub(r"\d\d/\d\d/\d{4}|\d\d:\d\d \(ET\)|\b[A-Z]{2,3}@[A-Z]{2,3}\b", " ", line)
        for full in TEAMS:
            rest = rest.replace(full, " ")
        m = re.search(r"([A-Z][A-Za-z'.\- ]*?,(?: [A-Za-z'.\-]+,)? [A-Za-z'.\- ]+?)\s{2,}" + STATUS + r"\b(.*)$", rest.strip())
        if m:
            players.append({"player": flip(m.group(1)), "team": cur_team or "", "status": m.group(2), "reason": m.group(3).strip()})
    for p in players:
        p["reason"] = re.sub(r"^Injury/Illness - ", "", re.sub(r"\s+", " ", p["reason"])).strip()
    return players, pending


def main():
    day = sys.argv[1] if len(sys.argv) > 1 else datetime.now(ET).strftime("%Y-%m-%d")
    try:
        page = get(PAGE)
        links = sorted(set(re.findall(r"https://ak-static\.cms\.nba\.com/referee/injury/Injury-Report_(%s)_(\d\d)_(\d\d)(AM|PM)\.pdf" % day, page)),
                       key=lambda t: ((int(t[1]) % 12) + (12 if t[3] == "PM" else 0), int(t[2])))
        if not links:
            print("official injuries: no report posted for", day, "yet")
            return
        d, hh, mm, ap = links[-1]
        url = "https://ak-static.cms.nba.com/referee/injury/Injury-Report_%s_%s_%s%s.pdf" % (d, hh, mm, ap)
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tf:
            tf.write(get(url, binary=True))
            tf.flush()
            text = subprocess.run(["pdftotext", "-layout", tf.name, "-"], capture_output=True, text=True, check=True).stdout
        players, pending = parse(text, day)
    except Exception as e:  # never break the projections run
        print("official injuries: skipped (%s)" % e)
        return
    out = {"date": day, "report": "%s:%s %s" % (hh, mm, ap), "url": url, "players": players, "pending": pending}
    json.dump(out, open(os.path.join(D, "injury_report.json"), "w"), indent=1, ensure_ascii=False)
    print("official injuries:", day, out["report"], len(players), "players,", len(pending), "teams pending")


if __name__ == "__main__":
    main()
