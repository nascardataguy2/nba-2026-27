"""Build tonight's Stars & Scrubs list: the high-salary locks and the cheap value
plays, each with our projection and a plain reason why.

Reads data/projections.json, data/players.json, data/quickhits.json,
data/proj_history/results.json (box scores) and data/context_notes.json
(context written each morning from recaps, news and podcasts).
Writes data/stars.json. A scrub only makes the list when there is a real
reason (a role change, a teammate out, recent minutes, or a written note).
"""
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import norm, load_json, D, HIST  # noqa: E402

ET = ZoneInfo("America/New_York")
STAR_MIN_SAL = 8000
SCRUB_MAX_SAL = 4500
N_STARS, N_SCRUBS = 5, 8


def main():
    doc = load_json(os.path.join(D, "projections.json"), {})
    today = datetime.now(ET).strftime("%Y-%m-%d")
    day = doc.get("date")
    if day != today:
        print("projections are not for today; stars not written")
        return
    ours = {norm(p["player"]): p for p in load_json(os.path.join(D, "players.json"), [])}
    qh = load_json(os.path.join(D, "quickhits.json"), {})
    res = load_json(os.path.join(HIST, "results.json"), {})
    notes_doc = load_json(os.path.join(D, "context_notes.json"), {})
    notes = {norm(k): v for k, v in (notes_doc.get("notes", {}) if notes_doc.get("date") == day else {}).items()}

    outs_by_team = {}
    for o in doc.get("out", []):
        outs_by_team.setdefault(o["team"], []).append(o["player"])
    # "If he sits, who benefits" notes that apply tonight.
    sits = {}
    for it in qh.get("if_sits", []):
        out_names = [n.strip() for n in str(it.get("out", "")).split(" or ")]
        if any(n in outs_by_team.get(it.get("team"), []) for n in out_names):
            for b in str(it.get("benefits", "")).split(" and "):
                sits[norm(b.strip())] = "%s is out tonight. %s" % (" and ".join(n for n in out_names if n in outs_by_team.get(it["team"], [])), it["text"])
    teams = {t["team"]: t for t in load_json(os.path.join(D, "teams.json"), [])}
    import re as _re

    def rotation(p):
        t = teams.get(p["team"]) or {}
        last = p["player"].split(" ")[-1]
        for field, label in (("starters", "start"), ("bench", "bench")):
            txt = t.get(field, "")
            m = _re.search(_re.escape(p["player"]) + r"\s*\(([^)]*)\)", txt) or _re.search(_re.escape(last) + r"\s*\(([^)]*)\)", txt)
            if p["player"] in txt or m:
                mins = m.group(1).split(",")[0].strip() if m else ""
                mins = mins if _re.match(r"^\d+(-\d+)?$", mins) else ""
                if mins and abs(float(mins.split("-")[0]) - p["min"]) > 6:
                    mins = ""
                if label == "start":
                    return "He is in our projected starting five" + (" at about %s minutes." % mins if mins else "."), True
                if not mins:
                    return "", False
                return "He is a key bench piece in our rotation at about %s minutes." % mins, True
        return "", False
    rk = load_json(os.path.join(D, "rankings", "nba-top250-points-2026-27.json"), {})
    notable = {norm(r["player"]) for r in rk.get("rows", []) if r.get("rank", 999) <= 200}
    notable |= {k for k, v in ours.items() if str(v.get("role", "")).lower().startswith("starter")}
    tops = sorted({g.get("ou") or 0 for g in doc.get("games", [])}, reverse=True)
    top_ou = tops[0] if tops else None

    def box(name, team):
        g = [x for x in res.get(norm(name), []) if x.get("team") == team and x.get("date", "") < day]
        return sorted(g, key=lambda x: x["date"])

    def context(p, kind):
        k = norm(p["player"])
        why, real = [], False
        if k in notes:
            why.append(notes[k]); real = True
            if p.get("ou") and p["ou"] >= 230 and "total" not in notes[k]:
                why.append("His game has a %.1f-point total." % p["ou"])
            return notes[k] if len(why) == 1 else " ".join(why), True
        if k in sits:
            why.append(sits[k]); real = True
        if p.get("note") and p["note"].startswith("More minutes with"):
            why.append(p["note"]); real = True
        elif p.get("note") and not p["note"].startswith("Moved toward"):
            why.append(p["note"]); real = True
        g = box(p["player"], p["team"])
        if g:
            last = g[-1]
            avg = sum(x["min"] for x in g) / len(g)
            if len(g) == 1:
                why.append("He played %d minutes%s in his first game and scored %.1f DraftKings points." % (
                    last["min"], " as a starter" if last.get("start") else " off the bench", last["dk"]))
            else:
                why.append("He has averaged %.0f minutes over his %d games, with %d last time out." % (avg, len(g), last["min"]))
            if kind == "scrub" and (last["min"] >= 24 or last.get("start")):
                real = True
        nout = [o for o in outs_by_team.get(p["team"], []) if norm(o) in notable]
        if nout and k not in sits:
            why.append("%s %s out tonight." % (" and ".join(nout[:2]), "is" if len(nout[:2]) == 1 else "are"))
            if kind == "scrub":
                real = True
        rtxt, inrot = rotation(p)
        if kind == "scrub" and p.get("start"):
            why.append("He is expected to start tonight.")
            real = True
        elif rtxt:
            why.append(rtxt)
            real = real or inrot
        if top_ou and p.get("ou") == top_ou:
            why.append("His game has the highest total on the slate (%.1f)." % p["ou"])
        elif p.get("ou") and p["ou"] >= 230:
            why.append("His game has a high %.1f-point total." % p["ou"])
        if p.get("spread") is not None and abs(p["spread"]) >= 9:
            why.append("The %.1f-point spread brings some blowout risk." % abs(p["spread"]))
        if kind == "star":
            real = True
        # Keep it readable: first three sentences.
        seen, out = set(), []
        for w in why:
            if w and w not in seen:
                seen.add(w); out.append(w)
        return " ".join(out[:4]), real

    players = [p for p in doc.get("players", []) if p.get("salary")]
    stars = []
    for p in sorted([p for p in players if p["salary"] >= STAR_MIN_SAL], key=lambda p: -p["dk"]):
        why, _ = context(p, "star")
        stars.append(dict(p, why=why))
        if len(stars) >= N_STARS:
            break
    scrubs = []
    for p in sorted([p for p in players if p["salary"] <= SCRUB_MAX_SAL and p["min"] >= 15], key=lambda p: -p["value"]):
        why, real = context(p, "scrub")
        if not real:
            continue
        scrubs.append(dict(p, why=why))
        if len(scrubs) >= N_SCRUBS:
            break

    # "New today": scrubs who were not on yesterday's list.
    prev = sorted(f for f in os.listdir(HIST) if f.startswith("scrubs-") and f < "scrubs-" + day)
    before = set(load_json(os.path.join(HIST, prev[-1]), [])) if prev else None
    for s in scrubs:
        s["new"] = before is not None and norm(s["player"]) not in before
    with open(os.path.join(HIST, "scrubs-" + day + ".json"), "w", encoding="utf-8") as fh:
        json.dump([norm(s["player"]) for s in scrubs], fh)

    out = {"date": day, "updated": doc.get("updated"), "stars": stars, "scrubs": scrubs,
           "guide": "Pair two or three stars with two or three scrubs, then fill the middle. The scrubs are what make the stars fit under the $50,000 cap."}
    with open(os.path.join(D, "stars.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    print("stars:", [s["player"] for s in stars], "scrubs:", [s["player"] for s in scrubs])


if __name__ == "__main__":
    main()
