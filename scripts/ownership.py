"""Estimated ownership: simulate the field with our optimizer.

For each DraftKings slate tonight (main, and late when DraftKings splits the
night), build N lineups. Each lineup uses our DK projections with random noise,
because real players use different numbers, plus small popularity bumps
(listed in Stars & Scrubs, a teammate ruled out, a high game total). Each
player's estimated ownership is the share of the simulated lineups he is in.

This is an estimate, not real ownership. The bumps are starting guesses that
should be tuned against real contest ownership once we have some.

Writes "own" (percent) on each player in data/projections.json.
"""
import json
import os
import sys

import numpy as np
import highspy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D  # noqa: E402

N = 1000          # simulated lineups per slate
NOISE = 0.25      # spread of each player's projection from lineup to lineup
BUMP_STARS = 0.05    # listed in Stars & Scrubs
BUMP_OUT = 0.05      # projected for more minutes because a teammate is out
BUMP_TOTAL = 0.005   # per point of game total above the slate average
CORE = ["PG", "SG", "SF", "PF", "C", "G", "F"]


def elig(pos):
    e = set()
    for x in str(pos).split("/"):
        e.add(x)
        if x in ("PG", "SG"):
            e.add("G")
        if x in ("SF", "PF"):
            e.add("F")
    return e


def simulate(pool, ss_names, seed):
    n = len(pool)
    if n < 8:
        return {}
    E = [elig(p["pos"]) for p in pool]
    h = highspy.Highs()
    h.setOptionValue("output_flag", False)
    inf = highspy.kHighsInf
    for _ in range(n):
        h.addVar(0, 1)
    h.changeColsIntegrality(n, np.arange(n, dtype=np.int32), np.array([highspy.HighsVarType.kInteger] * n))

    def row(lo, hi, idx, val):
        h.addRow(lo, hi, len(idx), np.array(idx, dtype=np.int32), np.array(val, dtype=float))

    row(8, 8, list(range(n)), [1] * n)
    row(-inf, 50000, list(range(n)), [p["salary"] for p in pool])
    for mask in range(1, 128):  # every set of roster spots needs enough eligible players
        spots = {CORE[k] for k in range(7) if mask >> k & 1}
        idx = [i for i in range(n) if E[i] & spots]
        row(len(spots), inf, idx, [1] * len(idx))
    games = {}
    for i, p in enumerate(pool):
        games.setdefault(tuple(sorted((p["team"], p.get("opp", "")))), []).append(i)
    for idx in games.values():  # players from at least two games
        row(-inf, 7, idx, [1] * len(idx))
    h.changeObjectiveSense(highspy.ObjSense.kMaximize)

    ous = [p["ou"] for p in pool if p.get("ou")]
    avg = sum(ous) / len(ous) if ous else 0
    base = []
    for p in pool:
        b = 1.0
        if p["player"] in ss_names:
            b += BUMP_STARS
        if str(p.get("note", "")).startswith("More minutes with"):
            b += BUMP_OUT
        if p.get("ou") and avg:
            b += BUMP_TOTAL * (p["ou"] - avg)
        base.append(p["dk"] * b)
    base = np.array(base)
    rng = np.random.default_rng(seed)
    cnt = np.zeros(n)
    done = 0
    for _ in range(N):
        h.changeColsCost(n, np.arange(n, dtype=np.int32), base * rng.normal(1.0, NOISE, n))
        h.run()
        x = np.array(h.getSolution().col_value)
        if (x > 0.5).sum() == 8:
            cnt += x > 0.5
            done += 1
    if not done:
        return {}
    return {pool[i]["player"]: round(100.0 * cnt[i] / done, 1) for i in range(n)}


def main():
    path = os.path.join(D, "projections.json")
    doc = load_json(path, {})
    if not doc.get("players"):
        return
    ss = load_json(os.path.join(D, "stars.json"), {})
    ss_names = {p["player"] for p in ss.get("stars", []) + ss.get("scrubs", [])} if ss.get("date") == doc.get("date") else set()
    has_ids = any(p.get("dkid") for p in doc["players"])
    own = {}
    for k, slate in enumerate(("main", "late")):
        pool = [p for p in doc["players"] if p.get("salary") and p.get("dk") and p.get("min", 0) >= 8
                and (p.get("slate") or "main") == slate and (p.get("dkid") or not has_ids) and not p.get("out")]
        own.update(simulate(pool, ss_names if slate == "main" else set(), seed=k + 1))
    for p in doc["players"]:
        if (p.get("slate") or "main") in ("main", "late") and p.get("salary"):
            p["own"] = own.get(p["player"], 0.0)
        else:
            p.pop("own", None)
    doc["own_note"] = "Estimated ownership from %d simulated lineups per slate. It is our estimate, not real ownership." % N
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    top = sorted(((v, k) for k, v in own.items()), reverse=True)[:5]
    print("ownership:", ", ".join("%s %.0f%%" % (k, v) for v, k in top))


if __name__ == "__main__":
    main()
