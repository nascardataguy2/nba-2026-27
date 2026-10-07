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
src = {s["id"]: s for s in sources}
injuries = [p for p in players if p["status"] and p["status"].lower() != "healthy"]
updated = date.today().isoformat()

db = {"updated": updated, "players": players, "teams": teams, "injuries": injuries,
      "moves": moves, "sources": sources}
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
