"""Package only the playable assets for GitHub Pages."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ("index.html", "move.html", "privacy.html", "delete-account.html", "manifest.webmanifest", "service-worker.js", "css", "src", "icons", "assets")


def build(output=None):
    output = Path(output) if output else ROOT / "dist"
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for name in PUBLIC:
        source, target = ROOT / name, output / name
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            shutil.copy2(source, target)
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    worker = output / "service-worker.js"
    worker.write_text(re.sub(r"const CACHE_VERSION = '[^']+';", f"const CACHE_VERSION = 'shelflife-{revision[:12]}';", worker.read_text()))
    # The packaged copy says which commit it is, for feedback reports.
    version = output / "src" / "version.js"
    version.write_text(re.sub(r"export const COMMIT = '[^']*';", f"export const COMMIT = '{revision[:7]}';", version.read_text()))
    # Moving house (src/move.js): the old address's build names the new home,
    # the new address's build names the old ones it takes shelves from.
    move_to = os.environ.get("SHELFLIFE_MOVE_TO", "").strip()
    move_from = [u.strip() for u in os.environ.get("SHELFLIFE_MOVE_FROM", "").split(",") if u.strip()]
    for url in [move_to, *move_from]:
        if url and not re.fullmatch(r"https://[^\s/?#@]+(/[^\s?#@]*)?/", url) and not re.fullmatch(r"http://(localhost|127\.0\.0\.1)(:\d+)?(/[^\s?#@]*)?/", url):
            raise ValueError(f"Move address must be an https base URL ending in /: {url}")
    (output / "src" / "move-config.js").write_text(
        (ROOT / "src" / "move-config.js").read_text()
        .replace("export const MOVE_TO = '';", "export const MOVE_TO = " + json.dumps(move_to) + ";")
        .replace("export const MOVE_FROM = [];", "export const MOVE_FROM = " + json.dumps(move_from) + ";"))
    (output / ".nojekyll").touch()
    (output / "release.json").write_text(json.dumps({"revision": revision, "channel": "production"}) + "\n")
    return output


if __name__ == "__main__":
    print(f"Packaged game: {build()}")
