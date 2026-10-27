#!/usr/bin/env python3
"""Add (or update) a mission on the site.
Usage:
  python3 scripts/add_mission.py NUMBER --title "Mission title" [--date 2026-11-29]
         [--voidsun 18 --voidsun-name "Name"] [--briefing briefing.pdf] [--rules rules.pdf]
Copies the PDFs into files/, strips metadata, pulls the briefing text from the
briefing PDF, registers the mission in data/missions.json and rebuilds packets."""
import argparse, json, re, shutil, subprocess
from pathlib import Path
S = Path(__file__).resolve().parent.parent

def text_paras(pdf):
    t = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
    return [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", t) if p.strip()]

def main():
    a = argparse.ArgumentParser(); a.add_argument("number", type=int)
    a.add_argument("--title"); a.add_argument("--date"); a.add_argument("--voidsun", type=int)
    a.add_argument("--voidsun-name"); a.add_argument("--briefing"); a.add_argument("--rules")
    o = a.parse_args(); n = o.number
    mp = S / "data/missions.json"; missions = json.loads(mp.read_text())
    m = next((x for x in missions if x["mission"] == n), None)
    if not m: m = {"mission": n, "briefing": [], "files": {}}; missions.append(m)
    for k, v in (("title", o.title), ("date", o.date), ("voidsunMission", o.voidsun), ("voidsunName", o.voidsun_name)):
        if v is not None: m[k] = v
    m.setdefault("title", f"Mission {n}")
    for kind, src, folder in (("briefing", o.briefing, "briefings"), ("rules", o.rules, "rules")):
        if not src: continue
        dst = S / f"files/{folder}/mission-{n}-{kind}.pdf"; dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst); m.setdefault("files", {})[kind] = str(dst.relative_to(S))
        if kind == "briefing": m["briefing"] = text_paras(dst)[2:] or m["briefing"]
    if "rules" not in m and not m.get("rulesNote"):
        m["rulesNote"] = "See the rules PDF for set-up, objectives and scoring."
    missions.sort(key=lambda x: x["mission"])
    mp.write_text(json.dumps(missions, indent=2, ensure_ascii=False) + "\n")
    print(f"Mission {n} registered."); subprocess.run(["python3", str(S / "scripts/build_packets.py")], check=True)

if __name__ == "__main__": main()
