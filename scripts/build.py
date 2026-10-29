"""Build combined db.json, CSV exports, and the AI paste file from data/*.json."""
import csv
import json
import os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")


def load(name):
    with open(os.path.join(D, name + ".json"), encoding="utf-8") as f:
        return json.load(f)


players, teams, moves, sources = load("players"), load("teams"), load("moves"), load("sources")
quickhits = load("quickhits")
src = {s["id"]: s for s in sources}
# Preseason rankings: NBA.com Top 250 order, flagged with role/health notes from our episodes.
import unicodedata
def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("\u2019", "'").replace(".", "").strip()
    for suf in (" iii", " ii", " jr"):
        if s.endswith(suf):
            s = s[: -len(suf)]
    return s
with open(os.path.join(D, "rankings", "nba-top250-points-2026-27.json"), encoding="utf-8") as f:
    base = json.load(f)
pnote = {norm(p["player"]): p for p in players}
flags = {}
for key, flag in (("out_to_start", "out"), ("role_down", "down"), ("rest_watch", "rest"), ("role_up", "up")):
    for it in quickhits.get(key, []):
        flags.setdefault(norm(it["player"]), (flag, it["text"]))
# Season so far (box scores): DK points and minutes a game, and rank by DK points a game.
_res = {}
try:
    with open(os.path.join(D, "proj_history", "results.json"), encoding="utf-8") as f:
        for _games in json.load(f).values():
            if _games:
                _res[norm(_games[0]["player"])] = _games
except FileNotFoundError:
    pass
season = {}
for _k, _g in _res.items():
    _g = [x for x in _g if x.get("min", 0) > 0]
    if _g:
        season[_k] = {"gp": len(_g), "dk": sum(x["dk"] for x in _g) / len(_g), "min": sum(x["min"] for x in _g) / len(_g),
                      "team": sorted(_g, key=lambda x: x["date"])[-1]["team"]}
_order = sorted((k for k, v in season.items() if v["gp"] >= 2), key=lambda k: -season[k]["dk"])
for _i, _k in enumerate(_order):
    season[_k]["rank"] = _i + 1
rankings = []
for r in base["rows"]:
    k = norm(r["player"])
    flag, text = flags.get(k, ("", ""))
    if not text and k in pnote:
        text = pnote[k]["note"]
    sz = season.get(k)
    team = r["team"]
    if sz:
        team = sz["team"]
        line = "So far: %.1f DK points in %d minutes a game over %d %s%s." % (
            sz["dk"], round(sz["min"]), sz["gp"], "game" if sz["gp"] == 1 else "games",
            " (No. %d in DK points a game)" % sz["rank"] if sz.get("rank") else "")
        text = (text.rstrip() + " " + line).strip() if text else line
    rankings.append({"rank": r["rank"], "player": r["player"], "pos": r["pos"], "team": team,
                     "flag": flag, "change": {"up": "Role up", "down": "Role down", "out": "Out to start", "rest": "Rest watch"}.get(flag, ""), "note": text, "source": "NBA-0929",
                     "gp": sz["gp"] if sz else 0, "dk_avg": round(sz["dk"], 1) if sz else None, "season_rank": sz.get("rank") if sz else None})

# Picks tab: last season's badges, with current team and role from our database.
import base64
from PIL import Image as _Img
import io as _io
with open(os.path.join(D, "badges.json"), encoding="utf-8") as f:
    badge_src = json.load(f)
rank_team = {norm(r["player"]): r["team"] for r in base["rows"] if r["team"] != "FA"}
def role_of(r):
    s = (r or "").lower()
    if not s:
        return ""
    if "injur" in s:
        return "Out"
    if s.startswith("starter") and " or " not in s:
        return "Starter"
    if "6th" in s:
        return "Sixth man"
    return "Bench"
picks = []
for b in badge_src["players"]:
    k = norm(b["player"])
    mine = pnote.get(k)
    team = (mine or {}).get("team") or rank_team.get(k) or b["last_team"]
    picks.append({"player": b["player"], "team": team, "pos": b["pos"], "role": role_of((mine or {}).get("role")),
                  "min": b["min"], "usg": b["usg"], "threes": b["threes"], "reb": b["reb"], "ast": b["ast"],
                  "stocks": b["stocks"], "badges": b["badges"], "ranks": b.get("ranks", {})})
badge_icons = {}
for n in ("minutes", "usage", "threes", "rebounds", "assists", "stocks"):
    im = _Img.open(os.path.join(ROOT, "assets", "badges", "badge-" + n + ".png")).convert("RGBA").resize((64, 64), _Img.LANCZOS)
    buf = _io.BytesIO(); im.save(buf, "PNG", optimize=True)
    badge_icons[n] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

injuries = [p for p in players if p["status"] and p["status"].lower() != "healthy"]
from datetime import datetime as _dt
from zoneinfo import ZoneInfo as _Z
updated = _dt.now(_Z("America/New_York")).date().isoformat()

brief = load("brief") if os.path.exists(os.path.join(D, "brief.json")) else {}
plog = load("player_log") if os.path.exists(os.path.join(D, "player_log.json")) else []
db = {"updated": updated, "brief": brief, "log": [[e["player"], e["date"], e["kind"], e["text"]] for e in plog], "players": players, "teams": teams, "injuries": injuries,
      "moves": moves, "sources": sources, "quickhits": quickhits, "rankings": rankings, "picks": picks, "badge_icons": badge_icons, "picks_rule": badge_src["rule"] + " (" + badge_src["season"] + " season)"}
with open(os.path.join(D, "db.json"), "w", encoding="utf-8") as f:
    json.dump(db, f, indent=1, ensure_ascii=False)


def write_csv(name, rows, cols):
    with open(os.path.join(D, name + ".csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols + ["source_date", "source_url"])
        for r in rows:
            s = src.get(r.get("source"), {})
            w.writerow([r.get(c, "") for c in cols] + [s.get("date", ""), s.get("url", "")])


write_csv("players", players, ["player", "team", "role", "minutes", "usage", "status", "note"])
write_csv("teams", teams, ["team", "starters", "bench", "backup_c", "coach", "notes"])
write_csv("injuries", injuries, ["player", "team", "status", "note"])
write_csv("rankings", rankings, ["rank", "player", "pos", "team", "change", "note"])
write_csv("moves", moves, ["player", "from", "to", "type", "note"])

# Plain-text version for pasting into any AI chat.
L = [f"NBA 2026-27 OFFSEASON DATABASE (updated {updated})",
     "Source: Locked On Fantasy Basketball episodes, read in full. Projections are the host's opinions, not confirmed facts.",
     ""]
L.append("== TEAMS ==")
for t in sorted(teams, key=lambda x: x["team"]):
    L.append(f"{t['team']} | Starters: {t['starters']} | Bench: {t['bench']} | Backup C: {t['backup_c'] or '-'} | Coach: {t['coach'] or '-'}")
    L.append(f"  {t['notes']} [{src[t['source']]['date']}]")
L.append("")
L.append("== PLAYERS ==")
for p in sorted(players, key=lambda x: (x["team"], x["player"])):
    bits = [p["role"]]
    if p["minutes"]:
        bits.append("Min: " + p["minutes"])
    if p["usage"]:
        bits.append("Usage: " + p["usage"])
    if p["status"]:
        bits.append("Status: " + p["status"])
    L.append(f"{p['player']} ({p['team']}) | " + " | ".join(bits) + f" | {p['note']} [{src[p['source']]['date']}]")
L.append("")
L.append("== INJURIES / HEALTH ==")
for p in injuries:
    L.append(f"{p['player']} ({p['team']}): {p['status']}")
L.append("")
L.append("== OFFSEASON MOVES ==")
for m in moves:
    frm = m["from"] or "?"
    extra = (" — " + m["note"]) if m["note"] else ""
    L.append(f"{m['player']}: {frm} -> {m['to']} {('(' + m['type'] + ')') if m['type'] else ''}{extra}")
L.append("")
L.append("== SOURCES ==")
for s in sources:
    L.append(f"{s['date']} | {s['title']} | {s['url']}")
with open(os.path.join(ROOT, "ai.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")
print("built", updated, len(players), "players", len(teams), "teams", len(injuries), "injuries", len(moves), "moves")

# Private Claude copy (data inlined, since GitHub is blocked at school).
with open(os.path.join(ROOT, "scripts", "claude_template.html"), encoding="utf-8") as f:
    tpl = f.read()
safe = lambda s: s.replace("</", "<\\/")
with open(os.path.join(D, "db.json"), encoding="utf-8") as f:
    dbtxt = f.read()
with open(os.path.join(ROOT, "ai.txt"), encoding="utf-8") as f:
    aitxt = f.read()
out = tpl.replace("__DB__", safe(dbtxt)).replace("__AI__", safe(aitxt))
os.makedirs(os.path.join(ROOT, "claude"), exist_ok=True)
with open(os.path.join(ROOT, "claude", "nba-2026-27-database.html"), "w", encoding="utf-8") as f:
    f.write(out)
print("claude copy written")
