#!/usr/bin/env python3
"""Keep the Moves tab current from the NBA's official transactions feed.

Adds in-season roster moves (trades, signings, waiver claims) since the start
of the 2026-27 preseason to data/moves.json, newest first, and confirms the
summer trades once the player has actually played for his new team.
Exits quietly if the feed cannot be reached.
"""
import glob
import json
import os
import re
import urllib.request

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
URL = "https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json"
SINCE = "2026-10-01"
SLUG = {"hawks": "ATL", "celtics": "BOS", "nets": "BKN", "hornets": "CHA", "bulls": "CHI", "cavaliers": "CLE",
        "mavericks": "DAL", "nuggets": "DEN", "pistons": "DET", "warriors": "GSW", "rockets": "HOU", "pacers": "IND",
        "clippers": "LAC", "lakers": "LAL", "grizzlies": "MEM", "heat": "MIA", "bucks": "MIL", "timberwolves": "MIN",
        "pelicans": "NOP", "knicks": "NYK", "thunder": "OKC", "magic": "ORL", "sixers": "PHI", "76ers": "PHI",
        "suns": "PHX", "blazers": "POR", "trail-blazers": "POR", "kings": "SAC", "spurs": "SAS", "raptors": "TOR",
        "jazz": "UTA", "wizards": "WAS"}


def name_from(desc):
    m = re.search(r"(?:signed|claimed|converted the contract of|acquired)\s+(?:guard|forward|center|guard-forward|forward-center|forward-guard|center-forward)?\s*(.+?)(?: to a| off waivers| from|\.$|,)", desc)
    return m.group(1).strip() if m else ""


def main():
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/"})
        rows = json.loads(urllib.request.urlopen(req, timeout=60).read())["NBA_Player_Movement"]["rows"]
    except Exception as e:
        print("moves: skipped (%s)" % e)
        return
    path = os.path.join(D, "moves.json")
    moves = json.load(open(path))
    rows = sorted((r for r in rows if r["TRANSACTION_DATE"][:10] >= SINCE), key=lambda r: r["TRANSACTION_DATE"])
    waived_by = {}
    new = []
    for r in rows:
        typ, desc, date = r["Transaction_Type"], r["TRANSACTION_DESCRIPTION"], r["TRANSACTION_DATE"][:10]
        team = SLUG.get(r.get("TEAM_SLUG") or "", "")
        slug = r.get("PLAYER_SLUG") or ""
        if typ == "Waive":
            waived_by[slug] = team
            continue
        if typ not in ("Signing", "AwardOnWaivers", "Trade") or " re-signed " in desc:
            continue
        player = name_from(desc)
        if not player or not team:
            continue
        kind = {"AwardOnWaivers": "Waiver claim", "Trade": "Trade"}.get(typ, "Signing")
        if "Two-Way" in desc:
            kind += " (two-way)"
        new.append({"player": player, "from": waived_by.get(slug, ""), "to": team, "type": kind,
                    "note": desc.replace("..", ".") + " (" + date + ")", "source": "NBA-TX", "date": date})
    seen = {(m["player"], m.get("date", "")) for m in moves}
    added = [m for m in reversed(new) if (m["player"], m["date"]) not in seen]
    # Confirm summer moves once the player has played for his new team.
    box = {}
    ir = json.load(open(os.path.join(D, "injury_report.json"))) if os.path.exists(os.path.join(D, "injury_report.json")) else {}
    for p in ir.get("players", []):
        box.setdefault(p["player"], set()).add(p["team"])
    for f in glob.glob(os.path.join(D, "proj_history", "box", "*.json")):
        for b in json.load(open(f)):
            box.setdefault(b["player"], set()).add(b["team"])
    confirmed = 0
    for m in moves:
        if m.get("to") in box.get(m["player"], set()):
            if "(assumed)" in m.get("type", ""):
                m["type"] = m["type"].replace(" (assumed)", "")
                confirmed += 1
            if re.search(r"not official|pending|assumed", m.get("note", ""), re.I):
                m["note"] = "He has played for %s this season." % m["to"]
                confirmed += 1
    moves = added + moves
    json.dump(moves, open(path, "w"), indent=1, ensure_ascii=False)
    srcp = os.path.join(D, "sources.json")
    src = json.load(open(srcp))
    if not any(s["id"] == "NBA-TX" for s in src):
        src.append({"id": "NBA-TX", "date": SINCE, "show": "NBA official transactions", "title": "NBA player movement", "url": "https://www.nba.com/players/transactions"})
        json.dump(src, open(srcp, "w"), indent=1, ensure_ascii=False)
    print("moves:", len(added), "added,", confirmed, "summer moves confirmed,", len(moves), "total")


if __name__ == "__main__":
    main()
