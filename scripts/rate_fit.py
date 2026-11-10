"""Learn how much to trust SportsLine's DK-points-per-minute vs. the player's own season rate.

Our DK projection = minutes x rate. SportsLine's rate already bakes in its own bumps (a
teammate out, matchup), and on 11/9 it ran far too hot (RJ Barrett 1.76 DK a minute vs. 1.12
for his season). This blends the two:
    rate = (1 - w) x SportsLine rate + w x his season rate before that day (3+ games).

Every run it re-tests w on real box scores:
  - fit w on the older half of the dates, test it on the newer half it never saw;
  - the new w (fit on every date) goes live only if, on that test half, the blend beats
    SportsLine alone AND beats the w already in use.
Writes data/rate_model.json and appends the check to data/rate_scorecard.json.
"""
import glob
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, HIST, norm  # noqa: E402

MODEL = os.path.join(D, "rate_model.json")
CARD = os.path.join(D, "rate_scorecard.json")


def rows():
    g = load_json(os.path.join(D, "gamelogs.json"), {})
    out = []
    for f in sorted(glob.glob(os.path.join(HIST, "2*.json"))):
        day = os.path.basename(f)[:10]
        bf = os.path.join(HIST, "box", day + ".json")
        if not os.path.exists(bf):
            continue
        box = {norm(x["player"]): x for x in load_json(bf, [])}
        for k, x in load_json(f, {}).items():
            b = box.get(k)
            if not b or not x.get("min") or x["min"] < 10 or b["min"] < 10 or x.get("dk") is None:
                continue
            prior = [r for r in g.get(k, []) if r[0] < day and r[5] > 0]
            if len(prior) < 3:
                continue
            season = sum(r[13] for r in prior) / sum(r[5] for r in prior)
            out.append((day, x.get("slr") or x["dk"] / x["min"], season, x["min"], b["dk"]))
    return out


def miss(rs, w):
    return sum(abs(((1 - w) * sl + w * se) * m - real) for _, sl, se, m, real in rs) / max(len(rs), 1)


def best(rs):
    return min((miss(rs, i / 20.0), i / 20.0) for i in range(21))[1]


def main():
    rs = rows()
    days = sorted({r[0] for r in rs})
    cur = load_json(MODEL, {}).get("w", 0.0)
    if len(days) < 6:
        print("rate_fit: not enough days yet (%d)" % len(days))
        return
    cut = days[len(days) // 2]
    early = [r for r in rs if r[0] < cut]
    late = [r for r in rs if r[0] >= cut]
    w_early = best(early)
    sl_only, blend, current = miss(late, 0.0), miss(late, w_early), miss(late, cur)
    w_all = best(rs)
    adopt = blend < sl_only and blend <= current
    new = w_all if adopt else cur
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    with open(MODEL, "w") as fh:
        json.dump({"w": new, "updated": stamp, "games": len(rs), "days": len(days)}, fh, indent=1)
    card = load_json(CARD, [])
    card.append({"when": stamp, "test_games": len(late), "baseline_only_miss": round(sl_only, 2),
                 "blend_miss": round(blend, 2), "current_w_miss": round(current, 2),
                 "w_test": w_early, "w_live": new, "adopted": adopt})
    with open(CARD, "w") as fh:
        json.dump(card[-200:], fh, indent=1)
    print("rate_fit: test %d games, baseline only %.2f, blend %.2f (w=%.2f), current %.2f -> live w=%.2f" % (
        len(late), sl_only, blend, w_early, current, new))


if __name__ == "__main__":
    main()
