#!/usr/bin/env python3
"""Sanity check on tonight's projections. Prints players whose projected minutes are far
from what they have actually played, without a teammate-out reason, and very high Own%.
Prints nothing when everything looks right. Exit code 1 when something is flagged."""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, norm  # noqa: E402

doc = load_json(os.path.join(D, "projections.json"), {})
day = doc.get("date", "")
games = {}
for f in glob.glob(os.path.join(D, "proj_history", "box", "*.json")):
    for x in load_json(f, []):
        if x.get("date", "") < day:
            games.setdefault((x["team"], norm(x["player"])), []).append(x)
def recent(team, name):
    k = (team, norm(name))
    if k not in games:
        c = [kk for kk in games if kk[0] == team and kk[1].split(" ")[-1] == k[1].split(" ")[-1]]
        k = c[0] if len(c) == 1 else k
    return sorted(games.get(k, []), key=lambda x: x["date"])[-3:]


# Teams missing a rotation player tonight (someone ruled out who has been playing 15+ minutes).
short = set()
for o in doc.get("out", []):
    g = recent(o["team"], o["player"])
    if g and sum(x["min"] for x in g) / len(g) >= 15:
        short.add(o["team"])
flags = []
for t in {p["team"] for p in doc.get("players", [])}:
    tot = sum(p["min"] for p in doc["players"] if p["team"] == t)
    if tot > 241:
        flags.append("%s projects for %.0f team minutes (more than 240)." % (t, tot))
for p in doc.get("players", []):
    g = recent(p["team"], p["player"])
    if len(g) >= 2 and p["min"] > 0:
        avg = sum(x["min"] for x in g) / len(g)
        if p["min"] - avg >= 10 and p["team"] not in short:
            flags.append("%s (%s) projects for %.0f minutes but has averaged %.0f in his last %d games." % (p["player"], p["team"], p["min"], avg, len(g)))
    if (p.get("own") or 0) >= 75:
        flags.append("%s (%s) is at %.0f%% Own%%, which is very high." % (p["player"], p["team"], p["own"]))
for f in flags:
    print(f)
sys.exit(1 if flags else 0)
