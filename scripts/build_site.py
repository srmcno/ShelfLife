"""Package only playable assets, with public settings for the target environment."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ("index.html", "move.html", "privacy.html", "delete-account.html", "manifest.webmanifest", "service-worker.js", "css", "src", "icons", "assets")


def public_url(value, label, *, backend=False):
    parsed = urlsplit(value)
    # Accessing port validates malformed and out-of-range port specifications.
    port = parsed.port
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or port == 0
            or parsed.query or parsed.fragment or any(c.isspace() for c in value)
            or (backend and parsed.path not in ("", "/"))):
        raise ValueError(f"{label} must be an HTTPS URL without credentials, query or fragment")
    return value.rstrip("/") + ("" if backend else "/")


def deployment_settings(env, require_cloud=False):
    # Only these public values are packaged. Never serialize the environment.
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = (env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "").strip()
    if bool(url) != bool(key) or (require_cloud and not url):
        raise ValueError("Set NEXT_PUBLIC_SUPABASE_URL and a public Supabase key for this deployment environment")
    config = None
    if url:
        if key.startswith("sb_publishable_"):
            valid = bool(re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", key))
        else:
            try:
                parts = key.split(".")
                payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4))) if len(parts) == 3 else {}
                valid = isinstance(payload, dict) and payload.get("role") == "anon"
            except (ValueError, IndexError, UnicodeDecodeError):
                valid = False
        if not valid:
            raise ValueError("Use a Supabase publishable key or legacy anon key; secret and service-role keys must never be packaged")
        config = {"url": public_url(url, "Supabase URL", backend=True), "anonKey": key}
    site = env.get("SHELFLIFE_PUBLIC_URL", "").strip()
    # Preview links should point to this build, never the production website.
    if not site and env.get("VERCEL_ENV") == "preview" and env.get("VERCEL_URL"):
        site = "https://" + env["VERCEL_URL"].strip()
    if require_cloud and not site:
        raise ValueError("Set SHELFLIFE_PUBLIC_URL to this environment's playable website URL")
    return config, public_url(site, "Game URL") if site else None


def build_revision(env):
    revision = env.get("VERCEL_GIT_COMMIT_SHA", "").strip()
    if revision:
        if not re.fullmatch(r"[a-fA-F0-9]{40}", revision):
            raise ValueError("VERCEL_GIT_COMMIT_SHA must identify the full Git commit")
        return revision.lower()
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def build(output=None, *, require_cloud=False, env=None):
    env = os.environ if env is None else env
    config, site = deployment_settings(env, require_cloud)
    revision = build_revision(env)
    channel = env.get("VERCEL_TARGET_ENV") or env.get("VERCEL_ENV") or "production"
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
    deployed = output / "src" / "cloud" / "deployment-config.js"
    deployed.write_text("// Public deployment settings; contains no server credentials.\n"
                        + "export const DEPLOYED_CLOUD_CONFIG = " + json.dumps(config) + ";\n"
                        + "export const DEPLOYED_PUBLIC_URL = " + json.dumps(site) + ";\n")
    # Same code with changed environment settings must replace an old PWA cache.
    suffix = "-" + hashlib.sha256(json.dumps([config, site], sort_keys=True).encode()).hexdigest()[:8] if config or site else ""
    worker = output / "service-worker.js"
    worker.write_text(re.sub(r"const CACHE_VERSION = '[^']+';", f"const CACHE_VERSION = 'shelflife-{revision[:12]}{suffix}';", worker.read_text()))
    # The packaged copy says which commit it is, for feedback reports.
    version = output / "src" / "version.js"
    version.write_text(re.sub(r"export const COMMIT = '[^']*';", f"export const COMMIT = '{revision[:7]}';", version.read_text()))
    # Moving house (src/move.js): the old address's build names the new home,
    # the new address's build names the old ones it takes shelves from.
    move_to = env.get("SHELFLIFE_MOVE_TO", "").strip()
    move_from = [u.strip() for u in env.get("SHELFLIFE_MOVE_FROM", "").split(",") if u.strip()]
    for url in [move_to, *move_from]:
        if url and not re.fullmatch(r"https://[^\s/?#@]+(/[^\s?#@]*)?/", url) and not re.fullmatch(r"http://(localhost|127\.0\.0\.1)(:\d+)?(/[^\s?#@]*)?/", url):
            raise ValueError(f"Move address must be an https base URL ending in /: {url}")
    (output / "src" / "move-config.js").write_text(
        (ROOT / "src" / "move-config.js").read_text()
        .replace("export const MOVE_TO = '';", "export const MOVE_TO = " + json.dumps(move_to) + ";")
        .replace("export const MOVE_FROM = [];", "export const MOVE_FROM = " + json.dumps(move_from) + ";"))
    (output / ".nojekyll").touch()
    (output / "release.json").write_text(json.dumps({"revision": revision, "channel": channel}) + "\n")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-cloud", action="store_true", help="refuse missing environment-specific cloud and website settings")
    args = parser.parse_args()
    print(f"Packaged game: {build(require_cloud=args.require_cloud)}")
