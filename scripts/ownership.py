"""Estimated ownership: simulate the field.

The field does not use our projections. Most players build from free public
numbers, so each simulated lineup uses DailyFantasyFuel's DraftKings projection
(ours when DFF has none) with random noise, because real players use different
numbers. Each player's simulated share then goes through a correction fit on
real DraftKings GPP ownership: the five most-owned players on every main slate,
from Fantasy Team Advice's free Ownership History page (scripts/actual_own.py).
Everyone else on a slate is known to be below the fifth-highest, and the fit
uses that too.

Tested on 14 real main slates (Oct. 23 to Nov. 6), each one held out while
fitting on the others: the top-five average miss was 22.8 points for the old
model, 16.8 for the model fit on show numbers, and 11.7 for this one.

scripts/own_fit.py refits the correction weekly as real slates come in and
keeps a new fit only if it misses less on slates it did not see. The weights
live in data/own_model.json.

This is still an estimate before lock, not real ownership.

Writes "own" (percent) on each player in data/projections.json, and saves each
player's simulated share and field projection at lock for the weekly refit.
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
BUMP_STARS = 0.0     # listed in Stars & Scrubs (off: the fit above was tested without it)
BUMP_OUT = 0.05      # projected for more minutes because a teammate is out
BUMP_TOTAL = 0.005   # per point of game total above the slate average
CORE = ["PG", "SG", "SF", "PF", "C", "G", "F"]
# Correction weights. Features: 1, log(sim share + 0.5), field value z-score, field projection
# z-score, log(field value rank), salary / 10000, log(games on the slate). Fit on real
# DraftKings ownership; scripts/own_fit.py updates data/own_model.json weekly.
BETA_DEFAULT = [-0.4527, 0.526, -0.1185, 0.0514, -0.16, -0.2294, 0.0128]
OWN_MAX = 40.0  # hard limit (Pearce 11/12): 40% is already very high in the big main GPP; a 70%+ number looks wrong. The extra goes to everyone else.


def beta():
    m = load_json(os.path.join(D, "own_model.json"), {})
    b = m.get("beta")
    return b if isinstance(b, list) and len(b) == 7 else BETA_DEFAULT


def features(pool, raw):
    pr = np.array([p.get("_fdk") or p["dk"] for p in pool], dtype=float)
    sal = np.array([p["salary"] for p in pool], dtype=float)
    sim = np.array([raw.get(p["player"], 0.0) for p in pool])
    val = pr / sal * 1000
    vz = (val - val.mean()) / (val.std() + 1e-9)
    pz = (pr - pr.mean()) / (pr.std() + 1e-9)
    vr = np.argsort(np.argsort(-val)) + 1
    games = len({tuple(sorted((p["team"], p.get("opp", "")))) for p in pool})
    return np.column_stack([np.ones(len(pool)), np.log(sim + 0.5), vz, pz, np.log(vr), sal / 10000.0, np.full(len(pool), np.log(max(games, 1)))])


def shares(X, b, cap=OWN_MAX):
    v = np.clip(np.exp(X @ np.array(b)) - 0.5, 0.05, None)
    v = v / v.sum() * 800.0  # eight roster spots
    for _ in range(10):
        over = v > cap
        if not over.any():
            break
        ex = (v[over] - cap).sum()
        v[over] = cap
        v[~over] += ex * v[~over] / v[~over].sum()
    return v


SHOW_W = 0.5  # starting weight for a show's stated ownership; the nightly scorecard checks it


def calibrate(pool, raw, show=None):
    """Turn simulated shares into estimates that match real field ownership.
    show = {player: projected own%} stated on today's DFS shows (data/show_own.json, mostly
    Stokastic). Each named player is pulled halfway to the show's number; the slate is then
    rescaled to 800% through the other players, and the site limit is applied last.
    On 11/10 the show's numbers missed real ownership by 9.4 points on average for the four
    players we can check, ours by 18.5 (four players, so this weight is a starting point)."""
    if not raw or len(pool) < 8:
        return raw
    v = shares(features(pool, raw), beta(), cap=85.0)
    if show:
        hit = np.array([p["player"] in show for p in pool])
        if hit.any():
            for i, p in enumerate(pool):
                if hit[i]:
                    v[i] = (1 - SHOW_W) * v[i] + SHOW_W * show[p["player"]]
            rest = 800.0 - v[hit].sum()
            if rest > 0 and v[~hit].sum() > 0:
                v[~hit] *= rest / v[~hit].sum()
    v = limit(v)
    return {p["player"]: round(float(x), 1) for p, x in zip(pool, v)}


KNEE = 25.0   # below this, numbers are left alone
TOP = 38.0    # the most-owned player shows at most this (always under OWN_MAX)


def limit(v):
    """Site limit (Pearce 11/12): keep Own% believable. Everything above KNEE is squeezed in
    the same proportion so the top player lands at TOP or lower and the order stays the
    same (no row of players stuck at the cap). What is taken off goes to the players under
    KNEE in proportion, so the slate still adds to 800%."""
    v = np.array(v, dtype=float)
    hi = v.max()
    if hi <= TOP:
        return v
    k = (TOP - KNEE) / (hi - KNEE)
    over = v > KNEE
    cut = ((v[over] - KNEE) * (1 - k)).sum()
    v[over] = KNEE + (v[over] - KNEE) * k
    under = ~over
    if under.any() and v[under].sum() > 0:
        v[under] += cut * v[under] / v[under].sum()
    return np.minimum(v, OWN_MAX)


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
    """The field's projection for each player: DailyFantasyFuel's DraftKings projection
    (every player on its classic slates), or ours when DFF has none. Stored as _fdk for the simulation only."""
    import html
    import re
    from projections import get, DFF_URL, dff_all
    dff = {}
    try:  # every player on DFF's classic slates (the projections page shows only 25 without a login)
        for r in dff_all(doc.get("date")):
            if r.get("ppg") is not None:
                dff.setdefault(norm(r["player"]), r["ppg"])
    except Exception as e:
        print("ownership: DFF slate data unavailable (%s); using the projections page" % e)
    try:
        page = get(DFF_URL) if not dff else ""
        for attrs in re.findall(r'<tr class="[^"]*projections-listing[^"]*"([^>]*)>', page):
            a = {k: html.unescape(v) for k, v in re.findall(r'data-([a-z_0-9]+)=\s*"([^"]*)"', attrs)}
            if a.get("name") and a.get("start_date", doc.get("date")) == doc.get("date"):
                try:
                    dff[norm(a["name"])] = float(a.get("ppg_proj") or 0)
                except ValueError:
                    pass
    except Exception as e:  # DFF down: fall back to our projections
        print("ownership: DFF projections unavailable (%s); using ours" % e)
    for p in doc["players"]:
        f = dff.get(norm(p["player"]))
        if not f:  # spelling differs: same last name, one match
            last = norm(p["player"]).split(" ")[-1]
            c = [v for k, v in dff.items() if k.split(" ")[-1] == last]
            f = c[0] if len(c) == 1 else None
        p["_fdk"] = f if f and f > 0 else (p.get("dk") or 0)


def save_history_own(doc, sims=None):
    """Keep each player's Own% in data/proj_history/DATE.json, frozen once his game tips,
    with his simulated share (osim) and field projection (ofdk) for the weekly refit."""
    from datetime import datetime, timezone
    hp = os.path.join(D, "proj_history", doc.get("date", "") + ".json")
    hist = load_json(hp, None)
    if not hist:
        return
    now = os.environ.get("NOW_UTC") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    # Ownership is set when the slate locks, not when each game tips: once the main slate's
    # first game starts, DraftKings and DFF drop it and later runs fall back to our own
    # projections (11/9: the 7:18 PM run wrote Barrett 68.5% over the 6:48 PM 43.9%; real was
    # 50.7%). So each row keeps the lock time it first got, and is never written after it.
    tip = {}
    for g in doc.get("games", []):
        if g.get("time"):
            tip[g.get("home")] = tip[g.get("away")] = g["time"]
    main_teams = {p["team"] for p in doc["players"] if (sims or {}).get(p["player"], (0, 0, ""))[2] == "main"}
    main_lock = min([tip[t] for t in main_teams if t in tip] or [""]) or None
    for p in doc["players"]:
        h = hist.get(norm(p["player"]))
        if h is None or p.get("own") is None:
            continue
        sm = (sims or {}).get(p["player"])
        if not h.get("lock"):
            lk = main_lock if (sm and sm[2] == "main" and main_lock) else tip.get(p["team"])
            if lk:
                h["lock"] = lk
        if h.get("lock") and h["lock"] <= now:
            continue
        h["own"] = p["own"]
        if sm:
            h["osim"], h["ofdk"], h["oslate"] = round(sm[0], 2), round(sm[1], 2), sm[2]
            h["salary"] = p.get("salary")
    with open(hp, "w", encoding="utf-8") as fh:
        json.dump(hist, fh, indent=1, ensure_ascii=False)


def main():
    path = os.path.join(D, "projections.json")
    doc = load_json(path, {})
    if not doc.get("players"):
        return
    field_view(doc)
    ss = load_json(os.path.join(D, "stars.json"), {})
    ss_names = {p["player"] for p in ss.get("stars", []) + ss.get("scrubs", [])} if ss.get("date") == doc.get("date") else set()
    has_ids = any(p.get("dkid") for p in doc["players"])
    own, sims = {}, {}
    # Projected ownership the shows stated for today's slate (the transcript helpers write it).
    show = {}
    for name, val in load_json(os.path.join(D, "show_own.json"), {}).get(doc.get("date"), {}).items():
        nk = norm(name)
        for p in doc["players"]:
            if norm(p["player"]) == nk:
                show[p["player"]] = float(val[0]) if isinstance(val, list) else float(val)
    for k, slate in enumerate(("main", "late")):
        pool = [p for p in doc["players"] if p.get("salary") and p.get("dk") and p.get("min", 0) >= 8
                and (p.get("slate") or "main") == slate and (p.get("dkid") or not has_ids) and not p.get("out")]
        raw = simulate(pool, ss_names if slate == "main" else set(), seed=k + 1)
        for p in pool:
            sims[p["player"]] = (raw.get(p["player"], 0.0), p.get("_fdk") or p["dk"], slate)
        own.update(calibrate(pool, raw, show if slate == "main" else None))
    for p in doc["players"]:
        if (p.get("slate") or "main") in ("main", "late") and p.get("salary"):
            p["own"] = own.get(p["player"], 0.0)
        else:
            p.pop("own", None)
    for p in doc["players"]:
        p.pop("_fdk", None)
    doc["own_note"] = "Estimated ownership from %d simulated lineups per slate built on public projections, corrected against real DraftKings ownership from past slates and blended with projected ownership stated on today's DFS shows. It is our estimate, not real ownership." % N
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    save_history_own(doc, sims)
    top = sorted(((v, k) for k, v in own.items()), reverse=True)[:5]
    print("ownership:", ", ".join("%s %.0f%%" % (k, v) for v, k in top))


if __name__ == "__main__":
    main()
