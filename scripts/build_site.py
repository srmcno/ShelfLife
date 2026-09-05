"""Package only the playable assets for GitHub Pages."""
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ("index.html", "manifest.webmanifest", "service-worker.js", "css", "src", "icons", "assets")


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
    (output / ".nojekyll").touch()
    (output / "release.json").write_text(json.dumps({"revision": revision, "channel": "tester"}) + "\n")
    return output


if __name__ == "__main__":
    print(f"Packaged game: {build()}")
