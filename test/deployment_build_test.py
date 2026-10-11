import base64
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("site_build", ROOT / "scripts/build_site.py")
site_build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site_build)


def legacy_key(role):
    payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
    return "e30." + payload + ".fake-test-signature"


class DeploymentBuildTests(unittest.TestCase):
    def env(self, project="staging", key="sb_publishable_test_fixture"):
        return {"NEXT_PUBLIC_SUPABASE_URL": f"https://{project}.supabase.co/",
                "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": key,
                "SHELFLIFE_PUBLIC_URL": f"https://{project}.example.test/game/",
                "VERCEL_TARGET_ENV": project,
                "SUPABASE_SERVICE_ROLE_KEY": "private-test-fixture-not-for-browser"}

    def test_managed_build_refuses_missing_or_partial_settings_before_removing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dist"
            output.mkdir()
            marker = output / "previous-release"
            marker.write_text("keep")
            for env in ({}, {"NEXT_PUBLIC_SUPABASE_URL": "https://stage.supabase.co"},
                        {"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test"},
                        {"NEXT_PUBLIC_SUPABASE_URL": "https://stage.supabase.co", "NEXT_PUBLIC_SUPABASE_ANON_KEY": legacy_key("anon")}):
                with self.subTest(keys=list(env)):
                    with self.assertRaises(ValueError):
                        site_build.build(output, env=env, require_cloud=True)
                    self.assertEqual(marker.read_text(), "keep")

    def test_privileged_and_malformed_keys_are_never_packaged(self):
        for key in ("sb_secret_test_fixture", legacy_key("service_role"), legacy_key("authenticated"), "not-a-key", "a.!.c"):
            with self.subTest(kind=key.split("_")[0]):
                with self.assertRaisesRegex(ValueError, "secret and service-role"):
                    site_build.deployment_settings(self.env(key=key), True)

    def test_legacy_anon_key_is_supported(self):
        env = self.env()
        del env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
        env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = legacy_key("anon")
        config, url = site_build.deployment_settings(env, True)
        self.assertEqual(config["anonKey"], env["NEXT_PUBLIC_SUPABASE_ANON_KEY"])
        self.assertEqual(config["url"], "https://staging.supabase.co")
        self.assertEqual(url, "https://staging.example.test/game/")

    def test_preview_share_links_use_the_actual_preview_origin(self):
        env = self.env()
        del env["SHELFLIFE_PUBLIC_URL"]
        env.update(VERCEL_ENV="preview", VERCEL_URL="shelflife-preview.example.test")
        _, url = site_build.deployment_settings(env, True)
        self.assertEqual(url, "https://shelflife-preview.example.test/")
        env["VERCEL_ENV"] = "production"
        with self.assertRaisesRegex(ValueError, "SHELFLIFE_PUBLIC_URL"):
            site_build.deployment_settings(env, True)

    def test_unsafe_backend_or_site_urls_are_refused(self):
        for key, values in {
            "NEXT_PUBLIC_SUPABASE_URL": ["http://stage.supabase.co", "https://user:password@stage.supabase.co", "https://stage.supabase.co/api", "https://stage.supabase.co?secret=x"],
            "SHELFLIFE_PUBLIC_URL": ["javascript:alert(1)", "https://user:password@game.test/", "https://game.test/#token", "https://game.test/?token=x", "https://game.test:wrong/", "https://game.test:65536/", "https://game.test:0/"],
        }.items():
            for value in values:
                with self.subTest(setting=key, value=value):
                    env = self.env(); env[key] = value
                    with self.assertRaises(ValueError):
                        site_build.deployment_settings(env, True)

    def test_hosted_revision_does_not_require_a_git_checkout(self):
        env = self.env()
        env["VERCEL_GIT_COMMIT_SHA"] = "abcdef0123" * 4
        with tempfile.TemporaryDirectory() as directory, patch.object(site_build.subprocess, "check_output", side_effect=AssertionError("no Git checkout")):
            output = site_build.build(Path(directory) / "dist", env=env, require_cloud=True)
            self.assertEqual(json.loads((output / "release.json").read_text())["revision"], env["VERCEL_GIT_COMMIT_SHA"])
            self.assertIn("shelflife-abcdef0123ab", (output / "service-worker.js").read_text())

    def test_invalid_hosted_revision_preserves_previous_output(self):
        env = self.env()
        env["VERCEL_GIT_COMMIT_SHA"] = "unverified-revision"
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dist"
            output.mkdir()
            marker = output / "previous-release"
            marker.write_text("keep")
            with self.assertRaises(ValueError):
                site_build.build(output, env=env, require_cloud=True)
            self.assertEqual(marker.read_text(), "keep")

    def test_packaged_runtime_uses_its_backend_and_share_url_without_server_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = site_build.build(Path(directory) / "dist", env=self.env(), require_cloud=True)
            # Load the actual generated modules, including both downstream callers.
            result = subprocess.check_output(["node", "--input-type=module", "-e",
                "const root=process.argv[1]; const c=await import(root+'/src/cloud/config.js'); "
                "const b=await import(root+'/src/backup.js'); console.log(JSON.stringify({cloud:c.cloudConfig(),share:b.transferInstructions('saved.json')}));",
                output.as_uri()], text=True)
            loaded = json.loads(result)
            self.assertEqual(loaded["cloud"], {"url": "https://staging.supabase.co", "anonKey": "sb_publishable_test_fixture"})
            self.assertIn("https://staging.example.test/game/", loaded["share"])
            self.assertNotIn("srmcno.github.io", loaded["share"])
            deployment = (output / "src/cloud/deployment-config.js").read_text()
            self.assertNotIn("private-test-fixture-not-for-browser", deployment)
            self.assertEqual(json.loads((output / "release.json").read_text())["channel"], "staging")
            self.assertIn('"./src/cloud/deployment-config.js"', (output / "service-worker.js").read_text())

    def test_environment_changes_invalidate_the_cache_even_for_the_same_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            names = []
            for project in ("staging", "production", "staging"):
                output = site_build.build(Path(directory) / "dist", env=self.env(project), require_cloud=True)
                names.append(re.search(r"const CACHE_VERSION = '([^']+)'", (output / "service-worker.js").read_text()).group(1))
            self.assertNotEqual(names[0], names[1])
            self.assertEqual(names[0], names[2])

    def test_default_build_preserves_existing_distribution_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            output = site_build.build(Path(directory) / "dist", env={})
            deployed = (output / "src/cloud/deployment-config.js").read_text()
            self.assertIn("DEPLOYED_CLOUD_CONFIG = null", deployed)
            self.assertIn("DEPLOYED_PUBLIC_URL = null", deployed)
            self.assertEqual(json.loads((output / "release.json").read_text())["channel"], "production")


if __name__ == "__main__":
    unittest.main()
