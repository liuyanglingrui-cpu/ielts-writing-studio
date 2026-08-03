from __future__ import annotations

import hashlib
import io
import os
import plistlib
import shutil
import stat
import struct
import sys
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / "desktop"
CACHE = ROOT / "work" / "mac-packager-cache"
OUTPUT = ROOT / "release-v0.2"
ELECTRON_VERSION = "43.2.0"
APP_NAME = "IELTS Writing Studio"
APP_VERSION = "0.2.0"
BASE_URL = f"https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}"
ARCHIVES = {
    "x64": f"electron-v{ELECTRON_VERSION}-darwin-x64.zip",
    "arm64": f"electron-v{ELECTRON_VERSION}-darwin-arm64.zip",
}

APP_FILES = [
    "index.html",
    "styles.css",
    "questions.js",
    "renderer.js",
    "main.cjs",
    "preload.cjs",
    "docx-export.cjs",
    "package.json",
]

FIRST_OPEN_SCRIPT = DESKTOP / "mac-first-open.command"
FIRST_OPEN_README = DESKTOP / "mac-first-open-readme.txt"


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    print(f"Downloading {destination.name}...")
    with urllib.request.urlopen(url) as response, destination.open("wb") as out:
        shutil.copyfileobj(response, out)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_downloads() -> None:
    checksums_path = CACHE / "SHASUMS256.txt"
    download(f"{BASE_URL}/SHASUMS256.txt", checksums_path)
    checksums = {}
    for line in checksums_path.read_text("utf-8").splitlines():
        if not line.strip():
            continue
        checksum, filename = line.split(maxsplit=1)
        checksums[filename.lstrip("* ")] = checksum.lower()

    for filename in ARCHIVES.values():
        archive = CACHE / filename
        download(f"{BASE_URL}/{filename}", archive)
        actual = sha256(archive)
        expected = checksums.get(filename)
        if not expected or actual != expected:
            archive.unlink(missing_ok=True)
            raise RuntimeError(f"Checksum verification failed for {filename}")
        print(f"Verified {filename}: {actual}")


def build_icns() -> bytes:
    source = Image.open(DESKTOP / "assets" / "app-icon.png").convert("RGBA")
    entries = [
        ("icp4", 16),
        ("icp5", 32),
        ("icp6", 64),
        ("ic07", 128),
        ("ic08", 256),
        ("ic09", 512),
        ("ic10", 1024),
    ]
    chunks = []
    for code, size in entries:
        image = source.resize((size, size), Image.Resampling.LANCZOS)
        data = io.BytesIO()
        image.save(data, format="PNG", optimize=True)
        payload = data.getvalue()
        chunks.append(code.encode("ascii") + struct.pack(">I", len(payload) + 8) + payload)
    body = b"".join(chunks)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def clone_info(source: zipfile.ZipInfo, destination_name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(destination_name, source.date_time)
    info.compress_type = source.compress_type
    info.comment = source.comment
    info.extra = source.extra
    info.create_system = source.create_system
    info.create_version = source.create_version
    info.extract_version = source.extract_version
    info.flag_bits = source.flag_bits
    info.external_attr = source.external_attr
    info.internal_attr = source.internal_attr
    return info


def file_info(name: str, executable: bool = False) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name)
    info.create_system = 3
    mode = stat.S_IFREG | (0o755 if executable else 0o644)
    info.external_attr = mode << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    return info


def add_file(out: zipfile.ZipFile, source: Path, archive_name: str) -> None:
    executable = os.access(source, os.X_OK) and source.suffix not in {".js", ".json", ".html", ".css"}
    out.writestr(file_info(archive_name.replace("\\", "/"), executable), source.read_bytes())


def make_bundle(arch: str) -> Path:
    source_archive = CACHE / ARCHIVES[arch]
    output_archive = OUTPUT / f"IELTS-Writing-Studio-{APP_VERSION}-macOS-{arch}.zip"
    app_prefix = f"{APP_NAME}.app/"
    old_prefix = "Electron.app/"

    print(f"Packaging {output_archive.name}...")
    with zipfile.ZipFile(source_archive, "r") as source, zipfile.ZipFile(
        output_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True
    ) as out:
        for original in source.infolist():
            if not original.filename.startswith(old_prefix):
                continue
            relative = original.filename[len(old_prefix):]
            if relative.startswith("Contents/_CodeSignature/") or relative == "Contents/CodeResources":
                continue
            if relative == "Contents/Resources/default_app.asar":
                continue

            destination_relative = relative
            data = source.read(original)
            if relative == "Contents/MacOS/Electron":
                destination_relative = f"Contents/MacOS/{APP_NAME}"
            elif relative == "Contents/Info.plist":
                plist = plistlib.loads(data)
                plist["CFBundleDisplayName"] = APP_NAME
                plist["CFBundleName"] = APP_NAME
                plist["CFBundleExecutable"] = APP_NAME
                plist["CFBundleIdentifier"] = "com.jimmymario.ieltswritingstudio"
                plist["CFBundleShortVersionString"] = APP_VERSION
                plist["CFBundleVersion"] = APP_VERSION
                plist["CFBundleIconFile"] = "app-icon.icns"
                plist["LSApplicationCategoryType"] = "public.app-category.education"
                plist["LSMinimumSystemVersion"] = "10.15.0"
                plist["NSHighResolutionCapable"] = True
                data = plistlib.dumps(plist, fmt=plistlib.FMT_XML, sort_keys=True)

            out.writestr(clone_info(original, app_prefix + destination_relative), data)

        out.writestr(
            file_info(app_prefix + "Contents/Resources/app-icon.icns"),
            build_icns(),
        )

        app_resource_prefix = app_prefix + "Contents/Resources/app/"
        for relative in APP_FILES:
            add_file(out, DESKTOP / relative, app_resource_prefix + relative)

        node_modules = DESKTOP / "node_modules"
        for source_file in node_modules.rglob("*"):
            if not source_file.is_file():
                continue
            relative = source_file.relative_to(DESKTOP).as_posix()
            if relative.startswith("node_modules/electron/") or "/.bin/" in relative:
                continue
            add_file(out, source_file, app_resource_prefix + relative)

        out.writestr(
            file_info("首次打开我.command", executable=True),
            FIRST_OPEN_SCRIPT.read_bytes(),
        )
        out.writestr(
            file_info("首次打开说明.txt"),
            FIRST_OPEN_README.read_bytes(),
        )

    print(f"Created {output_archive.name}: {output_archive.stat().st_size} bytes")
    return output_archive


def audit_bundle(path: Path, arch: str) -> None:
    prefix = f"{APP_NAME}.app/"
    with zipfile.ZipFile(path, "r") as archive:
        names = set(archive.namelist())
        required = {
            prefix + f"Contents/MacOS/{APP_NAME}",
            prefix + "Contents/Info.plist",
            prefix + "Contents/Resources/app-icon.icns",
            prefix + "Contents/Resources/app/main.cjs",
            prefix + "Contents/Resources/app/node_modules/docx/dist/index.cjs",
            "首次打开我.command",
            "首次打开说明.txt",
        }
        missing = sorted(required - names)
        if missing:
            raise RuntimeError(f"Missing files in {arch} bundle: {missing}")
        if any("Contents/_CodeSignature/" in name for name in names):
            raise RuntimeError(f"Unexpected outer signature in {arch} bundle")
        executable_info = archive.getinfo(prefix + f"Contents/MacOS/{APP_NAME}")
        mode = executable_info.external_attr >> 16
        if not mode & stat.S_IXUSR:
            raise RuntimeError(f"Main executable bit missing in {arch} bundle")
        first_open_mode = archive.getinfo("首次打开我.command").external_attr >> 16
        if not first_open_mode & stat.S_IXUSR:
            raise RuntimeError(f"First-open script executable bit missing in {arch} bundle")
        plist = plistlib.loads(archive.read(prefix + "Contents/Info.plist"))
        if plist.get("CFBundleExecutable") != APP_NAME:
            raise RuntimeError(f"Invalid executable name in {arch} Info.plist")
        print(
            f"Audited {arch}: {len(names)} entries, executable mode {oct(mode)}, "
            f"first-open mode {oct(first_open_mode)}"
        )


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    verify_downloads()
    requested_arches = tuple(sys.argv[1:]) or ("x64", "arm64")
    invalid_arches = sorted(set(requested_arches) - set(ARCHIVES))
    if invalid_arches:
        raise RuntimeError(f"Unsupported architectures: {', '.join(invalid_arches)}")
    for arch in requested_arches:
        bundle = make_bundle(arch)
        audit_bundle(bundle, arch)


if __name__ == "__main__":
    main()
