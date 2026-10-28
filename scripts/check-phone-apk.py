"""Audit the final APK manifest, rather than relying on the source manifest."""
import argparse, hashlib, json, struct, zipfile
from pathlib import Path

def manifest_nodes(data):
    strings, nodes, offset = [], [], 8
    u16 = lambda pos: struct.unpack_from('<H', data, pos)[0]
    u32 = lambda pos: struct.unpack_from('<I', data, pos)[0]
    def length(pos, utf8):
        if utf8:
            n = data[pos]
            return (((n & 127) << 8) | data[pos+1], pos+2) if n & 128 else (n, pos+1)
        n = u16(pos)
        return (((n & 32767) << 16) | u16(pos+2), pos+4) if n & 32768 else (n, pos+2)
    while offset < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, offset)
        if size < header or offset + size > len(data):
            raise ValueError('Invalid binary manifest chunk')
        if kind == 1:
            count, _, flags, start = struct.unpack_from('<IIII', data, offset+8)
            utf8 = bool(flags & 256)
            for i in range(count):
                pos = offset + start + u32(offset + header + 4*i)
                _, pos = length(pos, utf8)
                if utf8:
                    n, pos = length(pos, True)
                    strings.append(data[pos:pos+n].decode('utf-8'))
                else:
                    # The first length was in UTF-16 code units.
                    n, pos = length(offset + start + u32(offset+header+4*i), False)
                    strings.append(data[pos:pos+2*n].decode('utf-16-le'))
        elif kind == 0x102:
            ext = offset + header
            name = strings[u32(ext+4)]
            first, stride, count = struct.unpack_from('<HHH', data, ext+8)
            attrs = {}
            for i in range(count):
                pos = ext+first+i*stride
                key, raw = u32(pos+4), u32(pos+8)
                typ, value = data[pos+15], u32(pos+16)
                attrs[strings[key]] = strings[raw] if raw != 0xffffffff else strings[value] if typ == 3 else bool(value) if typ == 18 else value
            nodes.append((name, attrs))
        offset += size
    return nodes

def audit(apk):
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or any('..' in n.split('/') or n.startswith('/') for n in names):
            raise ValueError('Unsafe or duplicate APK entries')
        nodes = manifest_nodes(archive.read('AndroidManifest.xml'))
    root = next(attrs for tag, attrs in nodes if tag == 'manifest')
    application = next(attrs for tag, attrs in nodes if tag == 'application')
    sdk = next(attrs for tag, attrs in nodes if tag == 'uses-sdk')
    package = root['package']
    permissions = sorted(attrs['name'] for tag, attrs in nodes if tag.startswith('uses-permission'))
    allowed = {'android.permission.INTERNET', 'android.permission.CAMERA', 'android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION', package+'.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
    failures = []
    if package not in ('ru.fastgo.mobile', 'ru.fastgo.mobile.test'): failures.append('Unexpected application package')
    if set(permissions)-allowed: failures.append('Unexpected permissions: '+str(set(permissions)-allowed))
    if sdk['targetSdkVersion'] < 35: failures.append('Target SDK is obsolete')
    if application.get('debuggable', False) or application.get('testOnly', False): failures.append('Release APK is debuggable or test-only')
    if application.get('usesCleartextTraffic', True): failures.append('Cleartext network traffic is enabled')
    if application.get('allowBackup', True): failures.append('Application backup is enabled')
    exported = [attrs for tag, attrs in nodes if tag in ('activity', 'service', 'receiver', 'provider') and attrs.get('exported', False)]
    for component in exported:
        if component['name'] in ('ru.fastgo.mobile.MainActivity', '.MainActivity'): continue
        if component['name'] == 'androidx.profileinstaller.ProfileInstallReceiver' and component.get('permission') == 'android.permission.DUMP': continue
        failures.append('Unexpected exported Android component: '+component['name'])
    report = {'file':Path(apk).name,'sha256':hashlib.sha256(Path(apk).read_bytes()).hexdigest(),'package':package,'version':root['versionName'],'versionCode':root['versionCode'],'sdk':sdk,'permissions':permissions,'exported_components':exported,'manifest_checks_passed':not failures,'failures':failures,'scope':'APK structure and merged manifest; this is not a Play Protect verdict'}
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    parser.add_argument('--output')
    args = parser.parse_args()
    report = audit(args.apk)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output: Path(args.output).write_text(text+'\n',encoding='utf-8')
    print(text)
    raise SystemExit(0 if report['manifest_checks_passed'] else 1)
