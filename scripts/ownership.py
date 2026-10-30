"""Estimated ownership: simulate the field with our optimizer.

For each DraftKings slate tonight (main, and late when DraftKings splits the
night), build N lineups. Each lineup uses our DK projections with random noise,
because real players use different numbers, plus small popularity bumps
(listed in Stars & Scrubs, a teammate ruled out, a high game total). Each
player's estimated ownership is the share of the simulated lineups he is in.

This is an estimate, not real ownership. The simulated shares then go through
a correction fit on 162 main slates from 2025-26, comparing against real
DraftKings GPP ownership. The field piles onto chalk and value harder than a
plain simulation does. Tested on this season's first slates, the correction
cut the average miss from 2.5 to 2.0 points per player. A top-end correction then
pulls the highest estimates down to what real slates show: the most-owned player
was never above 80% last season. The bumps are still starting guesses.

Writes "own" (percent) on each player in data/projections.json.
"""
import json
import os
import sys

import numpy as np
import highspy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, norm  # noqa: E402

N = 1000          # simulated lineups per slate
NOISE = 0.18      # spread of each player's projection from lineup to lineup (0.18 tested best)
BUMP_STARS = 0.05    # listed in Stars & Scrubs
BUMP_OUT = 0.05      # projected for more minutes because a teammate is out
BUMP_TOTAL = 0.005   # per point of game total above the slate average
CORE = ["PG", "SG", "SF", "PF", "C", "G", "F"]
# Correction fit on 2025-26 slates. Features: log(sim share + 0.5), value z-score,
# projection z-score, log(value rank), salary / 10000, log(games on the slate).
TAIL_X = [0.0, 20.0, 20.2, 21.3, 23.7, 27.2, 31.1, 33.4, 37.5, 44.6, 54.9, 67.9, 76.8, 95.1]
TAIL_Y = [0.0, 20.0, 19.4, 23.4, 25.0, 29.9, 33.0, 35.0, 39.6, 44.5, 47.2, 56.7, 64.0, 77.3]
# Keep estimates boring. Sites that post 60-90% ownership look wrong to readers, so the top
# end is squeezed smoothly into a ceiling: 45% on slates of three games or fewer, 40% otherwise.
# Order is kept (the most-owned player is still the most-owned); only the size is tamed.
def own_max(games):
    return 45.0 if games <= 3 else 40.0


SOFT_START = 22.0  # estimates below this are left as they are

BETA = [2.9412, 0.5014, 0.0137, 0.5663, -0.2167, -1.5089, -0.2552]


def calibrate(pool, raw):
    """Turn simulated shares into estimates that match real field ownership."""
    if not raw or len(pool) < 8:
        return raw
    pr = np.array([p.get("_fdk", p["dk"]) for p in pool], dtype=float)
    sal = np.array([p["salary"] for p in pool], dtype=float)
    sim = np.array([raw.get(p["player"], 0.0) for p in pool])
    val = pr / sal * 1000
    vz = (val - val.mean()) / (val.std() + 1e-9)
    pz = (pr - pr.mean()) / (pr.std() + 1e-9)
    vr = np.argsort(np.argsort(-val)) + 1
    games = len({tuple(sorted((p["team"], p.get("opp", "")))) for p in pool})
    X = np.column_stack([np.ones(len(pool)), np.log(sim + 0.5), vz, pz, np.log(vr), sal / 10000.0, np.full(len(pool), np.log(max(games, 1)))])
    v = np.clip(np.exp(X @ np.array(BETA)) - 0.5, 0.05, None)
    v = v / v.sum() * 800.0  # eight roster spots
    # Top-end correction. On 162 real 2025-26 slates (tens of thousands of entries each) the
    # most-owned player was never above 80% (median about 59%), but the fit above ran hot at
    # the top: players it put at 70-95% really finished near 58%. This map (fit on Oct-Jan
    # slates, checked on Feb-Apr) pulls high estimates down to what really happened, and
    # the ownership it removes goes to the players under 20%. Average miss 2.83 -> 2.79.
    hi = v > 20
    v[hi] = np.interp(v[hi], TAIL_X, TAIL_Y)
    lo = ~hi
    if lo.any():
        v[lo] += (800.0 - v.sum()) * v[lo] / v[lo].sum()
    cap = own_max(games)
    hi = v > SOFT_START
    v[hi] = SOFT_START + (cap - SOFT_START) * np.tanh((v[hi] - SOFT_START) / (cap - SOFT_START))
    lo = ~hi
    if lo.any():  # the ownership taken off the top goes to everyone under SOFT_START, capped there
        for _ in range(8):
            room = lo & (v < SOFT_START)
            ex = 800.0 - v.sum()
            if ex <= 0.01 or not room.any():
                break
            v[room] += ex * v[room] / v[room].sum()
            v[room] = np.minimum(v[room], SOFT_START)
    return {p["player"]: round(float(x), 1) for p, x in zip(pool, v)}


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
        base.append(p.get("_fdk", p["dk"]) * b)
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


def field_view(doc):
    """The field does not use our projections. It sees roughly the minutes a player has
    actually played, so a projection far above his recent minutes (our mistake, or a bump
    the field has not bought) should not turn into huge ownership. For the simulation only,
    blend our minutes halfway toward his last three games and scale his DK points to match."""
    import glob
    day = doc.get("date", "")
    games = {}
    for f in glob.glob(os.path.join(D, "proj_history", "box", "*.json")):
        for x in load_json(f, []):
            if x.get("date", "") < day:
                games.setdefault((x["team"], norm(x["player"])), []).append(x)
    for p in doc["players"]:
        p["_fdk"] = p.get("dk") or 0
        k = (p["team"], norm(p["player"]))
        if k not in games:  # spelling differs (Benedict/Bennedict): same team, same last name
            c = [kk for kk in games if kk[0] == p["team"] and kk[1].split(" ")[-1] == k[1].split(" ")[-1]]
            k = c[0] if len(c) == 1 else k
        g = sorted(games.get(k, []), key=lambda x: x["date"])[-3:]
        m = p.get("min") or 0
        if len(g) >= 2 and m > 0:
            fm = 0.5 * m + 0.5 * sum(x["min"] for x in g) / len(g)
            if str(p.get("note", "")).startswith("More minutes with"):
                fm = max(fm, m - 4)  # injury news the field does see
            p["_fdk"] = p["dk"] * fm / m


def main():
    path = os.path.join(D, "projections.json")
    doc = load_json(path, {})
    if not doc.get("players"):
        return
    field_view(doc)
    ss = load_json(os.path.join(D, "stars.json"), {})
    ss_names = {p["player"] for p in ss.get("stars", []) + ss.get("scrubs", [])} if ss.get("date") == doc.get("date") else set()
    has_ids = any(p.get("dkid") for p in doc["players"])
    own = {}
    for k, slate in enumerate(("main", "late")):
        pool = [p for p in doc["players"] if p.get("salary") and p.get("dk") and p.get("min", 0) >= 8
                and (p.get("slate") or "main") == slate and (p.get("dkid") or not has_ids) and not p.get("out")]
        own.update(calibrate(pool, simulate(pool, ss_names if slate == "main" else set(), seed=k + 1)))
    for p in doc["players"]:
        if (p.get("slate") or "main") in ("main", "late") and p.get("salary"):
            p["own"] = own.get(p["player"], 0.0)
        else:
            p.pop("own", None)
    for p in doc["players"]:
        p.pop("_fdk", None)
    doc["own_note"] = "Estimated ownership from %d simulated lineups per slate, corrected against real DraftKings contest ownership from last season. It is our estimate, not real ownership." % N
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    top = sorted(((v, k) for k, v in own.items()), reverse=True)[:5]
    print("ownership:", ", ".join("%s %.0f%%" % (k, v) for v, k in top))


if __name__ == "__main__":
    main()
