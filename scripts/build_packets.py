#!/usr/bin/env python3
"""Strip metadata from mission PDFs and build one combined packet per mission
(briefing first, then rules) in files/packets/. Updates data/missions.json.
Usage: python3 scripts/build_packets.py"""
import json, shutil, subprocess
from pathlib import Path
import pikepdf
S = Path(__file__).resolve().parent.parent
LIMIT = 10 * 1024 * 1024

def clean(pdf):
    """Remove author/creator info + XMP metadata."""
    with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
        for k in list(meta.keys()): del meta[k]
    if "/Metadata" in pdf.Root: del pdf.Root.Metadata
    for k in list(pdf.docinfo.keys()): del pdf.docinfo[k]

def strip_file(p):
    with pikepdf.open(p, allow_overwriting_input=True) as pdf:
        clean(pdf); pdf.save(p)

def compress(p):
    if not shutil.which("gs"): return
    tmp = p.with_suffix(".tmp.pdf")
    subprocess.run(["gs", "-q", "-sDEVICE=pdfwrite", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dBATCH",
                    f"-sOutputFile={tmp}", str(p)], check=True)
    if tmp.stat().st_size < p.stat().st_size: tmp.replace(p); strip_file(p)
    else: tmp.unlink()

def main():
    mp = S / "data/missions.json"; missions = json.loads(mp.read_text())
    for m in missions:
        f = m.setdefault("files", {}); f.pop("packet", None)
        parts = [S / f[k] for k in ("briefing", "rules") if f.get(k) and (S / f[k]).exists()]
        for p in parts: strip_file(p)
        if len(parts) < 2: continue
        out = S / f"files/packets/loppian-raiders-mission-{m['mission']}-packet.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        with pikepdf.new() as dst:
            for p in parts:
                with pikepdf.open(p) as src: dst.pages.extend(src.pages)
            clean(dst); dst.save(out)
        if out.stat().st_size > LIMIT: compress(out)
        size = out.stat().st_size
        f["packet"] = str(out.relative_to(S))
        print(f"Mission {m['mission']}: {out.name} {size/1024:.0f} KB" + ("  WARNING: over Discord's 10 MB limit" if size > LIMIT else ""))
    mp.write_text(json.dumps(missions, indent=2, ensure_ascii=False) + "\n")

if __name__ == "__main__": main()
