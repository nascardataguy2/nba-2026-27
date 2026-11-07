"""Real DraftKings ownership after the fact.

Fantasy Team Advice's free Ownership History page shows the actual GPP
ownership (from tracked contest results) of the five most-owned players on
each past main slate. This saves those five per night to data/actual_own.json:
{date: {"slate": id, "players": [{"player", "salary", "own"}]}}.

Gentle on their site: two page loads per night, a pause between loads, and a
night with no data yet is retried on later runs (up to 3 days after).

Usage: python3 scripts/actual_own.py [--date YYYY-MM-DD] [--since YYYY-MM-DD]
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D  # noqa: E402

BASE = "https://fantasyteamadvice.com/nba/dfs-ownership/history"
OUT = os.path.join(D, "actual_own.json")
PAUSE = 8  # seconds between page loads
START = "2026-10-23"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (nbadfs.com results)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def main_slate(day):
    page = fetch("%s?date=%s&site=dk" % (BASE, day))
    for href, body in re.findall(r'<a[^>]*href="([^"]*slate=\d+[^"]*)"[^>]*>(.*?)</a>', page, re.S):
        h = html.unescape(href)
        text = re.sub(r"<[^>]+>|\s+", " ", body)
        if "date=%s" % day in h and "site=dk" in h and "Main" in text and "Classic" in text:
            return re.search(r"slate=(\d+)", h).group(1)
    return None


def top5(day, slate):
    page = fetch("%s?date=%s&site=dk&slate=%s" % (BASE, day, slate))
    if "Actual GPP Ownership" not in page:
        return []
    m = re.search(r'"@type":"ItemList".*?"itemListElement":(\[.*?\])', page, re.S)
    names = [x["name"] for x in json.loads(m.group(1))] if m else []
    owns = re.findall(r'<span class="shrink-0">([\d.]+)%</span>', page)
    sals = re.findall(r'md:table-cell px-3 py-2 text-right">\$([\d,]+)<', page)
    out = []
    for i, n in enumerate(names):
        if i < len(owns):
            out.append({"player": html.unescape(n), "salary": int(sals[i].replace(",", "")) if i < len(sals) else None, "own": float(owns[i])})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--since", default=START)
    a = ap.parse_args()
    data = load_json(OUT, {})
    et_today = (datetime.now(timezone.utc) - timedelta(hours=5)).date()
    if a.date:
        days = [a.date]
    else:
        d0 = date.fromisoformat(a.since)
        days = [(d0 + timedelta(i)).isoformat() for i in range((et_today - d0).days)]
    loads = 0
    for day in days:
        cur = data.get(day) or {}
        if cur.get("players"):
            continue
        if cur.get("tries", 0) >= 3 and not a.date:
            continue
        try:
            if loads:
                time.sleep(PAUSE)
            slate = main_slate(day)
            loads += 1
            players = []
            if slate:
                time.sleep(PAUSE)
                players = top5(day, slate)
                loads += 1
        except Exception as e:
            print("actual_own: %s failed (%s)" % (day, e))
            break
        if players:
            data[day] = {"slate": slate, "players": players}
            print("actual_own: %s %s" % (day, ", ".join("%s %.1f%%" % (p["player"], p["own"]) for p in players)))
        elif day < et_today.isoformat():
            data[day] = {"tries": cur.get("tries", 0) + 1}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(data.items())), fh, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
