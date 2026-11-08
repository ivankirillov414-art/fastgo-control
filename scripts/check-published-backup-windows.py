"""Read back the already tested public Windows releases; no application scenarios."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.request import Request, urlopen

REPO = "ivankirillov414-art/fastgo-control"
SOURCE = "0b465c5d56b14fd830aee926a28cfa7257fee783"


def api(path):
    return json.loads(subprocess.run(["gh", "api", "--method", "GET", f"repos/{REPO}/{path}"], check=True, capture_output=True).stdout)


def public_bytes(url, expected):
    """Stream all public bytes without credentials or installer files on disk."""
    assert url.startswith((f"https://github.com/{REPO}/releases/", f"https://raw.githubusercontent.com/{REPO}/"))
    digest, digest512, size = hashlib.sha256(), hashlib.sha512(), 0
    retain = expected["bytes"] < 8 * 1024 * 1024
    chunks = []
    with urlopen(Request(url, headers={"User-Agent": "FastGo-Public-Release-Readback", "Cache-Control": "no-cache"}), timeout=90) as response:
        assert response.status == 200 and response.url.startswith("https://")
        while block := response.read(1024 * 1024):
            size += len(block)
            assert size <= expected["bytes"], "Unexpected public file size"
            digest.update(block)
            digest512.update(block)
            if retain:
                chunks.append(block)
    assert size == expected["bytes"] and digest.hexdigest() == expected["sha256"], "Public SHA256 mismatch"
    if expected.get("sha512"):
        assert digest512.hexdigest() == expected["sha512"], "Public SHA512 mismatch"
    return {"url": url, "bytes": size, "sha256": digest.hexdigest(), "sha512": digest512.hexdigest(), "authentication": "none", "readback": "PASS"}, b"".join(chunks) if retain else None


def feed(text, app, name, absolute=False):
    text = text.replace("\r\n", "\n")
    match = re.fullmatch(r"version: ([^\n]+)\nfiles:\n  - url: ([^\n]+)\n    sha512: ([A-Za-z0-9+/=]+)\n    size: ([0-9]+)\npath: ([^\n]+)\nsha512: ([A-Za-z0-9+/=]+)\nreleaseDate: ([^\n]+)\n?", text)
    assert match and match[1] == app["version"]
    url = f"https://github.com/{REPO}/releases/download/{app['tag']}/{name}"
    allowed = {url} if absolute else {name, url}
    assert match[2] in allowed and match[5] in allowed
    assert match[3] == match[6] == app["manifest"]["sha512_base64"]
    assert int(match[4]) == app["files"][name]["bytes"]
    return {"version": app["version"], "installer": url, "bytes": int(match[4]), "sha512_base64": match[6]}


def source_file(tag, name, manifest):
    result = api(f"contents/{name}?ref={tag}")
    raw = base64.b64decode(result["content"])
    relative = name.split("/", 1)[1]
    hashes = {hashlib.sha256(raw).hexdigest(), hashlib.sha256(raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")).hexdigest()}
    assert manifest["files"][relative] in hashes, f"Promoted source differs from the packaged manifest: {name}"
    return raw.decode("utf-8")


def main():
    assert os.environ["BUILD_SHA"] == SOURCE
    draft_run = api(f"actions/runs/{os.environ['VERIFIED_DRAFT_RUN']}")
    assert draft_run["conclusion"] == "success" and draft_run["head_sha"] == os.environ["VERIFIED_DRAFT_SHA"]
    proof = json.loads(Path("release-proof/WINDOWS_BACKUP_DRAFT_RESULT.json").read_text())
    assert proof["status"] == "DRAFTS_READY" and proof["source"] == SOURCE
    assert {(app["release_id"], app["version"]) for app in proof["drafts"]} == {(438180996, "1.0.75"), (438181070, "1.0.64")}
    results = []
    for app in proof["drafts"]:
        release = api(f"releases/{app['release_id']}")
        assert not release["draft"] and not release["prerelease"] and release["published_at"]
        assert release["tag_name"] == app["tag"] and release["target_commitish"] == SOURCE
        tag = api(f"git/ref/tags/{app['tag']}")
        assert tag["object"]["type"] == "commit" and tag["object"]["sha"] == SOURCE
        assert {asset["name"] for asset in release["assets"]} == {asset["name"] for asset in app["assets"]}
        checked, content = [], {}
        for asset in release["assets"]:
            expected = next(item for item in app["assets"] if item["name"] == asset["name"])
            assert asset["state"] == "uploaded" and asset["size"] == expected["bytes"]
            assert asset["digest"] == "sha256:" + expected["sha256"]
            item, data = public_bytes(asset["browser_download_url"], expected)
            checked.append({"id": asset["id"], "name": asset["name"], **item})
            if data is not None:
                content[asset["name"]] = data
        name = next(name for name in app["files"] if name.endswith(".exe"))
        update = feed(content["latest.yml"].decode(), app, name)
        manifest = json.loads(content["release-content.json"])
        assert manifest["version"] == app["version"] and manifest["fingerprint"] == app["content_fingerprint"]
        folder = "desktop" if app["app"] == "fastgo-desktop" else "warehouse-desktop"
        entry = source_file(app["tag"], folder + "/main.cjs", manifest)
        cache = "app.commandLine.appendSwitch('disk-cache-size',String(32*1024*1024))"
        assert cache in entry and entry.index(cache) < entry.index("app.whenReady()")
        policy = {"http_cache_bytes": 33554432, "configured_before_ready": True}
        if folder == "desktop":
            store = source_file(app["tag"], "desktop/store.cjs", manifest)
            assert "const AUTO_INTERVAL=60*60*1000,AUTO_COUNT=24;" in store
            assert app["packaged_proof"]["automatic_interval_ms"] == 3600000 and app["packaged_proof"]["automatic_count"] == 24
            policy.update({"automatic_interval_ms": 3600000, "automatic_count": 24, "daily_successful_dates": 7})
        results.append({"id": release["id"], "tag": app["tag"], "version": app["version"], "source": SOURCE, "tag_commit": tag["object"]["sha"], "url": release["html_url"], "published_at": release["published_at"], "content_fingerprint": manifest["fingerprint"], "update": update, "policy": policy, "assets": checked})
    common = next(app for app in proof["drafts"] if app["app"] == "fastgo-desktop")
    warehouse = next(app for app in proof["drafts"] if app["app"] == "fastgo-warehouse-desktop")
    latest = api("releases/latest")
    assert latest["id"] == common["release_id"] and latest["tag_name"] == common["tag"]
    expected = next(item for item in common["assets"] if item["name"] == "latest.yml")
    latest_readback, latest_bytes = public_bytes(f"https://github.com/{REPO}/releases/latest/download/latest.yml", expected)
    feed(latest_bytes.decode(), common, "FastGo-Setup-1.0.75-Windows-x64.exe")
    stored_feed = api("contents/warehouse/update/latest.yml?ref=main")
    assert stored_feed["sha"] == os.environ["WAREHOUSE_FEED_BLOB"]
    warehouse_text = base64.b64decode(stored_feed["content"])
    warehouse_feed = feed(warehouse_text.decode(), warehouse, "FastGo-Warehouse-Setup-1.0.64-Windows-x64.exe", absolute=True)
    expected = {"bytes": len(warehouse_text), "sha256": hashlib.sha256(warehouse_text).hexdigest()}
    raw_url = f"https://raw.githubusercontent.com/{REPO}/main/warehouse/update/latest.yml"
    raw_readback, _ = public_bytes(raw_url, expected)
    # The companion updater uses this cache-busted, no-store path.
    updater_readback, _ = public_bytes(raw_url + "?check=" + os.environ["GITHUB_RUN_ID"], expected)
    result = {"status": "PUBLISHED_PUBLIC_READBACK_PASS", "source": SOURCE, "versions": {"common": "1.0.75", "warehouse": "1.0.64"}, "build_run": 42472487722, "draft_run": int(os.environ["VERIFIED_DRAFT_RUN"]), "verification_run": int(os.environ["GITHUB_RUN_ID"]), "verification_source": os.environ["GITHUB_SHA"], "releases": results, "latest": {"id": latest["id"], "tag": latest["tag_name"], "manifest": latest_readback}, "warehouse_feed": {"blob": stored_feed["sha"], "content_sha256": expected["sha256"], **warehouse_feed, "raw_readback": raw_readback, "updater_readback": updater_readback}, "artifact_retention_days": 7, "installer_files_written_to_disk": 0, "physical_devices_updated_by_this_packet": False, "limitations": ["Publication and public byte/source/feed readback only; no new repair/payment scenarios.", "Root owns installation on the reachable laptop; no local application or AppData was touched.", "An offline device receives the update after it returns online and the existing safe installation guards permit it."]}
    Path("WINDOWS_BACKUP_PUBLIC_RESULT.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("WINDOWS_BACKUP_PUBLIC_RESULT=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
