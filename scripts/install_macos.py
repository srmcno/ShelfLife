#!/usr/bin/env python3
"""Build and install a self-contained copy of the game in ~/Applications."""
from pathlib import Path
import plistlib
import shlex
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
APP = Path.home() / "Applications" / "Shelf Life.app"
PUBLIC = ("index.html", "manifest.webmanifest", "service-worker.js", "css", "src", "icons", "assets")


def install():
    contents = APP / "Contents"
    resources = contents / "Resources"
    game = resources / "game"
    macos = contents / "MacOS"
    macos.mkdir(parents=True, exist_ok=True)
    game.mkdir(parents=True, exist_ok=True)
    for name in PUBLIC:
        source, target = ROOT / name, game / name
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True)
        else:
            shutil.copy2(source, target)
    shutil.copy2(ROOT / "scripts" / "desktop.py", resources / "desktop.py")
    launcher = macos / "ShelfLife"
    launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(sys.executable) + ' "$(dirname "$0")/../Resources/desktop.py"\n')
    launcher.chmod(0o755)
    with tempfile.TemporaryDirectory(prefix="shelf-life-icon-") as scratch:
        iconset = Path(scratch) / "ShelfLife.iconset"
        iconset.mkdir()
        for size in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                pixels = size * scale
                target = iconset / f'icon_{size}x{size}{"@2x" if scale == 2 else ""}.png'
                subprocess.run(["/usr/bin/sips", "-z", str(pixels), str(pixels), str(ROOT / "icons" / "icon-512.png"), "--out", str(target)], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["/usr/bin/iconutil", "-c", "icns", str(iconset), "-o", str(resources / "ShelfLife.icns")], check=True)
    revision = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    info = {
        "CFBundleIdentifier": "com.shelflife.local",
        "CFBundleName": "Shelf Life",
        "CFBundleDisplayName": "Shelf Life",
        "CFBundleExecutable": "ShelfLife",
        "CFBundlePackageType": "APPL",
        "CFBundleIconFile": "ShelfLife.icns",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "LSUIElement": True,
        "ShelfLifeRevision": revision,
        "NSHighResolutionCapable": True,
    }
    with (contents / "Info.plist").open("wb") as output:
        plistlib.dump(info, output)
    print(f"Installed {APP} (revision {revision})")


if __name__ == "__main__":
    install()
