"""Deterministic source identity; a version number alone never proves a release."""
import hashlib
import json
import re


def fingerprint(receipt):
    payload = {key: receipt[key] for key in ('version', 'files', 'native_files')}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def validate(receipt):
    if receipt.get('platform') != 'ios' or receipt.get('bundle_source') != 'installed-ipa':
        raise ValueError('Not an installed iPhone bundle receipt')
    if not re.fullmatch(r'\d+\.\d+\.\d+', receipt.get('version', '')):
        raise ValueError('Invalid release version')
    for key in ('files', 'native_files'):
        if not isinstance(receipt.get(key), dict) or not receipt[key]:
            raise ValueError('Missing source hashes: ' + key)
        for name, digest in receipt[key].items():
            if name.startswith('/') or '..' in name.split('/') or not re.fullmatch(r'[a-f0-9]{64}', digest):
                raise ValueError('Invalid source hash')
    if receipt.get('source_fingerprint') != fingerprint(receipt):
        raise ValueError('Source fingerprint mismatch')
    return receipt['source_fingerprint']


def require_same(published, candidate):
    if validate(published) != validate(candidate):
        raise ValueError('This version already contains different application sources. Increment the version; never overwrite or silently skip it.')


if __name__ == '__main__':
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser()
    parser.add_argument('--published', required=True)
    parser.add_argument('--candidate', required=True)
    args = parser.parse_args()
    require_same(json.loads(Path(args.published).read_text(encoding='utf-8')), json.loads(Path(args.candidate).read_text(encoding='utf-8')))
    print('Existing release matches every expected web and native source hash')
