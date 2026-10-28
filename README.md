# Loppian Raiders
*JAX OPR · Voidsun Campaign tracker*

Static site, no build step: plain HTML/CSS/JS reading JSON from `data/`. Players view only; updates are made by editing data files.

## Preview locally
```
cd campaign-site
python3 -m http.server 8000
# open http://localhost:8000
```
(Opening `index.html` straight from disk won't load the data; browsers block `fetch` on `file://`.)

## Layout
| Path | What |
|---|---|
| `index.html` / `missions.html` / `factions.html` / `log.html` | The four pages (all rendered by `js/app.js`) |
| `data/players.json` | Factions: id, loreName, army, commander (**no Discord names or real names**) |
| `data/results.json` | VP per faction per mission (generated from the sheet) |
| `data/missions.json` | Mission date, Voidsun number/name, briefing paragraphs, rules (setup/objectives/scoring/special), PDF links |
| `data/current-mission.json` | Which mission is active this month + reporting deadline (home page card) |
| `data/logs/index.json` | List of narrative logs + `pending` entries; each log body is an HTML file in `data/logs/` |
| `files/` | Original briefing/rules PDFs and original log files |

Standings (total VP, games, VP/game) are computed in the browser from `results.json`.

## Add a new mission (plain-language)
You need: the mission number, the briefing PDF and the rules PDF.
1. Open a terminal in this `campaign-site` folder (one time: `pip install pikepdf`).
2. Run (change the number, title and file paths):
   `python3 scripts/add_mission.py 5 --title "Name of the mission" --date 2026-11-29 --voidsun 18 --voidsun-name "Voidsun mission name" --briefing ~/Downloads/briefing.pdf --rules ~/Downloads/rules.pdf`
3. That's it. The script copies both PDFs into `files/`, removes author info from them, puts the briefing text on the page, and makes the combined download `files/packets/loppian-raiders-mission-5-packet.pdf`. The mission card then shows a **Download rules + briefing (1 PDF)** button (if only one PDF exists, just that one is linked).
4. The rules summary (objectives/scoring/special rules dropdowns) is optional; without it the card says "See the rules PDF". Ask Grok Bot to fill it in from the PDF if you want it.
5. Record the scores as below, then publish (upload the changed files).

Rebuild all packets any time with `python3 scripts/build_packets.py` (prints each size; warns if one is over Discord's 10 MB free upload limit and tries to compress it with Ghostscript).

## Change the current mission (monthly)
The **Current Mission** card at the top of the home page is driven by `data/current-mission.json`:
```
{ "mission": 5, "month": "November 2026", "deadline": "2026-11-30", "deadlineUtcOffset": "-05:00" }
```
Change `mission` (must exist in `data/missions.json`), `month` and `deadline` (YYYY-MM-DD; due end of that day). Use `-04:00` for Eastern daylight time and `-05:00` for standard time (after early November). The card shows days left, then "Deadline passed". Delete the file to hide the card.

## Add a new mission result
1. Enter the result in the Google Sheet ("Mission Data": one Faction/VP pair per faction; faction names must match "Lore Name" in "Player Info"). Column position doesn't matter.
2. Download it as .xlsx (keep it **outside** this folder – it has Discord/real names).
3. `pip install openpyxl` then `python3 scripts/build_from_sheet.py ~/Downloads/sheet.xlsx`
   – rewrites `data/players.json` and `data/results.json`, and warns about unknown factions or player-count mismatches.
4. If the mission is new, use `add_mission.py` above (or add it to `data/missions.json` by hand: (copy an existing entry: `mission`, `date`, `voidsunMission`, `voidsunName`, `title`, `briefing` [paragraphs], `rules` {background, setup[], objectives[], scoring[], special[[name, text]]}, `files`), and put the PDFs in `files/briefings/` and `files/rules/`).

## Add a narrative log
Plain version: send the player's report (Word or PDF) to Grok Bot and say which mission and character it's for; it will do the steps below and clear the "pending" card.

Technical steps:
1. Convert the report to HTML paragraphs (`<p>…</p>`; images go in `files/logs/img/` and are referenced with `<img src="files/logs/img/…">`). For .docx: `python3 -c "import mammoth,sys;print(mammoth.convert_to_html(open(sys.argv[1],'rb')).value)" report.docx > data/logs/m5-captain-tiberius.html`
2. Copy the original into `files/logs/`.
3. Add an entry to `data/logs/index.json` → `logs`: `{"id","mission","author","faction" (player id),"title","subtitle","body":"data/logs/<id>.html","original":"files/logs/<file>"}`. Remove any matching `pending` entry.
4. If a player will **not** write a log for a mission, add `{"mission": N, "faction": "<player id>", "note": "…"}` to `noLogExpected` in `data/logs/index.json` (and drop its `pending` entry). The site never shows a pending card for those, and the importer (`gen.py`) keeps the list and skips them.

## Share on Discord
Pin a message in your campaign channel with just the site link (and optionally a link per page, e.g. `.../missions.html#mission-5`). Each page has Open Graph title/description tags, so Discord shows a tidy preview card. For a new mission, post the packet PDF (Download rules + briefing button) as an attachment along with the link.

## Hosting
GitHub Pages (free) serves this folder as-is; the free tier requires a public repo, so everything here is public.

All paths are relative, so the site works at a project URL like `https://user.github.io/repo/`.

Note: `/workspace/campaign-build/gen.py` (Grok Bot's one-time importer) rewrites `data/missions.json` for missions 1–4 only; after adding missions with `add_mission.py`, don't re-run it.
