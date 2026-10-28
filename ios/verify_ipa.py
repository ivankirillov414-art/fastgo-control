"""Verify the actual packaged IPA against the bundle prepared by this CI run."""
import argparse
import hashlib
import json
import plistlib
import struct
import zipfile
from pathlib import Path
from release_identity import validate, require_same


def verify(ipa, version, build, expected):
    with zipfile.ZipFile(ipa) as archive:
        if archive.testzip() is not None:
            raise ValueError('Damaged IPA')
        receipts = [name for name in archive.namelist() if name.endswith('/bundle-receipt.json')]
        if len(receipts) != 1:
            raise ValueError('IPA must have exactly one UI bundle')
        receipt = json.loads(archive.read(receipts[0]))
        validate(receipt)
        require_same(json.loads(Path(expected).read_text(encoding='utf-8')), receipt)
        prefix = receipts[0][:-len('bundle-receipt.json')]
        info = plistlib.loads(archive.read('Payload/FastGo.app/Info.plist'))
        if receipt['version'] != version or info['CFBundleShortVersionString'] != version or str(info['CFBundleVersion']) != str(build) or info['CFBundleIdentifier'] != 'ru.fastgo.ios':
            raise ValueError('Wrong iPhone package version or identity')
        actual = {name[len(prefix):] for name in archive.namelist() if name.startswith(prefix) and not name.endswith('/') and name != receipts[0]}
        if actual != set(receipt['files']):
            raise ValueError('Missing or untracked installed web assets')
        for name, digest in receipt['files'].items():
            if hashlib.sha256(archive.read(prefix + name)).hexdigest() != digest:
                raise ValueError('Installed asset mismatch: ' + name)
        executable = archive.read('Payload/FastGo.app/FastGo')
        if len(executable) < 8 or executable[:4] != b'\xcf\xfa\xed\xfe' or struct.unpack('<I', executable[4:8])[0] != 0x0100000c:
            raise ValueError('Expected compiled arm64 iPhone executable')
        # These are the user-requested features missed by the previous colliding release.
        bundle = archive.read(prefix + 'warehouse/app-compat.js')
        if b'work_payment' not in bundle or b'manual-service-payment' not in bundle:
            raise ValueError('Missing manual repair-work payments')
        return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('ipa')
    parser.add_argument('--version', required=True)
    parser.add_argument('--build', required=True)
    parser.add_argument('--expected', required=True)
    parser.add_argument('--identity-output', required=True)
    args = parser.parse_args()
    receipt = verify(args.ipa, args.version, args.build, args.expected)
    Path(args.identity_output).write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print('Verified IPA', receipt['version'], receipt['source_fingerprint'])
