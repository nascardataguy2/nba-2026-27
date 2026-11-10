"""Nightly live scorecard: how our lock-time numbers did against what really happened.

For every past day with both our lock-time history (data/proj_history/DATE.json) and the
box score (data/proj_history/box/DATE.json):
  - proj_miss: average DK points off for players we projected 10+ minutes who played;
  - own_miss: average Own% points off on the real top-five owned players on the DK main slate
    (data/actual_own.json), matching by name or by salary + last name.
Writes data/live_scorecard.json (newest first). These are live results, not backtests.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from projections import load_json, D, HIST, norm  # noqa: E402


def main():
    act = load_json(os.path.join(D, "actual_own.json"), {})
    out = []
    for fn in sorted(os.listdir(HIST)):
        day = fn[:10]
        if not (fn.endswith(".json") and fn[:4].isdigit() and len(fn) == 15):
            continue
        bf = os.path.join(HIST, "box", fn)
        if not os.path.exists(bf):
            continue
        h = load_json(os.path.join(HIST, fn), {})
        box = {norm(x["player"]): x for x in load_json(bf, [])}
        pm = [abs(x["dk"] - box[k]["dk"]) for k, x in h.items()
              if k in box and x.get("dk") is not None and (x.get("min") or 0) >= 10 and box[k]["min"] > 0]
        rec = {"date": day, "proj_miss": round(sum(pm) / len(pm), 2) if pm else None, "proj_players": len(pm)}
        a = act.get(day)
        if a and a.get("players"):
            om = []
            for p in a["players"]:
                k = norm(p["player"])
                x = h.get(k)
                if not x:
                    c = [v for v in h.values() if v.get("salary") == p.get("salary") and norm(v["player"]).split(" ")[-1] == k.split(" ")[-1]]
                    x = c[0] if len(c) == 1 else None
                if x and x.get("own") is not None:
                    om.append({"player": p["player"], "real": p["own"], "ours": x["own"]})
                else:
                    om.append({"player": p["player"], "real": p["own"], "ours": None})
            got = [abs(o["real"] - o["ours"]) for o in om if o["ours"] is not None]
            rec["own_miss"] = round(sum(got) / len(got), 1) if got else None
            rec["own_top5"] = om
        out.append(rec)
    out.sort(key=lambda r: r["date"], reverse=True)
    with open(os.path.join(D, "live_scorecard.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1)
    r = out[0] if out else {}
    print("scorecard: %s proj miss %s, own miss %s" % (r.get("date"), r.get("proj_miss"), r.get("own_miss")))


if __name__ == "__main__":
    main()
