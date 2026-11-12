"""Weekly refit of the Own% correction on real DraftKings ownership.

Inputs: data/actual_own.json (real top-five ownership per main slate, from
scripts/actual_own.py) and data/proj_history/DATE.json (each player's
simulated share "osim" and field projection "ofdk" at lock, saved by
scripts/ownership.py).

Once a day, when 3+ new real slates have come in (or with --force), it tests on the real slates added since the last
fit, which the current weights have never seen:
  - current: the weights in data/own_model.json
  - new: weights fit only on the slates before those test slates
The new weights (refit on every slate) go live only if they miss less on the
test slates. Every check is logged in data/own_scorecard.json either way.

Miss = average points off on the real top five, plus how far anyone else was
put above the fifth-highest real number (everyone else is known to be below it).
"""
import argparse
import glob
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, norm  # noqa: E402
from ownership import BETA_DEFAULT, shares  # noqa: E402

MODEL = os.path.join(D, "own_model.json")
CARD = os.path.join(D, "own_scorecard.json")
LAM = 1.0  # pull toward the current weights so a few slates can't swing them hard


def slates():
    act = load_json(os.path.join(D, "actual_own.json"), {})
    out = {}
    for day, a in sorted(act.items()):
        if not a.get("players"):
            continue
        hist = load_json(os.path.join(D, "proj_history", day + ".json"), {})
        pool = [h for h in hist.values() if h.get("oslate") == "main" and h.get("osim") is not None and h.get("salary")]
        if len(pool) < 8:
            continue
        pr = np.array([h["ofdk"] or h.get("dk") or 0 for h in pool], float)
        sal = np.array([h["salary"] for h in pool], float)
        sim = np.array([h["osim"] for h in pool], float)
        val = pr / sal * 1000
        vz = (val - val.mean()) / (val.std() + 1e-9)
        pz = (pr - pr.mean()) / (pr.std() + 1e-9)
        vr = np.argsort(np.argsort(-val)) + 1
        games = max(1, (len({h["team"] for h in pool}) + 1) // 2)
        X = np.column_stack([np.ones(len(pool)), np.log(sim + 0.5), vz, pz, np.log(vr), sal / 10000.0, np.full(len(pool), np.log(games))])
        idx = {norm(h["player"]): i for i, h in enumerate(pool)}
        top = []
        for p in a["players"]:
            k = norm(p["player"])
            i = idx.get(k)
            if i is None:  # spelling differs: same salary, same last name
                c = [j for j, h in enumerate(pool) if h["salary"] == p.get("salary") and norm(h["player"]).split(" ")[-1] == k.split(" ")[-1]]
                i = c[0] if len(c) == 1 else None
            if i is not None:
                top.append((i, p["own"]))
        if top:
            out[day] = (X, top, min(p["own"] for p in a["players"]))
    return out


def miss(b, S, days):
    tot, n = 0.0, 0
    for d in days:
        X, top, low = S[d]
        v = shares(X, b, cap=85.0)
        ti = {i for i, _ in top}
        tot += sum(abs(v[i] - o) for i, o in top)
        n += len(top)
        tot += sum(v[j] - low for j in range(len(v)) if j not in ti and v[j] > low) / 5.0
    return tot / max(n, 1)


def loss(b, S, days, b0):
    L = 0.0
    for d in days:
        X, top, low = S[d]
        v = shares(X, b, cap=85.0)
        ti = {i for i, _ in top}
        L += sum((np.log(v[i] + 1) - np.log(o + 1)) ** 2 for i, o in top)
        L += sum((np.log(v[j] + 1) - np.log(low + 1)) ** 2 for j in range(len(v)) if j not in ti and v[j] > low)
    return L + LAM * float(np.sum((np.array(b[1:]) - np.array(b0[1:])) ** 2))


def fit(S, days, b0):
    r = minimize(lambda b: loss(b, S, days, b0), np.array(b0, float), method="Nelder-Mead",
                 options={"maxiter": 6000, "xatol": 1e-5, "fatol": 1e-5})
    return [round(float(x), 4) for x in r.x]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    model = load_json(MODEL, {})
    b0 = model.get("beta") or BETA_DEFAULT
    today = (datetime.now(timezone.utc) - timedelta(hours=5)).date()
    last = model.get("fit_date")
    if not a.force and last == today.isoformat():
        return  # once a day; it refits whenever 3+ real slates have come in since the last fit
    S = slates()
    through = model.get("through", "")
    test = [d for d in S if d > through]
    train = [d for d in S if d <= through]
    if len(test) < 3:
        print("own_fit: only %d new real slates since %s; waiting" % (len(test), through or "start"))
        return
    cur = miss(b0, S, test)
    cand = fit(S, train, b0) if len(train) >= 5 else b0
    new = miss(cand, S, test)
    keep = bool(new < cur - 0.1)
    card = load_json(CARD, [])
    card.append({"date": today.isoformat(), "test_slates": test, "current_miss": round(float(cur), 2), "new_miss": round(float(new), 2), "adopted": keep})
    with open(CARD, "w", encoding="utf-8") as fh:
        json.dump(card, fh, indent=1)
    model.update({"fit_date": today.isoformat()})
    if keep:
        model.update({"beta": fit(S, list(S), cand), "through": max(S), "slates": len(S)})
    with open(MODEL, "w", encoding="utf-8") as fh:
        json.dump(model, fh, indent=1)
    print("own_fit: tested on %d new slates, current %.1f vs new %.1f points: %s" % (len(test), cur, new, "new weights live" if keep else "kept current"))


if __name__ == "__main__":
    main()
