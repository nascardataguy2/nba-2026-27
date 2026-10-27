#!/usr/bin/env python3
"""Player news log (data/player_log.json): dated, useful notes for every player.

Each entry: {"player", "team", "date", "kind", "text", "expires", "src"}
  kind: injury | role | minutes | usage | stat | news

Usage:
  python3 scripts/playerlog.py                 # prune outdated entries
  python3 scripts/playerlog.py --add FILE.json # merge new entries, then prune

Pruning (outdated info is dumped):
  - anything past its "expires" date
  - injury/status entries once the player has played a game after the entry date
  - game lines (stat): only the two newest per player, and none older than 7 days
  - role / minutes / usage: older than 10 days; news: older than 21 days; at most four per kind
  - near-duplicates keep one: very similar text, or same day with the same numbers
    (preference: injury, role, minutes, usage, news, then game line)
  - at most 10 entries per player
"""
import argparse
import difflib
import glob
import json
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
PATH = os.path.join(D, "player_log.json")
KINDS = ("injury", "role", "minutes", "usage", "stat", "news")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("’", "'")
    s = re.sub(r"[^a-z' ]", " ", s.replace("-", " "))
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


def played_after():
    """norm(player) -> latest date he logged minutes."""
    last = {}
    for f in glob.glob(os.path.join(D, "proj_history", "box", "*.json")):
        for r in load(f, []):
            if r.get("min", 0) > 0:
                k = norm(r["player"])
                if r["date"] > last.get(k, ""):
                    last[k] = r["date"]
    return last


def clean(e):
    e = {k: e.get(k) for k in ("player", "team", "date", "kind", "text", "expires", "src")}
    if not e["src"]:
        e["src"] = ""
    e["text"] = re.sub(r"\s+", " ", str(e["text"] or "")).strip()
    if e["kind"] not in KINDS:
        e["kind"] = "news"
    return e if e["player"] and e["text"] and re.match(r"\d{4}-\d\d-\d\d$", e["date"] or "") else None


def nums(t):
    return set(re.findall(r"\b\d+\b", t)) | {w for w in re.findall(r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\b", t.lower())}


def dup(x, e):
    r = difflib.SequenceMatcher(None, x["text"].lower(), e["text"].lower()).ratio()
    if r > 0.6 or (x["kind"] == e["kind"] and x["date"] == e["date"]):
        return True
    if x["date"] == e["date"]:
        a, b = nums(x["text"]) - {"2026"}, nums(e["text"]) - {"2026"}
        if len(a & b) >= 2:
            return True
    return False


def prune(log, today):
    names = {norm(p["player"]): p["player"] for p in load(os.path.join(D, "players.json"), [])}
    last = played_after()
    t = datetime.strptime(today, "%Y-%m-%d").date()
    cut7, cut10, cut21 = str(t - timedelta(days=7)), str(t - timedelta(days=10)), str(t - timedelta(days=21))
    by = {}
    for e in log:
        e = clean(e)
        if not e:
            continue
        k = norm(e["player"])
        e["player"] = names.get(k, e["player"])
        if e.get("expires") and e["expires"] < today:
            continue
        if e["kind"] == "injury" and last.get(k, "") > e["date"]:
            continue
        if e["kind"] == "stat" and e["date"] < cut7:
            continue
        if e["kind"] in ("role", "minutes", "usage") and e["date"] < cut10:
            continue
        if e["kind"] == "news" and e["date"] < cut21:
            continue
        by.setdefault(k, []).append(e)
    out = []
    for k, es in by.items():
        pref = {k: i for i, k in enumerate(("injury", "role", "minutes", "usage", "news", "stat"))}
        es.sort(key=lambda e: (e["date"], -pref[e["kind"]], len(e["text"])), reverse=True)
        keep, count = [], {}
        for e in es:
            if any(dup(x, e) for x in keep):
                continue
            # an older role/minutes/usage note is outdated once a newer role note is 4+ days newer
            newest_role = max([x["date"] for x in keep if x["kind"] == "role"] or [""])
            if e["kind"] in ("role", "minutes", "usage") and newest_role and str(datetime.strptime(newest_role, "%Y-%m-%d").date() - timedelta(days=4)) > e["date"]:
                continue
            # game lines from before his latest injury are not useful while he is hurt
            if e["kind"] == "stat" and any(x["kind"] == "injury" and x["date"] > e["date"] for x in keep):
                continue
            lim = {"injury": 1, "stat": 2}.get(e["kind"], 4)
            if count.get(e["kind"], 0) >= lim:
                continue
            count[e["kind"]] = count.get(e["kind"], 0) + 1
            keep.append(e)
        out += keep[:10]
    out.sort(key=lambda e: (norm(e["player"]), e["date"]), reverse=False)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add", nargs="*", default=[])
    ap.add_argument("--date")
    a = ap.parse_args()
    today = a.date or datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    log = load(PATH, [])
    n0 = len(log)
    for f in a.add:
        log += load(f, [])
    log = prune(log, today)
    json.dump(log, open(PATH, "w"), indent=1, ensure_ascii=False)
    print("player log:", len(log), "entries for", len({norm(e['player']) for e in log}), "players (was", n0, ")")


if __name__ == "__main__":
    main()
