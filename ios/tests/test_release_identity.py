import copy
import hashlib
import json
import plistlib
import struct
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from release_identity import fingerprint, require_same
from verify_ipa import verify


def receipt(files):
    result = {'platform': 'ios', 'version': '1.0.12', 'bundle_source': 'installed-ipa',
              'files': {key: hashlib.sha256(value).hexdigest() for key, value in files.items()},
              'native_files': {'ios/FastGo/AppDelegate.swift': 'a' * 64}}
    result['source_fingerprint'] = fingerprint(result)
    return result


class ReleaseIdentityTests(unittest.TestCase):
    def test_same_version_different_sources_never_silently_succeeds(self):
        original = receipt({'warehouse/app-compat.js': b'old'})
        require_same(original, copy.deepcopy(original))
        with self.assertRaisesRegex(ValueError, 'different application sources'):
            require_same(original, receipt({'warehouse/app-compat.js': b'new'}))

    def test_old_release_without_identity_fails_closed(self):
        with self.assertRaises(ValueError):
            require_same({'version': '1.0.12'}, receipt({'a': b'a'}))

    def test_native_changes_and_tampered_receipts_are_detected(self):
        original = receipt({'a': b'a'})
        changed = copy.deepcopy(original)
        changed['native_files']['ios/FastGo/AppDelegate.swift'] = 'b' * 64
        changed['source_fingerprint'] = fingerprint(changed)
        with self.assertRaises(ValueError):
            require_same(original, changed)
        changed['files']['a'] = 'c' * 64
        with self.assertRaisesRegex(ValueError, 'fingerprint'):
            require_same(original, changed)

    def test_real_zip_assets_version_native_binary_and_missing_feature_are_checked(self):
        scratch = Path(__file__).resolve().parents[2] / '.tmp'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='fg-ios-', dir=scratch) as folder:
            folder = Path(folder).resolve()
            assert folder.is_relative_to(scratch.resolve())
            for mode in ('good', 'tampered', 'untracked', 'wrong_build', 'old_feature'):
                files = {'warehouse/app-compat.js': b'work_payment manual-service-payment', 'workshop/app.js': b'fixture'}
                if mode == 'old_feature':
                    files['warehouse/app-compat.js'] = b'old feature set'
                metadata = receipt(files)
                expected = folder / 'expected.json'
                expected.write_text(json.dumps(metadata))
                ipa = folder / (mode + '.ipa')
                with zipfile.ZipFile(ipa, 'w') as archive:
                    archive.writestr('Payload/FastGo.app/Info.plist', plistlib.dumps({'CFBundleShortVersionString': '1.0.12', 'CFBundleVersion': '12' if mode == 'wrong_build' else '13', 'CFBundleIdentifier': 'ru.fastgo.ios'}))
                    archive.writestr('Payload/FastGo.app/FastGo', b'\xcf\xfa\xed\xfe' + struct.pack('<I', 0x0100000c))
                    archive.writestr('Payload/FastGo.app/web/bundle-receipt.json', json.dumps(metadata))
                    for name, data in files.items():
                        archive.writestr('Payload/FastGo.app/web/' + name, b'corrupt' if mode == 'tampered' else data)
                    if mode == 'untracked':
                        archive.writestr('Payload/FastGo.app/web/extra.js', b'not tracked')
                if mode == 'good':
                    self.assertEqual(verify(ipa, '1.0.12', 13, expected), metadata)
                else:
                    with self.assertRaises(ValueError):
                        verify(ipa, '1.0.12', 13, expected)


if __name__ == '__main__':
    unittest.main()
