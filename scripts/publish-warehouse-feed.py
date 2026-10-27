import base64
import json
import os
import pathlib
import re
import subprocess
import tempfile


def feed_version(text):
    match = re.search(r'^version:\s*(\d+)\.(\d+)\.(\d+)\s*$', text, re.M)
    if not match:
        raise RuntimeError('Invalid update-feed version')
    return tuple(map(int, match.groups()))


def may_publish(previous, candidate):
    current = feed_version(candidate)
    if not previous:
        return True
    old = feed_version(previous)
    if old > current:
        return False
    if old == current:
        checksum = lambda value: re.search(r'^sha512:\s*(\S+)\s*$', value, re.M).group(1)
        if checksum(previous) != checksum(candidate):
            raise RuntimeError('An immutable version cannot have another installer checksum')
        return False
    return True


def main():
    text = pathlib.Path('warehouse-release/latest.yml').read_text()
    version = json.loads(pathlib.Path('warehouse-desktop/package.json').read_text())['version']
    if feed_version(text) != tuple(map(int, version.split('.'))):
        raise RuntimeError('Installer and application version mismatch')
    repo = os.environ['GH_REPO']
    name = f'FastGo-Warehouse-Setup-{version}-Windows-x64.exe'
    text = text.replace(name, f'https://github.com/{repo}/releases/download/fastgo-warehouse-v{version}/{name}')
    url = f'repos/{repo}/contents/warehouse/update/latest.yml'
    for attempt in range(3):
        result = subprocess.run(['gh', 'api', url], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Cannot read current warehouse feed; preserve it')
        old = json.loads(result.stdout)
        previous = base64.b64decode(old['content']).decode()
        if not may_publish(previous, text):
            print('Keep the same or newer tested warehouse feed.')
            return
        body = {'message': 'Publish tested warehouse auto-update feed', 'sha': old['sha'],
                'content': base64.b64encode(text.encode()).decode()}
        with tempfile.TemporaryDirectory() as folder:
            request = pathlib.Path(folder) / 'feed.json'
            request.write_text(json.dumps(body))
            write = subprocess.run(['gh', 'api', '--method', 'PUT', url, '--input', str(request)],
                                   capture_output=True, text=True)
        if write.returncode == 0:
            return
        if '409' not in write.stderr and '422' not in write.stderr:
            raise RuntimeError('Cannot update warehouse feed')
    raise RuntimeError('Concurrent feed update; preserve the current feed and retry later')


if __name__ == '__main__':
    main()
