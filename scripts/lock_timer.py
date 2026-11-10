"""Run projections on time all day, without Claude.

Morning runs (5:30, 6:30, 7:30 AM ET so shorts.txt is ready for the 8:30
video), daytime backups (8:40 AM, 12:40, 4:40 PM) and lock-time updates
(every 30 minutes from 5:30 PM ET up to the first lock, plus 45, 15 and 5
minutes before each lock, from today's ESPN schedule). It sleeps until each
time and dispatches projections.yml. After a run, if today's projections
have no Own% values, it runs once more.

GitHub jobs stop after 6 hours, so this script stops itself once the next
update is more than WINDOW hours after it started. The workflow chains a few
jobs, and each one picks up the updates that are still ahead.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
REPO = os.environ.get("GITHUB_REPOSITORY", "nascardataguy2/nba-2026-27")
WINDOW = timedelta(hours=5, minutes=15)
PURGE = ["data/db.json", "data/projections.json", "data/brief.json"]


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def lock_times(day):
    url = ("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/"
           f"scoreboard?dates={day:%Y%m%d}")
    for attempt in range(5):
        try:
            data = get(url)
            break
        except Exception as e:  # noqa: BLE001
            print(f"ESPN fetch failed ({e}), retrying")
            time.sleep(15)
    else:
        sys.exit("Could not read the ESPN schedule.")
    out = set()
    for ev in data.get("events", []):
        t = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
        out.add(t.astimezone(ET))
    return sorted(out)


DAY_TIMES = [(5, 30), (6, 30), (7, 30), (8, 40), (12, 40), (16, 40)]


def update_times(locks, now, day_times=True):
    times = set()
    if day_times:
        for h, m in DAY_TIMES:
            times.add(now.replace(hour=h, minute=m, second=0, microsecond=0))
    if locks:
        first = locks[0]
        t = first.replace(hour=17, minute=30, second=0, microsecond=0)
        while t < first:
            times.add(t)
            t += timedelta(minutes=30)
        for lock in locks:
            for m in (45, 15, 5):
                times.add(lock - timedelta(minutes=m))
    kept = []
    for t in sorted(times):
        if kept and t - kept[-1] <= timedelta(minutes=4):
            continue
        kept.append(t)
    return [t for t in kept if t > now]


def gh(*args):
    return subprocess.run(["gh", *args], capture_output=True, text=True)


def latest_run_id():
    r = gh("run", "list", "--repo", REPO, "--workflow", "projections.yml",
           "-L", "1", "--json", "databaseId")
    try:
        return json.loads(r.stdout)[0]["databaseId"]
    except Exception:  # noqa: BLE001
        return None


def own_missing():
    """True when the live projections are for today but have no Own% values."""
    try:
        url = f"https://nascardataguy2.github.io/nba-2026-27/data/projections.json?t={int(time.time())}"
        p = get(url)
    except Exception:  # noqa: BLE001
        return False
    today = datetime.now(ET).date().isoformat()
    players = p.get("players", [])
    return p.get("date") == today and players and not any(x.get("own") is not None for x in players)


def run_update(retry_own=True):
    before = latest_run_id()
    for attempt in range(6):
        r = gh("workflow", "run", "projections.yml", "--repo", REPO, "--ref", "main")
        if r.returncode == 0:
            break
        print(f"dispatch failed: {r.stderr.strip()}")
        time.sleep(10)
    else:
        return "dispatch never went through"
    # Wait for the new run to show up, then for it to finish.
    run_id = None
    for _ in range(30):
        time.sleep(10)
        rid = latest_run_id()
        if rid and rid != before:
            run_id = rid
            break
    if not run_id:
        return "run never appeared"
    deadline = time.time() + 15 * 60
    while time.time() < deadline:
        r = gh("run", "view", str(run_id), "--repo", REPO, "--json", "status,conclusion")
        try:
            info = json.loads(r.stdout)
        except Exception:  # noqa: BLE001
            info = {}
        if info.get("status") == "completed":
            if info.get("conclusion") != "success":
                return f"run {run_id} ended {info.get('conclusion')}"
            break
        time.sleep(15)
    else:
        return f"run {run_id} still going after 15 minutes"
    for f in PURGE:
        try:
            urllib.request.urlopen(
                f"https://purge.jsdelivr.net/gh/{REPO}@main/{f}", timeout=30).read()
        except Exception as e:  # noqa: BLE001
            print(f"purge {f} failed: {e}")
    if retry_own:
        time.sleep(60)  # give GitHub Pages a moment to publish
        if own_missing():
            print("  today's projections have no Own% values; running once more")
            err = run_update(retry_own=False)
            if err:
                return err
            time.sleep(60)
            if own_missing():
                return "Own% values still missing after a second run"
    return None


def main():
    started = datetime.now(ET)
    day = started.date()
    locks = lock_times(day)
    if day.isoformat() == "2026-11-10":  # Claude tasks already cover tonight's locks
        locks = []
    times = update_times(locks, started)
    print("locks:", ", ".join(f"{t:%-I:%M %p}" for t in locks) or "none")
    print("updates:", ", ".join(f"{t:%-I:%M %p}" for t in times) or "none left")
    failures = []
    for t in times:
        if t - started > WINDOW:
            print(f"next update {t:%-I:%M %p} is past this job's window; handing off")
            break
        wait = (t - datetime.now(ET)).total_seconds()
        if wait > 0:
            time.sleep(wait)
        print(f"{datetime.now(ET):%-I:%M:%S %p} update for {t:%-I:%M %p}")
        err = run_update()
        if err:
            print(f"  FAILED: {err}")
            failures.append(f"{t:%-I:%M %p}: {err}")
        else:
            print("  done")
    if failures:
        sys.exit("Updates failed: " + "; ".join(failures))


if __name__ == "__main__":
    main()
