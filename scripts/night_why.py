"""Add a short "why" line to the Last Night results (data/nights.json).

For every player who beat or missed our projection by 10+ DK points, write 1-2 short
sentences that explain why, leaning on the people who watch the games first:

  1. Show and helper notes about that game (player log entries made after the game).
  2. Research: news notes (ESPN-), who was out that night (role facts that happened),
     and the ESPN game recap (injury exits, ejections, foul trouble).
  3. Our own read from the box score: blowouts and minutes far from our projection.

When the shows gave a projected ownership for him that night, a second sentence says
where the field was. Players with no clear reason get no line; nothing is made up.

ESPN recaps are cached in data/recaps/DATE.json (one fetch per night).
Run after season.py and the note scripts (blowouts.py, wowy.py).
Usage: python3 scripts/night_why.py
"""
import json
import os
import re
import sys
import urllib.request
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, norm  # noqa: E402

ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/"
SHOWS = ("LO-", "OMS-", "FA-", "SE-", "DB-", "SP-", "STK-", "RW-", "TL-", "N2S-")
RESEARCH = ("ESPN-", "WEB-", "NBA-INJ", "BLOW", "WOWY")
MIN_DIFF = 10.0


def md(d):
    return "%d/%d" % (int(d[5:7]), int(d[8:10]))


def src_date(src, year):
    m = re.search(r"-(\d{2})(\d{2})[a-z]?$", src or "")
    if not m:
        return None
    try:
        return date(year, int(m.group(1)), int(m.group(2)))
    except ValueError:
        return None


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def recaps(day):
    """ESPN game recap text for every game that night, cached."""
    path = os.path.join(D, "recaps", day + ".json")
    have = load_json(path, None)
    if have:
        return have
    out = []
    try:
        sb = get(ESPN + "scoreboard?dates=" + day.replace("-", ""))
        for e in sb.get("events", []):
            if e.get("status", {}).get("type", {}).get("state") != "post":
                continue
            s = get(ESPN + "summary?event=" + e["id"])
            a = s.get("article") or {}
            txt = re.sub(r"<[^>]+>", " ", a.get("story") or "")
            txt = re.sub(r"\s+", " ", txt).strip()
            if txt:
                out.append({"id": e["id"], "game": e.get("shortName", ""), "headline": a.get("headline", ""), "text": txt})
    except Exception as ex:  # network trouble: try again next run
        print("night_why: recap fetch failed for", day, ex)
        return []
    if out:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return out


def first_sentence(t, cap=230):
    t = t.strip()
    m = re.match(r"(.+?(?<!Jan)(?<!Feb)(?<!Mar)(?<!Apr)(?<!Jun)(?<!Jul)(?<!Aug)(?<!Sep)(?<!Oct)(?<!Nov)(?<!Dec)(?<!Jr)(?<!Sr)(?<!St)(?<!Mr)(?<!vs)(?<!No)[.!?])(\s|$)", t)
    s = m.group(1) if m else t
    if len(s) > cap:
        s = s[:cap].rsplit(" ", 1)[0].rstrip(",;") + "."
    return s


EVENTS = [
    (r"\bejected\b", "He was ejected, which cut his night short."),
    (r"foul trouble|fouled out|(fifth|5th|sixth|6th) foul", "Foul trouble limited his minutes."),
    (r"(left|exited|did not return|didn't return).{0,60}(injur|ankle|knee|hamstring|back|hip|wrist|foot|groin|calf|shoulder|head|concussion)|"
     r"(injur|ankle|knee|hamstring|back|hip|wrist|foot|groin|calf|shoulder).{0,40}(left|exited|did not return|didn't return)",
     "He left the game early with an injury."),
]


def recap_event(player, texts):
    last = player.split()[-1]
    if last.lower() in ("jr.", "jr", "ii", "iii", "iv", "sr."):
        last = player.split()[-2]
    for t in texts:
        for sent in re.split(r"(?<=[.!?])\s+", t):
            if last not in sent:
                continue
            for pat, line in EVENTS:
                if re.search(pat, sent, re.I):
                    return line
    return None


def main():
    nights = load_json(os.path.join(D, "nights.json"), {})
    if not nights.get("dates"):
        return
    log = load_json(os.path.join(D, "player_log.json"), [])
    facts = load_json(os.path.join(D, "role_facts.json"), [])
    show_own = load_json(os.path.join(D, "show_own.json"), {})
    by_player = {}
    for e in log:
        by_player.setdefault(norm(e["player"]), []).append(e)

    n_lines = 0
    for day in nights["dates"]:
        night = nights["nights"][day]
        d0 = date.fromisoformat(day)
        texts = None
        margin = {}
        for g in night.get("games", []):
            if g.get("as") is not None and g.get("hs") is not None:
                m = abs(g["as"] - g["hs"])
                margin[g["away"]] = margin[g["home"]] = m
        own = show_own.get(day, {})
        for p in night["players"]:
            p.pop("why", None)
            if p.get("diff") is None or abs(p["diff"]) < MIN_DIFF:
                continue
            k, up = norm(p["player"]), p["diff"] > 0
            why = None
            # 1. Shows and helpers, made after the game, about this game.
            notes = []
            for e in by_player.get(k, []):
                sd = src_date(e.get("src", ""), d0.year)
                if e.get("date") != day or not sd or sd <= d0:
                    continue
                rank = 0 if e.get("src", "").startswith(SHOWS) else (1 if e.get("src", "").startswith(RESEARCH) else 2)
                notes.append((rank, e))
            notes.sort(key=lambda x: x[0])
            if notes and notes[0][0] < 2:
                why = first_sentence(notes[0][1]["text"])
            # 2. Research: who was out, then the game recap.
            if not why:
                outs = [f["out"] for f in facts if f.get("kind") == "happened" and f.get("date") == day
                        and norm(f.get("gains", "")) == k]
                if outs and up:
                    who = outs[0] if len(outs) == 1 else ", ".join(outs[:-1]) + " and " + outs[-1]
                    why = "With %s out, he played %d minutes (we projected %d)." % (who, round(p["min"] or 0), round(p.get("pmin") or 0))
            if not why:
                if texts is None:
                    texts = [r["text"] for r in recaps(day)]
                ev = recap_event(p["player"], texts)
                if ev and not up:
                    why = ev
            # 3. Our own read from the box score.
            if not why and p.get("pmin") is not None and p.get("min") is not None:
                gap = p["min"] - p["pmin"]
                m = margin.get(p["team"], 0)
                if not up and m >= 20 and gap <= -5:
                    why = "The game was a %d-point blowout, so he played only %d minutes (we projected %d)." % (m, round(p["min"]), round(p["pmin"]))
                elif abs(gap) >= 6:
                    why = "He played %d minutes, %d %s than we projected." % (round(p["min"]), round(abs(gap)), "more" if gap > 0 else "fewer")
            if not why:
                continue
            o = own.get(p["player"])
            if o:
                why += " The shows projected him at %d%% owned." % round(o[0])
            p["why"] = why
            n_lines += 1
    json.dump(nights, open(os.path.join(D, "nights.json"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print("night_why: %d lines over %d nights" % (n_lines, len(nights["dates"])))


if __name__ == "__main__":
    main()
