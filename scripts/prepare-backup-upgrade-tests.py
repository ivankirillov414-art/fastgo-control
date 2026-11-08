"""Embed the exact release candidate into the existing TSD upgrade-test APK."""
import argparse,hashlib,json,pathlib,shutil,zipfile
p=argparse.ArgumentParser()
p.add_argument('--test-apk',required=True)
p.add_argument('--test-sha256',required=True)
p.add_argument('--candidate',required=True)
p.add_argument('--candidate-sha256',required=True)
p.add_argument('--output',required=True)
a=p.parse_args()
root=pathlib.Path.cwd().resolve()
scratch=(root/'warehouse-android/phone/build/backup-release-local').resolve()
source=(root/a.test_apk).resolve()
candidate=(root/a.candidate).resolve()
target=(root/a.output).resolve()
if scratch not in source.parents or scratch not in target.parents or target.exists():
    raise SystemExit('Upgrade-test input/output must stay in owned scratch, without overwriting')
def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()
if sha(source)!=a.test_sha256 or sha(candidate)!=a.candidate_sha256:
    raise SystemExit('Upgrade-test source or signed candidate SHA mismatch')
owned=[scratch,root/'warehouse-android/phone/release/FastGo-Android-1.0.17.apk',root/'warehouse/native/FastGo-TSD-2.1.10.apk',root/'warehouse-android/native/release']
used=sum(f.stat().st_size for folder in owned for f in (folder.rglob('*') if folder.is_dir() else [folder]) if f.is_file())
maximum=source.stat().st_size+candidate.stat().st_size+131072
if used+maximum>64*1024*1024 or shutil.disk_usage(root).free-maximum<1024*1024*1024:
    raise SystemExit('Upgrade-test preparation violates 64MiB/1GiB storage bounds')
def signing_file(name):
    parts=name.upper().split('/')
    return len(parts)==2 and parts[0]=='META-INF' and (parts[1]=='MANIFEST.MF' or parts[1].endswith(('.SF','.RSA','.DSA','.EC')))
try:
    with zipfile.ZipFile(source) as src,zipfile.ZipFile(target,'x') as dst:
        names=src.namelist()
        if len(names)!=len(set(names)) or any('..' in n.split('/') or n.startswith('/') for n in names):
            raise RuntimeError('Unsafe test APK')
        for item in src.infolist():
            if not signing_file(item.filename) and item.filename!='assets/update-fixture.apk':
                dst.writestr(item,src.read(item))
        dst.write(candidate,'assets/update-fixture.apk',compress_type=zipfile.ZIP_STORED)
    with zipfile.ZipFile(source) as src,zipfile.ZipFile(target) as dst:
        for name in src.namelist():
            if not signing_file(name) and name!='assets/update-fixture.apk':
                if src.read(name)!=dst.read(name):
                    raise RuntimeError('Test APK code/resources changed')
        if hashlib.sha256(dst.read('assets/update-fixture.apk')).hexdigest()!=a.candidate_sha256:
            raise RuntimeError('Embedded signed candidate differs')
    print(json.dumps({'file':str(target),'sha256':sha(target),'bytes':target.stat().st_size,'candidate_sha256':a.candidate_sha256,'test_code_and_resources_preserved':True},indent=2))
except Exception:
    target.unlink(missing_ok=True)
    raise
